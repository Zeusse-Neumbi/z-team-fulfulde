import { describe, expect, it } from "vitest";
import { packStatusLabel } from "./pack-status";

const copy = {
  fixtureBadge: "fixture",
  mtBadge: "MT",
  packDraft: "brouillon",
  packSourceMt: "brouillon machine",
  packSourceValidated: "pack validé",
};

describe("packStatusLabel", () => {
  it("never renders a draft as validated", () => {
    expect(packStatusLabel("validated", false, copy)).toBe("brouillon");
    expect(packStatusLabel("mt", false, copy)).toBe("MT — brouillon machine");
    expect(packStatusLabel("fixture", false, copy)).toBe("fixture");
  });

  it("shows the validated label only when the release gate agrees", () => {
    expect(packStatusLabel("validated", true, copy)).toBe("pack validé");
  });
});
