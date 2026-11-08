import type { TranslationStatus } from "@zteam/shared";

/**
 * Builds the text sent to the local speech endpoint.
 *
 * A protected value is never sent to the TTS service, even when it appears
 * inside a translated sentence. The phrase-bank spoken plan is the long-term
 * source; this guard protects the interim sentence reader.
 */
export function safeSpeechTexts(status: TranslationStatus, limit = 12): string[] {
  const protectedValues = status.protectedValues
    .map((value) => value.value.trim())
    .filter(Boolean);

  return status.sentences
    .filter((sentence) => sentence.status === "applied" && sentence.target)
    .map((sentence) => sentence.target?.trim() ?? "")
    .filter(
      (text) =>
        text.length > 0 && !protectedValues.some((protectedValue) => text.includes(protectedValue)),
    )
    .slice(0, limit);
}
