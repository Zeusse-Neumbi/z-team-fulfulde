import { describe, expect, it } from "vitest";
import { languageCodes, languages } from "./generated";

describe("generated language packs", () => {
  it("emits every registry language and never marks a draft as validated", () => {
    expect([...languageCodes].sort()).toEqual(["fub", "ybb"]);
    for (const code of languageCodes) {
      const pack = languages[code];
      expect(pack?.code).toBe(code);
      expect(pack?.endonym).toBeTruthy();
      expect(Object.keys(pack?.names ?? {}).length).toBeGreaterThan(0);
      expect(pack?.speech.provider).toBe("mms");
      expect(pack?.status).toBe("draft");
      expect(pack?.packValidated).toBe(false);
      expect(pack?.translationUnits.length).toBeGreaterThan(0);
      expect(pack?.phrases.length).toBeGreaterThan(0);
    }
  });
});
