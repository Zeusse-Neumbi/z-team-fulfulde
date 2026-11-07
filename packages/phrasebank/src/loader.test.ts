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
});
