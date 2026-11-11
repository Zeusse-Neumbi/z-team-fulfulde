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
  local_only?: boolean;
  backends?: { tts?: string; mt?: string; asr?: string };
  ready?: { tts?: boolean; mt?: boolean; asr?: boolean };
  mt?: BackendStatus;
  tts?: BackendStatus;
  asr?: BackendStatus;
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
