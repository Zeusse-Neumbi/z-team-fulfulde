import type { TranslationUnit } from "@zteam/shared";
import { describe, expect, it } from "vitest";
import {
  DomTranslator,
  maskVaultValues,
  unmaskVaultValues,
} from "./dom-translator";
import { addVaultValue, vaultFrom, type VaultValue } from "./protected";
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

function vault(...values: VaultValue[]) {
  return vaultFrom(values);
}

describe("runtime machine translation", () => {
  it("adds a local API target after the validated TM misses", () => {
    const tm = new TranslationMemory([]);
    expect(tm.addRuntime("Solde disponible", "Soldi jaɓɓorgo", "nllb", "nllb-600m")).toBe(
      true,
    );
    const hit = tm.lookup("Solde disponible");
    expect(hit?.origin).toBe("mt");
    expect(hit?.target).toBe("Soldi jaɓɓorgo");
    expect(hit?.provider).toBe("nllb");
    expect(tm.runtimeSize()).toBe(1);
    expect(tm.baseSize()).toBe(0);
  });

  it("never overrides a validated unit in fallback mode", () => {
    const tm = new TranslationMemory([
      unit({
        id: "tm.balance",
        source: { fr: "Solde disponible", en: "Available balance" },
        target: { ff: "FF_SOLDE" },
      }),
    ]);
    expect(tm.addRuntime("Solde disponible", "MT_SOLDE", "nllb", "model")).toBe(false);
    expect(tm.lookup("Solde disponible")?.target).toBe("FF_SOLDE");
    expect(tm.lookup("Solde disponible")?.origin).toBe("tm");
  });

  it("lets primary mode override a validated unit", () => {
    const tm = new TranslationMemory([
      unit({
        id: "tm.balance",
        source: { fr: "Solde disponible", en: "Available balance" },
        target: { ff: "FF_SOLDE" },
      }),
    ]);
    expect(tm.addRuntime("Solde disponible", "MT_SOLDE", "nllb", "model", true)).toBe(true);
    tm.setRuntimePriority(true);
    expect(tm.lookup("Solde disponible")?.target).toBe("MT_SOLDE");
    expect(tm.lookup("Solde disponible")?.origin).toBe("mt");
  });

  it("collects only plain translatable sources for the API", () => {
    document.body.innerHTML = `
      <p id="plain">Solde disponible</p>
      <p id="mixed">Numéro de compte : CM 001 2345 6789 01</p>
      <p id="amount">250 000 FCFA</p>
      <input id="name" value="Amina Ngo Bell" />
      <p id="input" contenteditable="true">Paiement de services</p>
      <p id="tm">Frais</p>
    `;
    const tm = new TranslationMemory([
      unit({
        id: "tm.fees",
        source: { fr: "Frais", en: "Fee" },
        target: { ff: "FF_FRAIS" },
      }),
    ]);
    const values: VaultValue[] = [];
    addVaultValue(values, "CM 001 2345 6789 01", "account");
    addVaultValue(values, "250 000 FCFA", "amount");
    addVaultValue(values, "Amina Ngo Bell", "person");
    const translator = new DomTranslator();
    const sources = translator.translatableSources(
      document.body,
      tm,
      vault(...values),
    );
    expect(sources).toEqual(["Solde disponible"]);
  });

  it("can include validated sources when primary mode needs them", () => {
    document.body.innerHTML = `<p>Frais</p>`;
    const tm = new TranslationMemory([
      unit({
        id: "tm.fees",
        source: { fr: "Frais", en: "Fee" },
        target: { ff: "FF_FRAIS" },
      }),
    ]);
    const translator = new DomTranslator();
    expect(translator.translatableSources(document.body, tm, vault())).toEqual([]);
    expect(
      translator.translatableSources(document.body, tm, vault(), { includeTm: true }),
    ).toEqual(["Frais"]);
  });

  it("applies an API target and counts it separately", () => {
    document.body.innerHTML = `<p id="label">Solde disponible</p>`;
    const tm = new TranslationMemory([]);
    tm.addRuntime("Solde disponible", "Soldi jaɓɓorgo", "nllb", "model");
    const translator = new DomTranslator();
    const stats = translator.translate(document.body, tm, vault());
    expect(document.getElementById("label")?.textContent).toBe("Soldi jaɓɓorgo");
    expect(stats.applied).toBe(1);
    expect(stats.tmApplied).toBe(0);
    expect(stats.mtApplied).toBe(1);
    expect(stats.sentences[0]?.origin).toBe("mt");
  });

  it("aborts when an API target introduces an amount", () => {
    document.body.innerHTML = `<p id="label">Frais de transfert</p>`;
    const tm = new TranslationMemory([]);
    tm.addRuntime("Frais de transfert", "Frais 2 500 FCFA", "nllb", "model");
    const translator = new DomTranslator();
    const stats = translator.translate(document.body, tm, vault());
    expect(stats.aborted).toBe(true);
    expect(stats.abortReason).toBe("target_value_mismatch");
    expect(document.getElementById("label")?.textContent).toBe("Frais de transfert");
  });

  it("masks mixed values and restores them byte-for-byte", () => {
    const values: VaultValue[] = [];
    addVaultValue(values, "Aïssatou Bello", "person");
    addVaultValue(values, "CM 001 2345 6789 01", "account");
    const masked = maskVaultValues(
      "Bonjour, Aïssatou Bello. Numéro de compte : CM 001 2345 6789 01",
      vault(...values),
    );
    expect(masked).not.toBeNull();
    expect(masked?.masked).not.toContain("Aïssatou");
    expect(masked?.masked).not.toContain("CM 001");
    expect(masked?.masked).toContain("[[Z1]]");
    expect(masked?.masked).toContain("[[Z2]]");
    expect(
      unmaskVaultValues(
        masked?.masked ?? "",
        masked?.values ?? [],
      ),
    ).toBe("Bonjour, Aïssatou Bello. Numéro de compte : CM 001 2345 6789 01");
  });

  it("drops a masked target when the model loses a placeholder", () => {
    const values = [{ token: "[[Z1]]", value: "Aïssatou" }];
    expect(unmaskVaultValues("Bonjour, Aïssatou", values)).toBeNull();
    expect(unmaskVaultValues("Bonjour, [[Z1]]", values)).toBe("Bonjour, Aïssatou");
    expect(unmaskVaultValues("Bonjour, [[Z1]] et [[Z2]]", values)).toBeNull();
  });

  it("collects mixed nodes for masked translation but not protected nodes", () => {
    document.body.innerHTML = `
      <p id="greeting">Bonjour, Aïssatou Bello</p>
      <p id="account">Numéro de compte : CM 001 2345 6789 01</p>
      <p id="amount">250 000 FCFA</p>
      <p id="plain">Solde disponible</p>
    `;
    const values: VaultValue[] = [];
    addVaultValue(values, "Aïssatou Bello", "person");
    addVaultValue(values, "CM 001 2345 6789 01", "account");
    addVaultValue(values, "250 000 FCFA", "amount");
    const translator = new DomTranslator();
    const mixed = translator.mixedSources(
      document.body,
      new TranslationMemory([]),
      vault(...values),
    );
    expect(mixed.map((item) => item.source)).toEqual([
      "Bonjour, Aïssatou Bello",
      "Numéro de compte : CM 001 2345 6789 01",
    ]);
    expect(mixed[0]?.masked).not.toContain("Aïssatou");
    expect(mixed[1]?.masked).not.toContain("CM 001");
  });

  it("is idempotent and restores API targets", () => {
    document.body.innerHTML = `<p id="label">  Solde disponible  </p>`;
    const tm = new TranslationMemory([]);
    tm.addRuntime("Solde disponible", "Soldi jaɓɓorgo", "nllb", "model");
    const translator = new DomTranslator();
    const first = translator.translate(document.body, tm, vault());
    const second = translator.translate(document.body, tm, vault());
    expect(first.applied).toBe(1);
    expect(second.applied).toBe(1);
    expect(second.mtApplied).toBe(1);
    expect(document.getElementById("label")?.textContent).toBe("  Soldi jaɓɓorgo  ");
    translator.restore(document.body);
    expect(document.getElementById("label")?.textContent).toBe("  Solde disponible  ");
  });
});
