import { describe, expect, it } from "vitest";
import { resolveVoicePolicy } from "./voice-policy";

describe("voice policy", () => {
  it("plays bundled Fulfulde clips only for Fulfulde", () => {
    expect(
      resolveVoicePolicy({
        targetLang: "fub",
        voice: "bundled",
        audioLanguage: "fub",
        audioSpoken: 82,
        apiReady: false,
      }),
    ).toEqual({
      targetHasVoice: true,
      bundledVoice: true,
      apiVoice: false,
      audioReady: true,
    });

    expect(
      resolveVoicePolicy({
        targetLang: "ybb",
        voice: "api",
        audioLanguage: "fub",
        audioSpoken: 82,
        apiReady: false,
      }),
    ).toEqual({
      targetHasVoice: true,
      bundledVoice: false,
      apiVoice: false,
      audioReady: false,
    });
  });

  it("enables an API-only language only when the local API is ready", () => {
    expect(
      resolveVoicePolicy({
        targetLang: "ybb",
        voice: "api",
        audioLanguage: "fub",
        audioSpoken: 82,
        apiReady: true,
      }),
    ).toEqual({
      targetHasVoice: true,
      bundledVoice: false,
      apiVoice: true,
      audioReady: true,
    });
  });

  it("never claims a voice for a text-only language", () => {
    expect(
      resolveVoicePolicy({
        targetLang: "ewo",
        voice: "none",
        audioLanguage: undefined,
        audioSpoken: 0,
        apiReady: true,
      }),
    ).toEqual({
      targetHasVoice: false,
      bundledVoice: false,
      apiVoice: false,
      audioReady: false,
    });
  });

  it("does not use a clip pack whose language does not match the target", () => {
    expect(
      resolveVoicePolicy({
        targetLang: "fub",
        voice: "bundled",
        audioLanguage: "ybb",
        audioSpoken: 82,
        apiReady: false,
      }).audioReady,
    ).toBe(false);
  });
});
