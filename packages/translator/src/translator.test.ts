import type { TranslationUnit } from "@zteam/shared";
import { describe, expect, it } from "vitest";
import { computeCoverage } from "./coverage";
import { DomTranslator } from "./dom-translator";
import { normalizeSource, normalizeValue } from "./normalize";
import type { Vault } from "./protected";
import { TranslationMemory } from "./tm";

function unit(partial: Partial<TranslationUnit> & Pick<TranslationUnit, "id">): TranslationUnit {
  const { id, ...rest } = partial;
  return {
    id,
    source: { fr: "", en: "" },
    target: { ff: "" },
    risk: "low",
    validatedBy: ["speaker_1"],
    backTranslationFr: "",
    version: "test",
    ...rest,
  };
}

const vault: Vault = {
  values: () => [
    {
      value: "250 000 FCFA",
      normalized: normalizeValue("250 000 FCFA"),
      kind: "amount",
    },
    {
      value: "CM 001 2345 6789 01",
      normalized: normalizeValue("CM 001 2345 6789 01"),
      kind: "account",
    },
  ],
};

describe("normalize", () => {
  it("collapses whitespace and NFKC", () => {
    expect(normalizeSource("  Solde\u00A0 disponible  ")).toBe("Solde disponible");
  });

  it("strips currency, spaces and punctuation for value comparison", () => {
    expect(normalizeValue("250\u202F000 FCFA")).toBe("250000");
    expect(normalizeValue("250,000 XAF")).toBe("250000");
    expect(normalizeValue("CM 001 2345 6789 01")).toBe("cm0012345678901");
  });
});

describe("TranslationMemory", () => {
  it("matches exact source strings", () => {
    const tm = new TranslationMemory([
      unit({
        id: "tm.balance.available",
        source: { fr: "Solde disponible", en: "Available balance" },
        target: { ff: "FF_SOLDE" },
      }),
    ]);
    expect(tm.lookup("Solde disponible")?.target).toBe("FF_SOLDE");
    expect(tm.lookup("Available balance")?.target).toBe("FF_SOLDE");
  });

  it("fills placeholders from a mixed source string", () => {
    const tm = new TranslationMemory([
      unit({
        id: "tm.account.line",
        source: {
          fr: "Numéro de compte : {account}",
          en: "Account number: {account}",
        },
        target: { ff: "Namba konte : {account}" },
        placeholders: ["account"],
      }),
    ]);
    expect(tm.lookup("Numéro de compte : CM 001 2345 6789 01")?.target).toBe(
      "Namba konte : CM 001 2345 6789 01",
    );
  });
});

describe("DomTranslator", () => {
  it("leaves an exact value node untouched", () => {
    document.body.innerHTML = `<p id="balance">250 000 FCFA</p>`;
    const translator = new DomTranslator();
    const tm = new TranslationMemory([
      unit({
        id: "tm.balance",
        source: { fr: "250 000 FCFA", en: "250,000 FCFA" },
        target: { ff: "FF_SOLDE" },
      }),
    ]);
    const stats = translator.translate(document.body, tm, vault);
    expect(document.getElementById("balance")?.textContent).toBe("250 000 FCFA");
    expect(stats.applied).toBe(0);
    expect(stats.protectedCount).toBe(1);
  });

  it("translates a label while preserving the embedded account number", () => {
    document.body.innerHTML = `<p id="account">Numéro de compte : CM 001 2345 6789 01</p>`;
    const translator = new DomTranslator();
    const tm = new TranslationMemory([
      unit({
        id: "tm.account.line",
        source: { fr: "Numéro de compte : {account}", en: "Account number: {account}" },
        target: { ff: "Namba konte : {account}" },
        placeholders: ["account"],
        risk: "high",
      }),
    ]);
    const stats = translator.translate(document.body, tm, vault);
    expect(document.getElementById("account")?.textContent).toBe(
      "Namba konte : CM 001 2345 6789 01",
    );
    expect(stats.applied).toBe(1);
  });

  it("applies a translation and restores the original", () => {
    document.body.innerHTML = `<p id="label">Solde disponible</p>`;
    const translator = new DomTranslator();
    const tm = new TranslationMemory([
      unit({
        id: "tm.balance.available",
        source: { fr: "Solde disponible", en: "Available balance" },
        target: { ff: "FF_SOLDE" },
        risk: "high",
      }),
    ]);
    translator.translate(document.body, tm, vault);
    expect(document.getElementById("label")?.textContent).toBe("FF_SOLDE");
    translator.restore(document.body);
    expect(document.getElementById("label")?.textContent).toBe("Solde disponible");
  });

  it("preserves leading and trailing whitespace", () => {
    document.body.innerHTML = `<p id="label">  Solde disponible  </p>`;
    const translator = new DomTranslator();
    const tm = new TranslationMemory([
      unit({
        id: "tm.balance.available",
        source: { fr: "Solde disponible", en: "Available balance" },
        target: { ff: "FF_SOLDE" },
        risk: "high",
      }),
    ]);
    translator.translate(document.body, tm, vault);
    expect(document.getElementById("label")?.textContent).toBe("  FF_SOLDE  ");
  });
});

describe("label collision guard", () => {
  const collidingTm = () =>
    new TranslationMemory([
      unit({
        id: "tm.action.confirm",
        source: { fr: "Confirmer", en: "Confirm" },
        target: { ff: "FF_SAME" },
        risk: "high",
      }),
      unit({
        id: "tm.action.cancel",
        source: { fr: "Annuler", en: "Cancel" },
        target: { ff: "FF_SAME" },
        risk: "high",
      }),
      unit({
        id: "tm.step.fees",
        source: { fr: "Frais", en: "Fees" },
        target: { ff: "FF_FRAIS" },
        risk: "low",
      }),
    ]);

  it("keeps two controls with the same draft label in the source language", () => {
    document.body.innerHTML = `
      <button id="confirm">Confirmer</button>
      <button id="cancel">Annuler</button>
      <p id="fees">Frais</p>`;
    const translator = new DomTranslator();
    const stats = translator.translate(document.body, collidingTm(), vault);

    expect(document.getElementById("confirm")?.textContent).toBe("Confirmer");
    expect(document.getElementById("cancel")?.textContent).toBe("Annuler");
    expect(document.getElementById("fees")?.textContent).toBe("FF_FRAIS");
    expect(stats.labelCollisions).toBe(2);
    expect(stats.applied).toBe(1);
    expect(stats.missed).toBe(2);
    expect(stats.coverage).toBeCloseTo(1 / 3, 5);
    expect(stats.sentences.filter((sentence) => sentence.holdReason === "label_collision")).toHaveLength(2);
    expect(stats.sentences.every((sentence) => sentence.status !== "missed" || sentence.target === null)).toBe(true);
  });

  it("does not hold the same source repeated in two places", () => {
    document.body.innerHTML = `
      <button id="one">Frais</button>
      <button id="two">Frais</button>`;
    const translator = new DomTranslator();
    const stats = translator.translate(document.body, collidingTm(), vault);

    expect(document.getElementById("one")?.textContent).toBe("FF_FRAIS");
    expect(document.getElementById("two")?.textContent).toBe("FF_FRAIS");
    expect(stats.labelCollisions).toBe(0);
    expect(stats.applied).toBe(2);
  });

  it("still translates colliding prose that is not a control", () => {
    document.body.innerHTML = `<p id="a">Confirmer</p><p id="b">Annuler</p>`;
    const proseTm = new TranslationMemory([
      unit({
        id: "tm.step.one",
        source: { fr: "Confirmer", en: "Confirm" },
        target: { ff: "FF_SAME" },
        risk: "high",
      }),
      unit({
        id: "tm.step.two",
        source: { fr: "Annuler", en: "Cancel" },
        target: { ff: "FF_SAME" },
        risk: "high",
      }),
    ]);
    const translator = new DomTranslator();
    const stats = translator.translate(document.body, proseTm, vault);

    expect(document.getElementById("a")?.textContent).toBe("FF_SAME");
    expect(document.getElementById("b")?.textContent).toBe("FF_SAME");
    expect(stats.labelCollisions).toBe(0);
    expect(stats.applied).toBe(2);
  });

  it("holds a control label even when the control markup is not semantic", () => {
    document.body.innerHTML = `<span id="confirm">Confirmer</span><span id="cancel">Annuler</span>`;
    const translator = new DomTranslator();
    const stats = translator.translate(document.body, collidingTm(), vault);

    expect(document.getElementById("confirm")?.textContent).toBe("Confirmer");
    expect(stats.labelCollisions).toBe(2);
  });

  it("treats a role=button element as a control", () => {
    document.body.innerHTML = `
      <div role="button" id="confirm">Confirmer</div>
      <div role="button" id="cancel">Annuler</div>`;
    const translator = new DomTranslator();
    const stats = translator.translate(document.body, collidingTm(), vault);

    expect(document.getElementById("confirm")?.textContent).toBe("Confirmer");
    expect(document.getElementById("cancel")?.textContent).toBe("Annuler");
    expect(stats.labelCollisions).toBe(2);
  });
});

describe("computeCoverage", () => {
  it("computes the share of changed baseline text nodes", () => {
    expect(computeCoverage(["Solde disponible", "Frais"], ["FF_SOLDE", "Frais"])).toBe(0.5);
  });

  it("returns 0 for an empty baseline", () => {
    expect(computeCoverage([], [])).toBe(0);
  });
});
