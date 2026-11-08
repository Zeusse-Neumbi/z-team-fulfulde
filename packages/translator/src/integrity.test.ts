import type { PlaceholderKind, ProtectedReason, TranslationUnit } from "@zteam/shared";
import { describe, expect, it } from "vitest";
import { DomTranslator } from "./dom-translator";
import { normalizeValue } from "./normalize";
import { findValueMatches } from "./patterns";
import { addPatternValues, vaultFrom, type VaultValue } from "./protected";
import { TranslationMemory } from "./tm";

function unit(
  partial: Partial<TranslationUnit> & Pick<TranslationUnit, "id" | "source" | "target">,
): TranslationUnit {
  return {
    risk: "high",
    validatedBy: ["speaker_1"],
    backTranslationFr: "",
    version: "test",
    ...partial,
  };
}

function value(value: string, kind: PlaceholderKind, reason?: ProtectedReason): VaultValue {
  return { value, kind, reason, normalized: normalizeValue(value) };
}

function vault(...values: VaultValue[]) {
  return vaultFrom(values);
}

function body(html: string): HTMLElement {
  document.body.innerHTML = html;
  return document.body;
}

describe("findValueMatches", () => {
  it.each([
    ["250 000 FCFA", "250000"],
    ["25\u202F375 FCFA", "25375"],
    ["250,000 XAF", "250000"],
    ["-12 500 FCFA", "-12500"],
  ])("finds the amount in %s", (text, normalized) => {
    const matches = findValueMatches(text);
    expect(matches.some((match) => match.kind === "amount")).toBe(true);
    expect(matches.map((match) => normalizeValue(match.value))).toContain(normalized);
  });

  it("finds the account number inside a label", () => {
    const matches = findValueMatches("Numéro de compte : CM 001 2345 6789 01");
    expect(matches).toContainEqual({ value: "CM 001 2345 6789 01", kind: "account" });
  });

  it("covers repeated account values before scanning for phones", () => {
    const matches = findValueMatches(
      "CM 001 2345 6789 01 and CM 001 2345 6789 01",
    );
    expect(matches.filter((match) => match.kind === "account")).toHaveLength(1);
    expect(matches.some((match) => match.kind === "phone")).toBe(false);
  });

  it("does not add a phone substring inside an account number", () => {
    const matches = findValueMatches("Numéro de compte : CM 001 2345 6789 01");
    expect(matches.some((match) => match.kind === "account")).toBe(true);
    expect(matches.some((match) => match.kind === "phone")).toBe(false);
  });

  it("finds a reference", () => {
    expect(findValueMatches("Référence SAF-2026-AB12CD")).toContainEqual({
      value: "SAF-2026-AB12CD",
      kind: "reference",
    });
  });

  it.each(["+237 6 99 12 34 56", "+237 6 77 88 99 00", "6 99 12 34 56"])(
    "finds the phone %s",
    (phone) => {
      expect(findValueMatches(phone).some((match) => match.kind === "phone")).toBe(true);
    },
  );

  it.each(["05 nov. 2026", "05/11/2026", "Nov 5, 2026", "31 oct. 2026"])(
    "finds the date %s",
    (date) => {
      expect(findValueMatches(date).some((match) => match.kind === "date")).toBe(true);
    },
  );

  it("finds an error code", () => {
    expect(findValueMatches("AMOUNT_002")).toContainEqual({ value: "AMOUNT_002", kind: "other" });
  });

  it("finds the currency token without a number", () => {
    expect(findValueMatches("FCFA")).toContainEqual({ value: "FCFA", kind: "other" });
  });
});

describe("addPatternValues", () => {
  it("adds the value substring, never the whole mixed sentence", () => {
    const values: VaultValue[] = [];
    addPatternValues(values, "Numéro de compte : CM 001 2345 6789 01");
    expect(values.map((item) => item.value)).toContain("CM 001 2345 6789 01");
    expect(values.map((item) => item.value)).not.toContain(
      "Numéro de compte : CM 001 2345 6789 01",
    );
  });

  it("keeps a standalone currency token in the vault", () => {
    const values: VaultValue[] = [];
    addPatternValues(values, "FCFA");
    expect(values.find((item) => item.value === "FCFA")?.normalized).toBe("fcfa");
  });

  it("marks an error code with the code reason", () => {
    const values: VaultValue[] = [];
    addPatternValues(values, "AMOUNT_002");
    expect(values.find((item) => item.value === "AMOUNT_002")?.reason).toBe("code");
  });
});

describe("DomTranslator values", () => {
  it("leaves a displayed amount untouched", () => {
    body(`<p id="balance">250 000 FCFA</p>`);
    const translator = new DomTranslator();
    const tm = new TranslationMemory([
      unit({
        id: "tm.amount",
        source: { fr: "250 000 FCFA", en: "250,000 FCFA" },
        target: { ff: "FF_AMOUNT" },
      }),
    ]);
    const stats = translator.translate(
      document.body,
      tm,
      vault(value("250 000 FCFA", "amount")),
    );
    expect(document.getElementById("balance")?.textContent).toBe("250 000 FCFA");
    expect(stats.applied).toBe(0);
    expect(stats.protectedCount).toBe(1);
  });

  it("protects a pure numeric amount or date", () => {
    body(`<p id="number">250000</p><p id="date">05/11/2026</p><p id="step">1</p>`);
    const translator = new DomTranslator();
    const tm = new TranslationMemory([
      unit({
        id: "tm.number",
        source: { fr: "250000", en: "250,000" },
        target: { ff: "FF_NUMBER" },
      }),
    ]);
    const stats = translator.translate(document.body, tm, vault());
    expect(document.getElementById("number")?.textContent).toBe("250000");
    expect(document.getElementById("date")?.textContent).toBe("05/11/2026");
    expect(stats.protectedCount).toBe(2);
    expect(stats.applied).toBe(0);
  });

  it("leaves a standalone currency token untouched", () => {
    body(`<p id="currency">FCFA</p>`);
    const translator = new DomTranslator();
    const tm = new TranslationMemory([
      unit({
        id: "tm.currency",
        source: { fr: "FCFA", en: "FCFA" },
        target: { ff: "FF_CURRENCY" },
      }),
    ]);
    const stats = translator.translate(
      document.body,
      tm,
      vault({ value: "FCFA", kind: "other", normalized: "fcfa" }),
    );
    expect(document.getElementById("currency")?.textContent).toBe("FCFA");
    expect(stats.protectedCount).toBe(1);
  });

  it("leaves a name untouched", () => {
    body(`<p id="name">Amina Ngo Bell</p>`);
    const translator = new DomTranslator();
    const tm = new TranslationMemory([
      unit({
        id: "tm.name",
        source: { fr: "Amina Ngo Bell", en: "Amina Ngo Bell" },
        target: { ff: "FF_NAME" },
      }),
    ]);
    const stats = translator.translate(
      document.body,
      tm,
      vault(value("Amina Ngo Bell", "person")),
    );
    expect(document.getElementById("name")?.textContent).toBe("Amina Ngo Bell");
    expect(stats.protectedCount).toBe(1);
  });

  it("leaves user input protected", () => {
    body(`<p id="input" contenteditable="true">Paiement de services</p>`);
    const translator = new DomTranslator();
    const tm = new TranslationMemory([
      unit({
        id: "tm.reason",
        source: { fr: "Paiement de services", en: "Payment for services" },
        target: { ff: "FF_REASON" },
      }),
    ]);
    const stats = translator.translate(document.body, tm, vault());
    expect(document.getElementById("input")?.textContent).toBe("Paiement de services");
    expect(stats.protectedCount).toBe(1);
  });

  it("ignores script, style and hidden nodes", () => {
    body(`<script>Solde</script><style>.x{}</style><p style="display:none">Frais</p>`);
    const translator = new DomTranslator();
    const tm = new TranslationMemory([
      unit({
        id: "tm.solde",
        source: { fr: "Solde", en: "Balance" },
        target: { ff: "FF_SOLDE" },
      }),
    ]);
    const stats = translator.translate(document.body, tm, vault());
    expect(stats.applied).toBe(0);
    expect(stats.protectedCount).toBe(0);
    expect(document.querySelector("p")?.textContent).toBe("Frais");
  });

  it("keeps a mixed account line byte-identical", () => {
    body(`<p id="account">Numéro de compte : CM 001 2345 6789 01</p>`);
    const translator = new DomTranslator();
    const tm = new TranslationMemory([
      unit({
        id: "tm.account.line",
        source: { fr: "Numéro de compte : {account}", en: "Account number : {account}" },
        target: { ff: "FF_COMPTE : {account}" },
      }),
    ]);
    const stats = translator.translate(
      document.body,
      tm,
      vault(value("CM 001 2345 6789 01", "account")),
    );
    expect(document.getElementById("account")?.textContent).toBe(
      "FF_COMPTE : CM 001 2345 6789 01",
    );
    expect(stats.applied).toBe(1);
  });

  it("rejects a mixed target that drops the value", () => {
    body(`<p id="account">Numéro de compte : CM 001 2345 6789 01</p>`);
    const translator = new DomTranslator();
    const tm = new TranslationMemory([
      unit({
        id: "tm.account.line",
        source: { fr: "Numéro de compte : {account}", en: "Account number : {account}" },
        target: { ff: "FF_COMPTE" },
      }),
    ]);
    const stats = translator.translate(
      document.body,
      tm,
      vault(value("CM 001 2345 6789 01", "account")),
    );
    expect(stats.aborted).toBe(true);
    expect(stats.abortReason).toBe("mixed_value_missing");
    expect(document.getElementById("account")?.textContent).toBe(
      "Numéro de compte : CM 001 2345 6789 01",
    );
  });

  it("rejects a target that introduces a new amount", () => {
    body(`<p id="total">Total : 25 000 FCFA</p>`);
    const translator = new DomTranslator();
    const tm = new TranslationMemory([
      unit({
        id: "tm.total",
        source: { fr: "Total : {amount}", en: "Total: {amount}" },
        target: { ff: "FF_TOTAL : 25 000 FCFA + 30 000 FCFA" },
      }),
    ]);
    const stats = translator.translate(
      document.body,
      tm,
      vault(value("25 000 FCFA", "amount")),
    );
    expect(stats.aborted).toBe(true);
    expect(stats.abortReason).toBe("target_value_mismatch");
    expect(document.getElementById("total")?.textContent).toBe("Total : 25 000 FCFA");
  });

  it("allows an exact mixed entry when the brand is preserved", () => {
    body(`<p id="footer">Safinum Pay — environnement de démonstration.</p>`);
    const translator = new DomTranslator();
    const tm = new TranslationMemory([
      unit({
        id: "tm.footer",
        source: {
          fr: "Safinum Pay — environnement de démonstration.",
          en: "Safinum Pay — demonstration environment.",
        },
        target: { ff: "FF Safinum Pay — démonstration." },
      }),
    ]);
    const stats = translator.translate(document.body, tm, vault(value("Safinum", "other")));
    expect(stats.aborted).toBe(false);
    expect(document.getElementById("footer")?.textContent).toBe(
      "FF Safinum Pay — démonstration.",
    );
  });

  it("rejects an exact mixed entry that drops the brand", () => {
    body(`<p id="footer">Safinum Pay — environnement de démonstration.</p>`);
    const translator = new DomTranslator();
    const tm = new TranslationMemory([
      unit({
        id: "tm.footer",
        source: {
          fr: "Safinum Pay — environnement de démonstration.",
          en: "Safinum Pay — demonstration environment.",
        },
        target: { ff: "FF — démonstration." },
      }),
    ]);
    const stats = translator.translate(document.body, tm, vault(value("Safinum", "other")));
    expect(stats.aborted).toBe(true);
    expect(stats.abortReason).toBe("mixed_value_missing");
    expect(document.getElementById("footer")?.textContent).toBe(
      "Safinum Pay — environnement de démonstration.",
    );
  });

  it("keeps a mixed target that preserves the amount", () => {
    body(`<p id="total">Total : 25 000 FCFA</p>`);
    const translator = new DomTranslator();
    const tm = new TranslationMemory([
      unit({
        id: "tm.total",
        source: { fr: "Total : {amount}", en: "Total: {amount}" },
        target: { ff: "FF_TOTAL : {amount}" },
      }),
    ]);
    const stats = translator.translate(
      document.body,
      tm,
      vault(value("25 000 FCFA", "amount")),
    );
    expect(stats.aborted).toBe(false);
    expect(document.getElementById("total")?.textContent).toBe("FF_TOTAL : 25 000 FCFA");
  });
});

describe("DomTranslator passes", () => {
  function setup() {
    body(`<p id="label">  Solde disponible  </p><p id="amount">250 000 FCFA</p>`);
    const translator = new DomTranslator();
    const tm = new TranslationMemory([
      unit({
        id: "tm.balance.available",
        source: { fr: "Solde disponible", en: "Available balance" },
        target: { ff: "FF_SOLDE" },
      }),
    ]);
    const vaultValue = vault(value("250 000 FCFA", "amount"));
    return { translator, tm, vaultValue };
  }

  it("preserves leading and trailing whitespace", () => {
    const { translator, tm, vaultValue } = setup();
    translator.translate(document.body, tm, vaultValue);
    expect(document.getElementById("label")?.textContent).toBe("  FF_SOLDE  ");
  });

  it("is idempotent on a second pass", () => {
    const { translator, tm, vaultValue } = setup();
    const first = translator.translate(document.body, tm, vaultValue);
    const second = translator.translate(document.body, tm, vaultValue);
    expect(first.applied).toBe(1);
    expect(second.applied).toBe(1);
    expect(second.missed).toBe(first.missed);
    expect(second.coverage).toBe(first.coverage);
    expect(document.getElementById("label")?.textContent).toBe("  FF_SOLDE  ");
    expect(document.querySelectorAll("p").length).toBe(2);
  });

  it("re-applies when the page renders the source again", () => {
    const { translator, tm, vaultValue } = setup();
    translator.translate(document.body, tm, vaultValue);
    const label = document.getElementById("label") as HTMLElement;
    label.textContent = "Solde disponible";
    const stats = translator.translate(document.body, tm, vaultValue);
    expect(stats.applied).toBe(1);
    expect(label.textContent).toBe("FF_SOLDE");
  });

  it("uses a new source when the page changes the text", () => {
    const { translator, tm, vaultValue } = setup();
    translator.translate(document.body, tm, vaultValue);
    const label = document.getElementById("label") as HTMLElement;
    label.textContent = "Frais";
    const stats = translator.translate(document.body, tm, vaultValue);
    expect(stats.applied).toBe(0);
    expect(stats.missed).toBe(1);
    expect(label.textContent).toBe("Frais");
  });

  it("restores the original text on stop", () => {
    const { translator, tm, vaultValue } = setup();
    translator.translate(document.body, tm, vaultValue);
    translator.restore(document.body);
    expect(document.getElementById("label")?.textContent).toBe("  Solde disponible  ");
  });

  it("exposes the original and the translated unit", () => {
    const { translator, tm, vaultValue } = setup();
    translator.translate(document.body, tm, vaultValue);
    const text = document.getElementById("label")?.firstChild as Text;
    expect(translator.originalOf(text)).toBe("  Solde disponible  ");
    expect(translator.translatedUnit(text)?.id).toBe("tm.balance.available");
  });

  it("translates text inside an open shadow root", () => {
    document.body.innerHTML = `<div id="host"></div>`;
    const host = document.getElementById("host") as HTMLElement;
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `<p>Solde disponible</p>`;
    const translator = new DomTranslator();
    const tm = new TranslationMemory([
      unit({
        id: "tm.balance.available",
        source: { fr: "Solde disponible", en: "Available balance" },
        target: { ff: "FF_SOLDE" },
      }),
    ]);
    const stats = translator.translate(document.body, tm, vault());
    expect(stats.applied).toBe(1);
    expect(shadow.textContent).toBe("FF_SOLDE");
  });

  it("does not count protected nodes in coverage", () => {
    const { translator, tm, vaultValue } = setup();
    const stats = translator.translate(document.body, tm, vaultValue);
    expect(stats.protectedCount).toBe(1);
    expect(stats.coverage).toBe(1);
  });
});
