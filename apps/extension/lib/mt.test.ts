import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearMtCache,
  isLoopbackApiBaseUrl,
  parseTranslatePayload,
  translateTexts,
} from "./mt";

function jsonResponse(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  } as unknown as Response;
}

function payload(text: string, overrides: Record<string, unknown> = {}) {
  return {
    text,
    translated: true,
    provider: "nllb",
    model: "nllb-600m",
    local: true,
    target_lang: "fuv",
    stub: false,
    ...overrides,
  };
}

describe("isLoopbackApiBaseUrl", () => {
  it("accepts the local API range only", () => {
    expect(isLoopbackApiBaseUrl("http://127.0.0.1:8000")).toBe(true);
    expect(isLoopbackApiBaseUrl("http://127.0.0.1:8010/")).toBe(true);
    expect(isLoopbackApiBaseUrl("http://127.0.0.1:8011")).toBe(false);
    expect(isLoopbackApiBaseUrl("https://127.0.0.1:8000")).toBe(false);
    expect(isLoopbackApiBaseUrl("http://localhost:8000")).toBe(false);
    expect(isLoopbackApiBaseUrl("http://127.0.0.1:8000/steal")).toBe(false);
    expect(isLoopbackApiBaseUrl(null)).toBe(false);
  });
});

describe("parseTranslatePayload", () => {
  it("accepts the API response contract", () => {
    expect(parseTranslatePayload(payload("Soldi jaɓɓorgo"))).toEqual({
      text: "Soldi jaɓɓorgo",
      translated: true,
      provider: "nllb",
      model: "nllb-600m",
      local: true,
      stub: false,
    });
  });

  it("rejects a body without a target or provider", () => {
    expect(parseTranslatePayload(null)).toBeNull();
    expect(parseTranslatePayload({ text: "x" })).toBeNull();
    expect(parseTranslatePayload(payload("x", { provider: 3 }))).toBeNull();
  });
});

describe("translateTexts", () => {
  beforeEach(() => clearMtCache());

  it("returns an empty result without calling the API", async () => {
    const fetcher = vi.fn();
    await expect(
      translateTexts({
        texts: ["  ", ""],
        source: "fr",
        baseUrl: "http://127.0.0.1:8000",
        fetcher: fetcher as unknown as typeof fetch,
      }),
    ).resolves.toEqual({ ok: true, translations: [] });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("translates plain strings and reports progress", async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { text: string };
      return jsonResponse(payload(`MT:${body.text}`));
    });
    const progress = vi.fn();
    const result = await translateTexts({
      texts: ["Solde disponible", "Frais", "Solde disponible"],
      source: "fr",
      baseUrl: "http://127.0.0.1:8000",
      fetcher: fetcher as unknown as typeof fetch,
      onProgress: progress,
      concurrency: 2,
    });

    expect(result.ok).toBe(true);
    expect(result.translations).toHaveLength(2);
    expect(result.provider).toBe("nllb");
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(progress).toHaveBeenLastCalledWith(2, 2);
  });

  it("caches successful targets in memory", async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { text: string };
      return jsonResponse(payload(`MT:${body.text}`));
    });
    const options = {
      texts: ["Frais"],
      source: "fr" as const,
      baseUrl: "http://127.0.0.1:8000",
      fetcher: fetcher as unknown as typeof fetch,
    };
    await translateTexts(options);
    await translateTexts(options);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("skips a stub or unchanged target and reports the miss", async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { text: string };
      if (body.text === "Frais") {
        return jsonResponse(payload("Frais", { stub: true }));
      }
      return jsonResponse(payload("MT:Solde"));
    });
    const result = await translateTexts({
      texts: ["Frais", "Solde"],
      source: "fr",
      baseUrl: "http://127.0.0.1:8000",
      fetcher: fetcher as unknown as typeof fetch,
      concurrency: 1,
    });
    expect(result.ok).toBe(true);
    expect(result.translations).toHaveLength(1);
    expect(result.error).toBe("empty_translation");
  });

  it("fails cleanly on an HTTP error", async () => {
    const fetcher = vi.fn(async () => jsonResponse({ detail: "bad" }, 500));
    const result = await translateTexts({
      texts: ["Frais"],
      source: "fr",
      baseUrl: "http://127.0.0.1:8000",
      fetcher: fetcher as unknown as typeof fetch,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("http_500");
  });
});
