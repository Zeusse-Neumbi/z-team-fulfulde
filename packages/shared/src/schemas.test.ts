import { describe, expect, it } from "vitest";
import {
  panelSettingsSchema,
  readbackSchema,
  translationStatusSchema,
  translationUnitSchema,
} from "./schemas";

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

describe("translationStatusSchema", () => {
  it("accepts the panel status contract", () => {
    const result = translationStatusSchema.safeParse({
      active: true,
      url: "https://safinum.cm/hackathon-test",
      title: "Test",
      step: 4,
      language: "fr",
      coverage: 0.9,
      applied: 9,
      protectedCount: 5,
      missed: 1,
      translations: 68,
      sentences: [
        {
          id: "n0",
          source: "Solde disponible",
          target: "FF_TEST",
          status: "applied",
          risk: "high",
        },
      ],
      protectedValues: [{ value: "250 000 FCFA", kind: "amount", reason: "value" }],
      actions: [
        {
          id: "a_1",
          name: "Continuer",
          role: "button",
          risk: "medium",
          enabled: true,
          locked: false,
        },
      ],
      actionSnapshotId: "snap-1",
      aborted: false,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a coverage above one", () => {
    const result = translationStatusSchema.safeParse({
      active: false,
      url: "",
      title: "",
      step: "unknown",
      language: "unknown",
      coverage: 1.2,
      applied: 0,
      protectedCount: 0,
      missed: 0,
      translations: 0,
      sentences: [],
      protectedValues: [],
      actions: [],
      actionSnapshotId: "",
      aborted: false,
    });
    expect(result.success).toBe(false);
  });
});

describe("readbackSchema", () => {
  it("accepts exact values", () => {
    expect(
      readbackSchema.safeParse({
        amount: "25 000 FCFA",
        fee: "0 FCFA",
        total: "25 000 FCFA",
        reference: "SAF-2026-AB12CD",
      }).success,
    ).toBe(true);
  });
});

describe("panelSettingsSchema", () => {
  it("accepts French and English UI settings", () => {
    expect(panelSettingsSchema.safeParse({ uiLang: "fr", speed: 1 }).success).toBe(true);
    expect(panelSettingsSchema.safeParse({ uiLang: "en", speed: 0.8 }).success).toBe(true);
  });

  it("rejects an unsupported speed", () => {
    expect(panelSettingsSchema.safeParse({ uiLang: "fr", speed: 3 }).success).toBe(false);
  });
});
