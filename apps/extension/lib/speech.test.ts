import type { TranslationStatus } from "@zteam/shared";
import { describe, expect, it } from "vitest";
import { safeSpeechTexts } from "./speech";

const base: TranslationStatus = {
  active: true,
  url: "http://127.0.0.1:4173/journey/",
  title: "Test",
  step: 4,
  language: "fr",
  coverage: 1,
  applied: 3,
  protectedCount: 2,
  missed: 0,
  translations: 10,
  sentences: [
    {
      id: "n0",
      source: "Solde disponible",
      target: "FF_SOLDE",
      status: "applied",
      risk: "high",
    },
    {
      id: "n1",
      source: "Numéro de compte : CM 999 8887 7776 55",
      target: "FF_COMPTE CM 999 8887 7776 55",
      status: "applied",
      risk: "high",
    },
    {
      id: "n2",
      source: "Frais",
      target: null,
      status: "missed",
      risk: "unknown",
    },
  ],
  protectedValues: [
    { value: "CM 999 8887 7776 55", kind: "account" },
    { value: "175 000 FCFA", kind: "amount" },
  ],
  actions: [],
  actionSnapshotId: "",
  aborted: false,
};

describe("safeSpeechTexts", () => {
  it("keeps safe labels and drops sentences containing a protected value", () => {
    expect(safeSpeechTexts(base)).toEqual(["FF_SOLDE"]);
  });

  it("returns nothing when every translated sentence contains a value", () => {
    const status: TranslationStatus = {
      ...base,
      sentences: [base.sentences[1]!],
    };
    expect(safeSpeechTexts(status)).toEqual([]);
  });

  it("honours the segment limit", () => {
    const status: TranslationStatus = {
      ...base,
      sentences: Array.from({ length: 20 }, (_, index) => ({
        id: `n${index}`,
        source: `Label ${index}`,
        target: `FF_${index}`,
        status: "applied" as const,
        risk: "low" as const,
      })),
    };
    expect(safeSpeechTexts(status, 3)).toHaveLength(3);
  });
});
