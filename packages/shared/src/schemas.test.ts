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
      tmApplied: 7,
      mtApplied: 2,
      protectedCount: 5,
      missed: 1,
      translations: 68,
      mt: { mode: "fallback", state: "ready", provider: "nllb", done: 2, total: 2 },
      sentences: [
        {
          id: "n0",
          source: "Solde disponible",
          target: "FF_TEST",
          status: "applied",
          risk: "high",
          origin: "tm",
        },
        {
          id: "n1",
          source: "Frais",
          target: "FF_FRAIS",
          status: "applied",
          risk: "medium",
          origin: "mt",
          provider: "nllb",
        },
        {
          id: "n2",
          source: "Annuler",
          target: null,
          status: "missed",
          risk: "high",
          holdReason: "label_collision",
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
      tmApplied: 0,
      mtApplied: 0,
      protectedCount: 0,
      missed: 0,
      translations: 0,
      mt: { mode: "off", state: "off", done: 0, total: 0 },
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
  it("accepts French and English UI settings and fills local-API defaults", () => {
    const fr = panelSettingsSchema.parse({ uiLang: "fr", speed: 1 });
    expect(fr.apiTranslation).toBe("fallback");
    expect(fr.mtProvider).toBeNull();
    expect(panelSettingsSchema.safeParse({ uiLang: "en", speed: 0.8 }).success).toBe(true);
  });

  it("accepts an explicit local API mode, provider and Fulfulde UI", () => {
    expect(
      panelSettingsSchema.safeParse({
        uiLang: "fr",
        speed: 1,
        apiTranslation: "primary",
        mtProvider: "nllb",
      }).success,
    ).toBe(true);
    expect(panelSettingsSchema.safeParse({ uiLang: "ff", speed: 1 }).success).toBe(true);
  });

  it("rejects an unsupported speed or mode", () => {
    expect(panelSettingsSchema.safeParse({ uiLang: "fr", speed: 3 }).success).toBe(false);
    expect(panelSettingsSchema.safeParse({ uiLang: "fr", speed: 1, apiTranslation: "x" }).success).toBe(
      false,
    );
  });
});
