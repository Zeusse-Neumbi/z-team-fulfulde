/**
 * Which voice may speak for the selected target language.
 *
 * A bundled clip pack is bound to one ISO 639-3 code. A Yemba selection must
 * never play a Fulfulde clip, and an API-only language must not advertise a
 * bundled voice it does not have. This module is intentionally pure so the
 * rule is unit-tested without a browser.
 */
export interface VoicePolicy {
  targetHasVoice: boolean;
  bundledVoice: boolean;
  apiVoice: boolean;
  audioReady: boolean;
}

export interface VoicePolicyInput {
  targetLang: string;
  /** `speech.voice` from the selected language registry row. */
  voice: "bundled" | "api" | "none";
  /** `language` from the bundled audio manifest, when a manifest exists. */
  audioLanguage?: string;
  /** `spoken` count from the bundled audio manifest. */
  audioSpoken?: number;
  /** True when `/health` reports a ready local TTS backend. */
  apiReady: boolean;
}

export function resolveVoicePolicy(input: VoicePolicyInput): VoicePolicy {
  const targetHasVoice = input.voice !== "none";
  const bundledVoice =
    input.voice === "bundled" &&
    input.audioLanguage === input.targetLang &&
    (input.audioSpoken ?? 0) > 0;
  const apiVoice = input.voice === "api" && input.apiReady;
  return {
    targetHasVoice,
    bundledVoice,
    apiVoice,
    audioReady: bundledVoice || apiVoice,
  };
}
