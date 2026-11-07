import { describe, expect, it } from "vitest";
import { translationUnitSchema } from "./schemas";

describe("translationUnitSchema", () => {
  it("accepts a validated unit", () => {
    const result = translationUnitSchema.safeParse({
      id: "tm.balance.available",
      source: { fr: "Solde disponible", en: "Available balance" },
      target: { ff: "..." },
      risk: "high",
      validatedBy: ["speaker_1", "speaker_2"],
      backTranslationFr: "Available balance",
      version: "2026-11-09.1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing source", () => {
    const result = translationUnitSchema.safeParse({
      id: "x",
      target: { ff: "" },
      risk: "high",
      validatedBy: [],
      backTranslationFr: "",
      version: "1",
    });
    expect(result.success).toBe(false);
  });
});
