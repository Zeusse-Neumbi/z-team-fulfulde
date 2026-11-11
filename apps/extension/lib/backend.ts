export type VoiceState = "unknown" | "stub" | "ready" | "offline" | "unavailable";

export interface BackendStatus {
  name: string;
  label?: string;
  ready: boolean;
  reason?: string | null;
  detail?: string | null;
  local: boolean;
  stub: boolean;
}

export interface HealthResponse {
  status?: string;
  service?: string;
  local_only?: boolean;
  backends?: { tts?: string; mt?: string; asr?: string };
  ready?: { tts?: boolean; mt?: boolean; asr?: boolean };
  mt?: BackendStatus;
  tts?: BackendStatus;
  asr?: BackendStatus;
}

export const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000";
export const API_PORTS = Array.from({ length: 11 }, (_, index) => 8000 + index);

export interface DiscoverApiOptions {
  ports?: number[];
  timeoutMs?: number;
  fetcher?: typeof fetch;
}

/**
 * Finds the local API on the loopback range 8000-8010.
 *
 * The demo can start on a second port when 8000 is already used. The panel
 * probes `/health` for the `zteam-server` service and uses the first match;
 * the caller falls back to DEFAULT_API_BASE_URL when nothing answers.
 */
export async function discoverApiBaseUrl(
  options: DiscoverApiOptions = {},
): Promise<string | null> {
  const ports = options.ports ?? API_PORTS;
  const timeoutMs = options.timeoutMs ?? 300;
  const fetcher = options.fetcher ?? fetch;

  for (const port of ports) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetcher(`http://127.0.0.1:${port}/health`, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) continue;
      const data = (await response.json()) as HealthResponse;
      if (data?.service === "zteam-server") return `http://127.0.0.1:${port}`;
    } catch {
      // try the next loopback port
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

/**
 * Maps the local API health payload to the panel's voice state.
 *
 * A backend that is configured but not ready (missing model, missing key,
 * cloud disabled) must not be advertised as a usable voice: the play button
 * stays disabled and the panel explains why.
 */
export function voiceStateFromHealth(health: HealthResponse | null): VoiceState {
  if (!health) return "offline";
  const tts = health.tts;
  if (!tts) {
    const name = health.backends?.tts;
    if (!name || name === "unknown") return "unknown";
    if (name === "stub") return "stub";
    return health.ready?.tts === false ? "unavailable" : "ready";
  }
  if (tts.stub) return "stub";
  if (!tts.ready) return "unavailable";
  return "ready";
}

/** Human-readable reason a provider is not usable, or null when it is. */
export function backendUnavailableReason(health: HealthResponse | null): string | null {
  if (!health) return "offline";
  const tts = health.tts;
  if (tts) {
    if (tts.reason) return tts.reason;
    if (!tts.ready) return "not_ready";
  }
  if (health.ready?.tts === false) return "not_ready";
  return null;
}

export interface BackendFailure {
  code: string;
  message: string;
  status: number;
}

/** Reads the API's structured error body without trusting its shape. */
export function parseBackendFailure(status: number, body: unknown): BackendFailure {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") {
    return { code: "error", message: detail, status };
  }
  if (detail && typeof detail === "object") {
    const record = detail as { code?: unknown; message?: unknown };
    const code = typeof record.code === "string" ? record.code : "error";
    const message = typeof record.message === "string" ? record.message : code;
    return { code, message, status };
  }
  return { code: "error", message: `Backend ${status}`, status };
}

/** Maps a failure code to a panel message key. */
export function failureCopyKey(
  failure: BackendFailure,
): "cloudDisabled" | "voiceUnavailable" | "audioStub" | "audioError" {
  if (failure.code === "cloud_disabled") return "cloudDisabled";
  if (
    failure.code === "credentials_missing" ||
    failure.code === "model_missing" ||
    failure.code === "dependency_missing" ||
    failure.code === "provider_unavailable"
  ) {
    return "voiceUnavailable";
  }
  if (failure.code === "provider_unknown") return "audioError";
  return "audioError";
}
