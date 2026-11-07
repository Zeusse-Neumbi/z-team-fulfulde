import type { TranslationUnit } from "@zteam/shared";
import { normalizeValue, splitWhitespace } from "./normalize";
import { classifyNode, type Vault } from "./protected";
import type { TranslationMemory } from "./tm";

export interface TranslationStats {
  applied: number;
  protectedCount: number;
  missed: number;
  coverage: number;
}

export function collectTextNodes(root: Node): Text[] {
  const nodes: Text[] = [];

  const visit = (node: Node): void => {
    if (node.nodeType === 3) {
      if ((node.nodeValue ?? "").trim().length > 0) nodes.push(node as Text);
      return;
    }
    if (node.nodeType === 1) {
      const element = node as Element;
      if (element.shadowRoot) visit(element.shadowRoot);
    }
    for (const child of Array.from(node.childNodes)) visit(child);
  };

  visit(root);
  return nodes;
}

export class DomTranslator {
  private originals = new WeakMap<Text, string>();
  private appliedUnits = new WeakMap<Text, TranslationUnit>();

  translate(root: Node, tm: TranslationMemory, vault: Vault): TranslationStats {
    const nodes = collectTextNodes(root);
    let applied = 0;
    let protectedCount = 0;
    let missed = 0;

    for (const node of nodes) {
      const classification = classifyNode(node, vault);
      if (classification.kind === "ignore") continue;
      if (classification.kind === "protected") {
        protectedCount += 1;
        continue;
      }

      const source = node.nodeValue ?? "";
      const hit = tm.lookup(source);
      if (!hit) {
        missed += 1;
        continue;
      }

      if (classification.kind === "mixed") {
        const sourceNormalized = normalizeValue(source);
        const targetNormalized = normalizeValue(hit.target);
        const values = vault.values().filter(
          (value) => value.normalized.length >= 3 && sourceNormalized.includes(value.normalized),
        );
        const preserved = values.every((value) => targetNormalized.includes(value.normalized));
        if (!preserved) {
          missed += 1;
          continue;
        }
      }

      if (!this.originals.has(node)) this.originals.set(node, source);
      this.write(node, hit.target);
      this.appliedUnits.set(node, hit.unit);
      applied += 1;
    }

    return {
      applied,
      protectedCount,
      missed,
      coverage: applied / Math.max(1, applied + missed),
    };
  }

  restore(root: Node): void {
    for (const node of collectTextNodes(root)) {
      const original = this.originals.get(node);
      if (original !== undefined) node.nodeValue = original;
    }
    this.originals = new WeakMap();
    this.appliedUnits = new WeakMap();
  }

  translatedUnit(node: Text): TranslationUnit | undefined {
    return this.appliedUnits.get(node);
  }

  private write(node: Text, target: string): void {
    const current = node.nodeValue ?? "";
    const { leading, trailing } = splitWhitespace(current);
    node.nodeValue = `${leading}${target}${trailing}`;
  }
}
