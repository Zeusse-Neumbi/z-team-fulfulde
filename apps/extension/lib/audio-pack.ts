/**
 * Bundled demo audio.
 *
 * The ZIP carries a short MMS-rendered clip for the draft phrases, so the
 * examiner hears Fulfulde without installing a model. A clip is bound to the
 * exact sentence it was rendered from: if the page shows a different amount or
 * name, the clip is not used. That is the audio equivalent of the protected
 * value invariant — a clip may never speak a value that is not on screen.
 *
 * Clips marked `blocked` keep their transcript but are never played: the draft
 * is a warning, an error, a colliding control, an echo of the source or a
 * degenerate repetition. The panel states the reason instead of speaking.
 */

export interface AudioClip {
  id: string;
  kind: string;
  risk: string;
  /** The exact Fulfulde sentence the clip was rendered from. */
  text: string;
  file: string;
  sha256: string;
  bytes: number;
  blocked: boolean;
  blockedReason?: string;
}

export interface AudioPack {
  version: string;
  /** ISO 639-3 code the clips were rendered in; a clip never crosses languages. */
  language: string;
  source?: string;
  bitrate?: string;
  total: number;
  spoken: number;
  blocked: number;
  clips: AudioClip[];
}

export type AudioSource =
  | { kind: "clip"; text: string; file: string; id: string }
  | { kind: "tts"; text: string }
  | { kind: "blocked"; text: string; id: string; reason: string }
  | { kind: "unavailable"; text: string };

export interface AudioPlan {
  sources: AudioSource[];
  clips: number;
  tts: number;
  blocked: number;
  unavailable: number;
}

/** Same normalization the translator uses for lookups: whitespace only. */
export function normalizeSpeech(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

export function indexPack(pack: AudioPack | null | undefined): Map<string, AudioClip> {
  const index = new Map<string, AudioClip>();
  if (!pack) return index;
  for (const clip of pack.clips) {
    const key = normalizeSpeech(clip.text);
    if (!key) continue;
    // First writer wins: the pack is sorted by id, so the mapping is stable.
    if (!index.has(key)) index.set(key, clip);
  }
  return index;
}

export function lookupClip(index: Map<string, AudioClip>, text: string): AudioClip | null {
  const key = normalizeSpeech(text);
  if (!key) return null;
  return index.get(key) ?? null;
}

/**
 * Decides, per sentence, whether to play a bundled clip, call the local voice,
 * or stay silent with a reason.
 *
 * A blocked clip never falls back to TTS: the local voice would pronounce the
 * same unsafe draft.
 */
export function planAudioSources(
  index: Map<string, AudioClip>,
  texts: string[],
  options: { voiceReady: boolean },
): AudioPlan {
  const plan: AudioPlan = {
    sources: [],
    clips: 0,
    tts: 0,
    blocked: 0,
    unavailable: 0,
  };

  for (const raw of texts) {
    const text = raw.trim();
    if (!text) continue;
    const clip = lookupClip(index, text);
    if (clip?.blocked) {
      plan.sources.push({
        kind: "blocked",
        text,
        id: clip.id,
        reason: clip.blockedReason ?? "",
      });
      plan.blocked += 1;
      continue;
    }
    if (clip) {
      plan.sources.push({ kind: "clip", text, file: clip.file, id: clip.id });
      plan.clips += 1;
      continue;
    }
    if (options.voiceReady) {
      plan.sources.push({ kind: "tts", text });
      plan.tts += 1;
      continue;
    }
    plan.sources.push({ kind: "unavailable", text });
    plan.unavailable += 1;
  }

  return plan;
}
