import type { PanelCopy } from "../entrypoints/sidepanel/copy";

export type PackSource = "validated" | "mt" | "fixture";

type PackCopy = Pick<
  PanelCopy,
  "fixtureBadge" | "mtBadge" | "packDraft" | "packSourceMt" | "packSourceValidated"
>;

/**
 * The panel's honesty frame: a pack that failed the release gate is always
 * labelled as a draft, whatever the source file says.
 */
export function packStatusLabel(
  source: PackSource,
  validated: boolean,
  t: PackCopy,
): string {
  if (validated) return t.packSourceValidated;
  if (source === "mt") return `${t.mtBadge} — ${t.packSourceMt}`;
  if (source === "fixture") return t.fixtureBadge;
  return t.packDraft;
}
