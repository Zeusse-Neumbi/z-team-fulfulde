import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import {
  downgradePhraseYaml,
  downgradeTmYaml,
  upgradePhraseYaml,
  upgradeTmYaml,
} from "./migrate";

const legacyTm = `version: "1"
units:
  - id: tm.balance
    source: { fr: "Solde", en: "Balance" }
    target: { ff: "" }
    risk: high
    validatedBy: []
    backTranslationFr: ""
    version: "1"
`;

const validatedTm = `version: "1"
units:
  - id: tm.balance
    source: { fr: "Solde", en: "Balance" }
    target: { ff: "Solde" }
    risk: high
    validatedBy: ["speaker_1"]
    backTranslationFr: "Balance"
    version: "1"
`;

const legacyPhrase = `version: "1"
phrases:
  - id: BALANCE_IS
    version: "1"
    category: balance
    risk: high
    fr: "Votre solde est de {amount}."
    en: "Your balance is {amount}."
    ff: ""
    segments:
      - slot: amount
    slots:
      amount: { type: amount, currency: XAF }
    validatedBy: []
    backTranslationFr: ""
`;

describe("phrasebank codemod", () => {
  it("migrates a translation unit and round-trips", () => {
    const upgraded = upgradeTmYaml(legacyTm, "fub");
    const unit = parse(upgraded).units[0];
    expect(unit.target).toEqual({ fub: { text: "", origin: "human" } });
    expect(unit.validatedBy).toBeUndefined();
    expect(unit.backTranslationFr).toBeUndefined();
    expect(parse(downgradeTmYaml(upgraded, "fub"))).toEqual(parse(legacyTm));
  });

  it("keeps a validator and back-translation on the language target", () => {
    const upgraded = upgradeTmYaml(validatedTm, "fub");
    expect(parse(upgraded).units[0].target).toEqual({
      fub: {
        text: "Solde",
        origin: "human",
        validatedBy: ["speaker_1"],
        backTranslationFr: "Balance",
      },
    });
    expect(parse(downgradeTmYaml(upgraded, "fub"))).toEqual(parse(validatedTm));
  });

  it("marks machine candidates as mt", () => {
    const upgraded = parse(upgradeTmYaml(validatedTm, "ybb", "mt")).units[0];
    expect(upgraded.target).toEqual({
      ybb: {
        text: "Solde",
        origin: "mt",
        validatedBy: ["speaker_1"],
        backTranslationFr: "Balance",
      },
    });
  });

  it("migrates a phrase and round-trips", () => {
    const upgraded = upgradePhraseYaml(legacyPhrase, "fub");
    const phrase = parse(upgraded).phrases[0];
    expect(phrase.target).toEqual({ fub: { text: "", origin: "human" } });
    expect(phrase.ff).toBeUndefined();
    expect(phrase.validatedBy).toBeUndefined();
    expect(parse(downgradePhraseYaml(upgraded, "fub"))).toEqual(parse(legacyPhrase));
  });

  it("rejects a code that is not ISO 639-3", () => {
    expect(() => upgradeTmYaml(legacyTm, "ff")).toThrow(/ISO 639-3/);
    expect(() => upgradePhraseYaml(legacyPhrase, "YBB")).toThrow(/ISO 639-3/);
  });
});
