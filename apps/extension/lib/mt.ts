import type { MtTranslateResponse, MtTranslation } from "@zteam/shared";
import { discoverApiBaseUrl, API_PORTS } from "./backend";

export const MT_MAX_TEXTS = 80;
export const MT_MAX_CHARS = 3_500;
export const MT_CONCURRENCY = 4;
export const MT_TIMEOUT_MS = 20_000;
export const MT_DEADLINE_MS = 45_000;
export const DEFAULT_TARGET_LANG = "fub";

const CACHE_LIMIT = 500;
const cache = new Map<string, MtTranslation>();

interface TranslatePayload {
  text: string;
  translated: boolean;
  provider: string;
  model: string;
  local: boolean;
  stub: boolean;
}

export interface TranslateTextsOptions {
  texts: string[];
  source: "fr" | "en";
  /** Target language pack; defaults to fub for older callers. */
  targetLang?: string;
  baseUrl?: string | null;
  provider?: string | null;
  fetcher?: typeof fetch;
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
  timeoutMs?: number;
  deadlineMs?: number;
  concurrency?: number;
}

/** Accept only the loopback API range; never let a page choose an origin. */
export function isLoopbackApiBaseUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "http:" &&
      url.hostname === "127.0.0.1" &&
      API_PORTS.includes(Number(url.port)) &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

/** Reads the API's translation body without trusting its shape. */
export function parseTranslatePayload(body: unknown): TranslatePayload | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  if (typeof record.text !== "string") return null;
  if (typeof record.translated !== "boolean") return null;
  if (typeof record.provider !== "string" || typeof record.model !== "string") return null;
  return {
    text: record.text,
    translated: record.translated,
    provider: record.provider,
    model: record.model,
    local: record.local === true,
    stub: record.stub === true,
  };
}

export function clearMtCache(): void {
  cache.clear();
}

function cacheKey(
  source: string,
  provider: string | null,
  targetLang: string,
  text: string,
): string {
  return `${provider ?? "auto"}|${source}|${targetLang}|${text}`;
}

function cachePut(key: string, translation: MtTranslation): void {
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, translation);
}

async function requestOne(
  text: string,
  source: "fr" | "en",
  baseUrl: string,
  provider: string | null,
  targetLang: string,
  fetcher: typeof fetch,
  timeoutMs: number,
  signal: AbortSignal | undefined,
): Promise<MtTranslation | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort, { once: true });

  try {
    const response = await fetcher(`${baseUrl}/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        source,
        target: targetLang,
        ...(provider ? { provider } : {}),
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`http_${response.status}`);
    const payload = parseTranslatePayload(await response.json());
    if (!payload || !payload.translated || payload.stub) return null;
    const target = payload.text.trim();
    if (!target || target === text.trim()) return null;
    return {
      source: text,
      target,
      provider: payload.provider,
      model: payload.model,
    };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

/**
 * Translates plain page strings through the local API.
 *
 * The caller must pass only strings with no protected value. The worker keeps
 * four requests in flight, caches successful targets in memory for the service
 * worker lifetime, and never persists page text.
 */
export async function translateTexts(
  options: TranslateTextsOptions,
): Promise<MtTranslateResponse> {
  const texts = Array.from(
    new Set(
      options.texts
        .map((text) => text.trim())
        .filter((text) => text.length > 0 && text.length <= MT_MAX_CHARS),
    ),
  ).slice(0, MT_MAX_TEXTS);

  if (texts.length === 0) {
    return { ok: true, translations: [] };
  }

  const fetcher = options.fetcher ?? fetch;
  const baseUrl = isLoopbackApiBaseUrl(options.baseUrl)
    ? (options.baseUrl as string)
    : await discoverApiBaseUrl({ fetcher });
  if (!baseUrl) return { ok: false, error: "api_offline" };
  const apiBaseUrl: string = baseUrl;

  const provider = options.provider ?? null;
  const targetLang = options.targetLang ?? DEFAULT_TARGET_LANG;
  const timeoutMs = options.timeoutMs ?? MT_TIMEOUT_MS;
  const deadline = Date.now() + (options.deadlineMs ?? MT_DEADLINE_MS);
  const concurrency = Math.max(1, options.concurrency ?? MT_CONCURRENCY);
  const translations: MtTranslation[] = [];
  const pending: string[] = [];
  let done = 0;
  let firstError = "";

  for (const text of texts) {
    const cached = cache.get(cacheKey(options.source, provider, targetLang, text));
    if (cached) {
      translations.push(cached);
      done += 1;
    } else {
      pending.push(text);
    }
  }
  options.onProgress?.(done, texts.length);

  let index = 0;
  async function worker(): Promise<void> {
    while (index < pending.length) {
      if (Date.now() > deadline) {
        firstError ||= "mt_timeout";
        return;
      }
      const text = pending[index];
      index += 1;
      if (!text) break;
      try {
        const translation = await requestOne(
          text,
          options.source,
          apiBaseUrl,
          provider,
          targetLang,
          fetcher,
          timeoutMs,
          options.signal,
        );
        if (translation) {
          translations.push(translation);
          cachePut(cacheKey(options.source, provider, targetLang, text), translation);
        } else {
          firstError ||= "empty_translation";
        }
      } catch (error) {
        if (options.signal?.aborted) return;
        firstError ||= error instanceof Error ? error.message : "translation_failed";
      } finally {
        done += 1;
        options.onProgress?.(done, texts.length);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, pending.length) }, () => worker()),
  );

  if (translations.length === 0) {
    return { ok: false, error: firstError || "translation_failed", baseUrl };
  }

  const first = translations[0];
  if (!first) {
    return { ok: false, error: firstError || "translation_failed", baseUrl };
  }
  return {
    ok: true,
    baseUrl,
    provider: first.provider,
    model: first.model,
    translations,
    ...(firstError ? { error: firstError } : {}),
  };
}
