import { describe, expect, it } from "vitest";
import {
  type AudioPack,
  indexPack,
  lookupClip,
  normalizeSpeech,
  planAudioSources,
} from "./audio-pack";

const pack: AudioPack = {
  version: "test",
  language: "fub",
  total: 3,
  spoken: 2,
  blocked: 1,
  clips: [
    {
      id: "BALANCE_IS",
      kind: "phrase",
      risk: "high",
      text: "Fedde mon woni 25 000 FCFA .",
      file: "phrase-BALANCE_IS.opus",
      sha256: "a",
      bytes: 1,
      blocked: false,
    },
    {
      id: "BALANCE_IS_OTHER",
      kind: "phrase",
      risk: "high",
      text: "Fedde mon woni 250 000 FCFA .",
      file: "phrase-BALANCE_IS_OTHER.opus",
      sha256: "b",
      bytes: 1,
      blocked: false,
    },
    {
      id: "WARN_PIN",
      kind: "phrase",
      risk: "high",
      text: "Taa ɓe ɓeydana ko'e maɓɓe ɓernde.",
      file: "phrase-WARN_PIN.opus",
      sha256: "c",
      bytes: 1,
      blocked: true,
      blockedReason: "warning or error text is never spoken before validation",
    },
  ],
};

describe("bundled audio pack", () => {
  const index = indexPack(pack);

  it("normalizes whitespace and case for matching", () => {
    expect(normalizeSpeech("  Fedde mon woni  25 000 FCFA . ")).toBe(
      "fedde mon woni 25 000 fcfa .",
    );
  });

  it("matches the exact rendered sentence", () => {
    expect(lookupClip(index, "Fedde mon woni 25 000 FCFA .")?.id).toBe("BALANCE_IS");
  });

  it("never matches a different amount", () => {
    expect(lookupClip(index, "Fedde mon woni 25 001 FCFA .")).toBeNull();
    expect(lookupClip(index, "Fedde mon woni 250 000 FCFA .")?.id).toBe("BALANCE_IS_OTHER");
  });

  it("plays the clip when the voice is offline", () => {
    const plan = planAudioSources(index, ["Fedde mon woni 25 000 FCFA ."], {
      voiceReady: false,
    });
    expect(plan.clips).toBe(1);
    expect(plan.sources[0]).toMatchObject({ kind: "clip", file: "phrase-BALANCE_IS.opus" });
  });

  it("falls back to the local voice for a sentence without a clip", () => {
    const plan = planAudioSources(index, ["Daartol"], { voiceReady: true });
    expect(plan.tts).toBe(1);
    expect(plan.sources[0]).toMatchObject({ kind: "tts", text: "Daartol" });
  });

  it("stays silent with a reason when there is no clip and no voice", () => {
    const plan = planAudioSources(index, ["Daartol"], { voiceReady: false });
    expect(plan.unavailable).toBe(1);
  });

  it("never speaks a blocked draft, even with the voice ready", () => {
    const plan = planAudioSources(index, ["Taa ɓe ɓeydana ko'e maɓɓe ɓernde."], {
      voiceReady: true,
    });
    expect(plan.blocked).toBe(1);
    expect(plan.tts).toBe(0);
    expect(plan.sources[0]).toMatchObject({ kind: "blocked", id: "WARN_PIN" });
  });

  it("tolerates an empty pack", () => {
    const empty = indexPack(undefined);
    const plan = planAudioSources(empty, ["Fedde mon woni 25 000 FCFA ."], {
      voiceReady: false,
    });
    expect(plan.unavailable).toBe(1);
  });
});
