import type { TranslationStatus } from "@zteam/shared";
import { describe, expect, it } from "vitest";
import { buildSpeechPlan, safeSpeechTexts } from "./speech";

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

const strings = {
  step: "Étape",
  stepLabels: {
    1: "Solde",
    2: "Frais",
    3: "Bénéficiaire",
    4: "Récapitulatif",
    5: "Confirmation",
  } as const,
  valuesNote: "Les montants restent affichés à l'écran.",
  amountLabel: "Montant",
  feeLabel: "Frais",
  actionsNote: "Actions possibles ci-dessous.",
  noContent: "Aucun texte disponible.",
};

const summaryStatus: TranslationStatus = {
  ...base,
  sentences: [
    {
      id: "s1",
      source: "Votre solde est de 250 000 FCFA.",
      target: "Solde maa ko 250 000 FCFA.",
      status: "applied",
      risk: "high",
    },
    {
      id: "s2",
      source: "Votre solde",
      target: "Solde maa",
      status: "applied",
      risk: "low",
    },
    {
      id: "s3",
      source: "Ne partagez jamais votre code secret.",
      target: "Taa haba code maa.",
      status: "applied",
      risk: "high",
    },
    {
      id: "s4",
      source: "Votre solde",
      target: "Solde maa",
      status: "applied",
      risk: "low",
    },
    {
      id: "s5",
      source: "Frais",
      target: null,
      status: "missed",
      risk: "unknown",
    },
  ],
  protectedValues: [{ value: "250 000 FCFA", kind: "amount" }],
  actions: [
    { id: "a1", name: "Voir les frais", role: "button", risk: "medium", enabled: true, locked: false },
    { id: "a2", name: "Confirmer", role: "button", risk: "high", enabled: true, locked: false },
    { id: "a3", name: "Cocher", role: "checkbox", risk: "high", enabled: true, locked: true },
    { id: "a4", name: "Annuler", role: "button", risk: "low", enabled: false, locked: false },
  ],
};

describe("buildSpeechPlan", () => {
  it("summarises step, facts, warnings and actions instead of every sentence", () => {
    const plan = buildSpeechPlan(summaryStatus, strings);
    const kinds = plan.items.map((item) => item.kind);
    expect(kinds[0]).toBe("step");
    expect(kinds).toContain("fact");
    expect(kinds).toContain("warning");
    expect(kinds.filter((kind) => kind === "action")).toHaveLength(2);
    expect(plan.items.length).toBeLessThan(summaryStatus.sentences.length + 4);
  });

  it("never sends a sentence containing a protected value to TTS", () => {
    const plan = buildSpeechPlan(summaryStatus, strings);
    expect(plan.spoken.join(" ")).not.toContain("250 000 FCFA");
    expect(plan.skippedValues).toBe(1);
    expect(plan.items.some((item) => item.kind === "note" && /montants/.test(item.text))).toBe(
      true,
    );
  });

  it("orders high risk actions first and ignores locked or disabled ones", () => {
    const plan = buildSpeechPlan(summaryStatus, strings);
    const actions = plan.items.filter((item) => item.kind === "action").map((item) => item.text);
    expect(actions[0]).toBe("Confirmer");
    expect(actions).not.toContain("Cocher");
    expect(actions).not.toContain("Annuler");
  });

  it("deduplicates repeated sentences", () => {
    const plan = buildSpeechPlan(summaryStatus, strings);
    const facts = plan.items.filter((item) => item.kind === "fact").map((item) => item.text);
    expect(new Set(facts).size).toBe(facts.length);
    expect(facts.filter((text) => text === "Solde maa")).toHaveLength(1);
  });

  it("falls back to the first safe sentence when there is no fact label", () => {
    const status: TranslationStatus = {
      ...base,
      step: "unknown",
      sentences: [
        {
          id: "x1",
          source: "Bienvenue",
          target: "Barka",
          status: "applied",
          risk: "low",
        },
      ],
      protectedValues: [],
      actions: [],
    };
    const plan = buildSpeechPlan(status, strings);
    expect(plan.items[0]).toMatchObject({ kind: "fact", text: "Barka" });
  });

  it("respects the item cap", () => {
    const plan = buildSpeechPlan(summaryStatus, strings, { maxItems: 2 });
    expect(plan.items).toHaveLength(2);
  });

  it("does not speak an action name that contains a protected value", () => {
    const status: TranslationStatus = {
      ...base,
      sentences: [],
      protectedValues: [{ value: "CM 999", kind: "account" }],
      actions: [
        {
          id: "a9",
          name: "Envoyer vers CM 999",
          role: "button",
          risk: "high",
          enabled: true,
          locked: false,
        },
      ],
    };
    const plan = buildSpeechPlan(status, strings);
    expect(plan.items.some((item) => item.text === "Envoyer vers CM 999")).toBe(true);
    expect(plan.spoken).not.toContain("Envoyer vers CM 999");
  });
});

describe("buildSpeechPlan with spoken values", () => {
  it("speaks the exact amount when the local voice opts in", () => {
    const plan = buildSpeechPlan(summaryStatus, strings, { allowValues: true });
    const spoken = plan.spoken.join(" | ");
    expect(spoken).toContain("Montant 250 000 FCFA");
    expect(plan.skippedValues).toBe(0);
    expect(plan.items.some((item) => item.kind === "note" && /montants/.test(item.text))).toBe(
      false,
    );
  });

  it("keeps the value byte-identical in the plan text", () => {
    const plan = buildSpeechPlan(summaryStatus, strings, { allowValues: true });
    const fact = plan.items.find((item) => item.text.includes("250 000 FCFA"));
    expect(fact?.text).toContain("250 000 FCFA");
    expect(fact?.speakable).toBe(true);
  });
});

describe("buildSpeechPlan identifier safety", () => {
  it("still refuses an account number when amounts are allowed", () => {
    const status: TranslationStatus = {
      ...base,
      sentences: [
        {
          id: "acc",
          source: "Numéro de compte : CM 999 8887 7776 55",
          target: "Limngal ceede : CM 999 8887 7776 55",
          status: "applied",
          risk: "high",
        },
      ],
      protectedValues: [
        { value: "CM 999 8887 7776 55", kind: "account" },
        { value: "250 000 FCFA", kind: "amount" },
      ],
      actions: [],
    };
    const plan = buildSpeechPlan(status, strings, { allowValues: true });
    expect(plan.spoken.join(" ")).toContain("Montant 250 000 FCFA");
    expect(plan.spoken.join(" ")).not.toContain("CM 999 8887 7776 55");
  });
});
