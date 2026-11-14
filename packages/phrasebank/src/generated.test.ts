import { describe, expect, it } from "vitest";
import { languageCodes, languages } from "./generated";

describe("generated language packs", () => {
  it("emits every registry language and never marks a draft as validated", () => {
    expect(languageCodes).toEqual(expect.arrayContaining(["fub", "ybb"]));
    expect(new Set(languageCodes).size).toBe(languageCodes.length);
    for (const code of languageCodes) {
      expect(code).toMatch(/^[a-z]{3}$/);
      const pack = languages[code];
      expect(pack?.code).toBe(code);
      expect(pack?.endonym).toBeTruthy();
      expect(Object.keys(pack?.names ?? {}).length).toBeGreaterThan(0);
      expect(typeof pack?.speech.provider).toBe("string");
      expect(["validated", "draft", "text-only"]).toContain(pack?.status);
      if (pack?.status !== "validated") expect(pack?.packValidated).toBe(false);
      expect(pack?.translationUnits.length).toBeGreaterThan(0);
      expect(pack?.phrases.length).toBeGreaterThan(0);
    }
  });
});
