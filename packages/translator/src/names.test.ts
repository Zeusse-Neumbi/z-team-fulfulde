import { describe, expect, it } from "vitest";
import { isLikelyPersonName } from "./names";

describe("isLikelyPersonName", () => {
  it.each([
    "Amina Ngo Bell",
    "Jean-Paul Mbarga",
    "John Smith",
    "Mary Jane Watson",
    "Amina",
  ])("accepts %s", (name) => {
    expect(isLikelyPersonName(name, { allowSingle: true })).toBe(true);
  });

  it.each([
    "Getting Started Guide",
    "Privacy Policy",
    "Learn More",
    "Contact Us",
    "Frequently Asked Questions",
    "Product Features",
    "VOTRE COMPTE",
    "SOLDE DISPONIBLE",
    "Home",
    "Important",
  ])("rejects %s", (text) => {
    expect(isLikelyPersonName(text, { allowSingle: true })).toBe(false);
  });

  it("rejects a name used as a heading", () => {
    expect(isLikelyPersonName("Amina Ngo Bell", { tagName: "H2" })).toBe(false);
  });

  it("rejects a single-word generic text unless the caller allows it", () => {
    expect(isLikelyPersonName("Amina")).toBe(false);
    expect(isLikelyPersonName("Amina", { allowSingle: true })).toBe(true);
  });
});
