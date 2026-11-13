import { describe, expect, it } from "vitest";
import { loadAll, releaseErrors } from "./loader";

describe("phrasebank data", () => {
  const data = loadAll();

  it("loads the seed translation memory", () => {
    expect(data.translationUnits.length).toBeGreaterThan(10);
    expect(new Set(data.translationUnits.map((u) => u.id)).size).toBe(
      data.translationUnits.length,
    );
  });

  it("loads the seed spoken phrases", () => {
    expect(data.phrases.length).toBeGreaterThan(5);
    expect(new Set(data.phrases.map((p) => p.id)).size).toBe(data.phrases.length);
  });

  it("reports unvalidated high-risk entries in development", () => {
    expect(data.warnings.length).toBeGreaterThan(0);
  });

  it("blocks a release while high-risk entries are unvalidated", () => {
    expect(releaseErrors(data).length).toBeGreaterThan(0);
  });

  it("marks the default pack as validated-source and unvalidated in content", () => {
    expect(data.packSource).toBe("validated");
    expect(releaseErrors(data).length).toBeGreaterThan(0);
  });
});

describe("machine-translated candidate pack", () => {
  it("loads the mt pack without turning it into a validated release", () => {
    const previous = process.env.ZTEAM_PHRASEBANK;
    process.env.ZTEAM_PHRASEBANK = "mt";
    try {
      const data = loadAll();
      expect(data.packSource).toBe("mt");
      expect(data.tmVersion).toContain("+mt");
      expect(data.translationUnits.length).toBeGreaterThan(10);
      expect(data.translationUnits.every((unit) => unit.target.ff.length > 0)).toBe(true);
      expect(data.translationUnits.every((unit) => unit.validatedBy.length === 0)).toBe(true);
      expect(releaseErrors(data).length).toBeGreaterThan(0);
    } finally {
      if (previous === undefined) delete process.env.ZTEAM_PHRASEBANK;
      else process.env.ZTEAM_PHRASEBANK = previous;
    }
  });
});
