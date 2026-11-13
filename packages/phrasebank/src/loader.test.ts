import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  type LanguagePack,
  assertKnownTargets,
  loadAll,
  loadRegistry,
  releaseErrors,
  releaseGate,
} from "./loader";

const registry = loadRegistry();
const packs = loadAll();

describe("language registry", () => {
  it("loads one row per language", () => {
    expect(registry.map((entry) => entry.code)).toEqual(["fub", "ybb"]);
    expect(new Set(registry.map((entry) => entry.code)).size).toBe(registry.length);
  });

  it("keeps the registry and the pack directories in bijection", () => {
    const directories = readdirSync(fileURLToPath(new URL("../entries/", import.meta.url)), {
      withFileTypes: true,
    })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    expect(directories).toEqual(registry.map((entry) => entry.code).sort());
  });
});

describe("phrasebank packs", () => {
  it("loads the seed translation memory and phrases for every language", () => {
    for (const code of Object.keys(packs)) {
      const pack = packs[code];
      expect(pack).toBeDefined();
      expect(pack?.translationUnits.length).toBeGreaterThan(10);
      expect(pack?.phrases.length).toBeGreaterThan(5);
      expect(new Set(pack?.translationUnits.map((unit) => unit.id)).size).toBe(
        pack?.translationUnits.length,
      );
      expect(new Set(pack?.phrases.map((phrase) => phrase.id)).size).toBe(pack?.phrases.length);
    }
  });

  it("isolates each pack: loading ybb never carries fub targets", () => {
    const fub = packs.fub;
    const ybb = packs.ybb;
    expect(fub).toBeDefined();
    expect(ybb).toBeDefined();
    expect(fub?.translationUnits.every((unit) => Object.keys(unit.target).join() === "fub")).toBe(
      true,
    );
    expect(ybb?.translationUnits.every((unit) => Object.keys(unit.target).join() === "ybb")).toBe(
      true,
    );
    expect(fub?.phrases.every((phrase) => Object.keys(phrase.target).join() === "fub")).toBe(true);
    expect(ybb?.phrases.every((phrase) => Object.keys(phrase.target).join() === "ybb")).toBe(true);
    expect(ybb?.translationUnits.every((unit) => unit.target.fub === undefined)).toBe(true);
  });

  it("warns on empty targets instead of inventing text", () => {
    for (const code of Object.keys(packs)) {
      const pack = packs[code];
      expect(pack?.warnings.length).toBeGreaterThan(0);
      expect(pack?.translationUnits.every((unit) => !unit.target[code]?.text)).toBe(true);
    }
  });
});

describe("target validation", () => {
  it("rejects a target key that is not in the registry", () => {
    expect(() =>
      assertKnownTargets([{ id: "tm.unknown", target: { deu: { text: "" } } }], new Set(["fub"]), "tm"),
    ).toThrow(/deu/);
  });

  it("accepts a registered target key", () => {
    expect(() =>
      assertKnownTargets([{ id: "tm.known", target: { fub: { text: "" } } }], new Set(["fub"]), "tm"),
    ).not.toThrow();
  });
});

function packWith(overrides: Partial<LanguagePack>): LanguagePack {
  return {
    code: "fub",
    status: "draft",
    packSource: "validated",
    tmVersion: "test",
    phrasebankVersion: "test",
    translationUnits: [],
    phrases: [],
    numbers: packs.fub?.numbers as LanguagePack["numbers"],
    warnings: [],
    ...overrides,
  };
}

const unvalidatedHighRisk: LanguagePack["translationUnits"][number] = {
  id: "tm.high",
  source: { fr: "Solde", en: "Balance" },
  target: {
    fub: { text: "", origin: "human", validatedBy: [], backTranslationFr: "" },
  },
  risk: "high",
  version: "1",
};

describe("per-language release gate", () => {
  it("does not fail a draft language with missing validators", () => {
    expect(releaseGate({ fub: packWith({ translationUnits: [unvalidatedHighRisk] }) })).toEqual(
      [],
    );
  });

  it("does not fail a text-only language", () => {
    expect(
      releaseGate({
        fub: packWith({ status: "text-only", translationUnits: [unvalidatedHighRisk] }),
      }),
    ).toEqual([]);
  });

  it("fails a validated language with missing validators", () => {
    const errors = releaseGate({
      fub: packWith({ status: "validated", translationUnits: [unvalidatedHighRisk] }),
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain("fub");
    expect(errors[0]).toContain("tm.high");
  });

  it("keeps the low-risk exemption", () => {
    const lowRisk = { ...unvalidatedHighRisk, risk: "low" as const };
    expect(releaseErrors(packWith({ translationUnits: [lowRisk] }))).toEqual([]);
  });

  it("accepts a fully validated high-risk unit", () => {
    const validated = {
      ...unvalidatedHighRisk,
      target: {
        fub: {
          text: "Solde",
          origin: "human" as const,
          validatedBy: ["speaker_1"],
          backTranslationFr: "Balance",
        },
      },
    };
    expect(
      releaseGate({ fub: packWith({ status: "validated", translationUnits: [validated] }) }),
    ).toEqual([]);
  });

  it("marks the default pack as validated-source and unvalidated in content", () => {
    expect(packs.fub?.packSource).toBe("validated");
    expect(releaseErrors(packs.fub as LanguagePack).length).toBeGreaterThan(0);
  });
});

describe("machine-translated candidate pack", () => {
  it("loads fub candidates and keeps them out of the release", () => {
    const previous = process.env.ZTEAM_PHRASEBANK;
    process.env.ZTEAM_PHRASEBANK = "mt";
    try {
      const candidate = loadAll();
      expect(candidate.fub?.packSource).toBe("mt");
      expect(candidate.fub?.tmVersion).toContain("+mt");
      expect(candidate.fub?.translationUnits.length).toBeGreaterThan(10);
      expect(
        candidate.fub?.translationUnits.every((unit) => (unit.target.fub?.text.length ?? 0) > 0),
      ).toBe(true);
      expect(candidate.fub?.translationUnits.every((unit) => unit.target.fub?.origin === "mt")).toBe(
        true,
      );
      expect(
        candidate.fub?.translationUnits.every(
          (unit) => (unit.target.fub?.validatedBy.length ?? 1) === 0,
        ),
      ).toBe(true);
      expect(
        releaseGate({ fub: { ...candidate.fub, status: "validated" } as LanguagePack }).length,
      ).toBeGreaterThan(0);
      // ybb has no candidate pack yet: it falls back to the base pack and says so.
      expect(candidate.ybb?.packSource).toBe("validated");
      expect(candidate.ybb?.warnings.some((warning) => warning.includes("candidate"))).toBe(true);
    } finally {
      if (previous === undefined) delete process.env.ZTEAM_PHRASEBANK;
      else process.env.ZTEAM_PHRASEBANK = previous;
    }
  });
});
