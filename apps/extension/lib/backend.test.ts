import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_API_BASE_URL,
  backendUnavailableReason,
  discoverApiBaseUrl,
  failureCopyKey,
  parseBackendFailure,
  voiceStateFromHealth,
} from "./backend";

describe("voiceStateFromHealth", () => {
  it("reports offline when the API is not reachable", () => {
    expect(voiceStateFromHealth(null)).toBe("offline");
  });

  it("keeps the stub state honest", () => {
    expect(voiceStateFromHealth({ backends: { tts: "stub" } })).toBe("stub");
    expect(
      voiceStateFromHealth({
        tts: { name: "stub", ready: true, local: true, stub: true },
      }),
    ).toBe("stub");
  });

  it("reports ready for a loaded local model", () => {
    expect(
      voiceStateFromHealth({
        tts: { name: "mms", ready: true, local: true, stub: false },
      }),
    ).toBe("ready");
  });

  it("reports unavailable when the model or key is missing", () => {
    expect(
      voiceStateFromHealth({
        tts: {
          name: "mms",
          ready: false,
          reason: "model_missing",
          local: true,
          stub: false,
        },
      }),
    ).toBe("unavailable");
    expect(
      voiceStateFromHealth({
        backends: { tts: "camb" },
        ready: { tts: false },
      }),
    ).toBe("unavailable");
  });

  it("does not treat a configured cloud backend as ready without a readiness flag", () => {
    expect(voiceStateFromHealth({ backends: { tts: "camb" } })).toBe("ready");
    expect(voiceStateFromHealth({ backends: { tts: "unknown" } })).toBe("unknown");
  });
});

describe("backendUnavailableReason", () => {
  it("returns the provider reason", () => {
    expect(
      backendUnavailableReason({
        tts: {
          name: "camb",
          ready: false,
          reason: "credentials_missing",
          local: false,
          stub: false,
        },
      }),
    ).toBe("credentials_missing");
  });

  it("returns null for a ready provider", () => {
    expect(
      backendUnavailableReason({
        tts: { name: "stub", ready: true, local: true, stub: true },
      }),
    ).toBeNull();
  });
});

describe("parseBackendFailure", () => {
  it("reads the structured detail", () => {
    expect(
      parseBackendFailure(403, {
        detail: { code: "cloud_disabled", message: "Cloud speech is disabled." },
      }),
    ).toEqual({ code: "cloud_disabled", message: "Cloud speech is disabled.", status: 403 });
  });

  it("accepts a string detail", () => {
    expect(parseBackendFailure(422, { detail: "Bad input" })).toEqual({
      code: "error",
      message: "Bad input",
      status: 422,
    });
  });

  it("falls back on an unknown body", () => {
    expect(parseBackendFailure(502, null)).toEqual({
      code: "error",
      message: "Backend 502",
      status: 502,
    });
  });
});

describe("failureCopyKey", () => {
  it("maps configuration failures to the voice message", () => {
    expect(failureCopyKey({ code: "credentials_missing", message: "", status: 503 })).toBe(
      "voiceUnavailable",
    );
    expect(failureCopyKey({ code: "model_missing", message: "", status: 503 })).toBe(
      "voiceUnavailable",
    );
  });

  it("maps the cloud switch to its own message", () => {
    expect(failureCopyKey({ code: "cloud_disabled", message: "", status: 403 })).toBe(
      "cloudDisabled",
    );
  });

  it("keeps generic failures generic", () => {
    expect(failureCopyKey({ code: "upstream_error", message: "", status: 502 })).toBe(
      "audioError",
    );
  });
});

describe("discoverApiBaseUrl", () => {
  function response(payload: unknown, ok = true): Response {
    return { ok, json: async () => payload } as unknown as Response;
  }

  it("returns the default base URL when 8000 is the Z-Team API", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith(":8000/health")) {
        return response({ service: "zteam-server", status: "ok" });
      }
      throw new Error("unreachable");
    });

    await expect(
      discoverApiBaseUrl({ ports: [8000, 8001], fetcher: fetcher as unknown as typeof fetch }),
    ).resolves.toBe(DEFAULT_API_BASE_URL);
  });

  it("skips a foreign service and finds 8001", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith(":8000/health")) return response({ service: "other" });
      if (url.endsWith(":8001/health")) {
        return response({ service: "zteam-server", status: "ok" });
      }
      throw new Error("unreachable");
    });

    await expect(
      discoverApiBaseUrl({ ports: [8000, 8001], fetcher: fetcher as unknown as typeof fetch }),
    ).resolves.toBe("http://127.0.0.1:8001");
  });

  it("returns null when no Z-Team API answers", async () => {
    const fetcher = vi.fn(async () => {
      throw new Error("offline");
    });

    await expect(
      discoverApiBaseUrl({
        ports: [8000, 8001],
        timeoutMs: 10,
        fetcher: fetcher as unknown as typeof fetch,
      }),
    ).resolves.toBeNull();
  });

  it("ignores a non-ok response", async () => {
    const fetcher = vi.fn(async () => response({}, false));

    await expect(
      discoverApiBaseUrl({
        ports: [8000],
        timeoutMs: 10,
        fetcher: fetcher as unknown as typeof fetch,
      }),
    ).resolves.toBeNull();
  });
});
