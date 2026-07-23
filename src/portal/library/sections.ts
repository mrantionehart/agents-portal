// ============================================================================
// PAPERWORK UX-001 (IA pass) — Section grouping within a workflow
// ============================================================================
// Turns a workflow's forms into transaction-order SECTIONS (Contract → Buyer
// Rep → Financing → …) so the page reads like a transaction guide, not a wall
// of documents. Presentation only — matches on the EXISTING form_id/form_name/
// category; adds nothing, moves nothing. First matching section wins; anything
// unmatched falls into "Additional forms" (never hidden).
// ============================================================================

import type { TemplateCard } from "./types";

export interface SectionDef {
  id: string;
  title: string;
  match: (t: TemplateCard) => boolean;
}
export interface SectionGroup {
  id: string;
  title: string;
  forms: TemplateCard[];
}

/** case-insensitive keyword test over "form_id form_name". */
function kw(t: TemplateCard, ...words: string[]): boolean {
  const hay = `${t.form_id} ${t.form_name}`.toLowerCase();
  return words.some((w) => hay.includes(w));
}
const isContract = (t: TemplateCard) =>
  kw(t, "far/bar", "farbar", "far bar", "as-is", "as is", "asis", "residential contract", "contract for sale", "purchase and sale") &&
  !kw(t, "addendum", "adden");
const isBuyerRep = (t: TemplateCard) =>
  t.category === "buyer_rep" || kw(t, "buyer brokerage", "buyer rep", "single agent", "transaction broker", "brokerage agreement");
const isFinancing = (t: TemplateCard) =>
  kw(t, "fha", "va-", " va ", "veteran", "conventional", "seller financ", "financing", "mortgage", "loan");
const isInspection = (t: TemplateCard) => kw(t, "inspection", "repair", "wdo", "wood destroying");
const isContingency = (t: TemplateCard) =>
  kw(t, "kick-out", "kickout", "sale of buyer", "back-up", "backup", "appraisal", "contingency", "contingent");
const isClosing = (t: TemplateCard) =>
  kw(t, "escrow", "occupancy", "extension", "closing", "possession", "post-closing");
const isPropertySpecific = (t: TemplateCard) =>
  kw(t, "hoa", "condo", "coastal", "flood", "lead", "homeowner");

/** Per-workflow section order. Order == the agent's mental order. */
export const WORKFLOW_SECTIONS: Record<string, SectionDef[]> = {
  offer: [
    { id: "contract", title: "Contract", match: isContract },
    { id: "buyer-rep", title: "Buyer Representation", match: isBuyerRep },
    { id: "financing", title: "Financing", match: isFinancing },
    { id: "inspection", title: "Inspection", match: isInspection },
    { id: "contingencies", title: "Contingencies", match: isContingency },
    { id: "closing", title: "Closing / Escrow", match: isClosing },
  ],
  listing: [
    {
      id: "required",
      title: "Required to Take the Listing",
      match: (t) => t.category === "listing" || kw(t, "exclusive right of sale", "listing agreement", "exclusive brokerage", "right to sell"),
    },
    { id: "disclosures", title: "Property Disclosures", match: (t) => t.category === "disclosure" || kw(t, "disclosure", "hoa", "flood", "lead", "seller property") },
  ],
  lease: [
    { id: "standard", title: "Standard Lease", match: (t) => kw(t, "residential lease", "lease agreement", "apartment lease") && !kw(t, "addendum", "disclosure") },
    { id: "lease-rest", title: "Lease Addenda & Disclosures", match: () => true },
  ],
  addenda: [
    { id: "financing", title: "Financing", match: isFinancing },
    { id: "inspection", title: "Inspection", match: isInspection },
    { id: "contingencies", title: "Contingencies", match: isContingency },
    { id: "closing", title: "Closing", match: isClosing },
    { id: "property", title: "Property-specific", match: isPropertySpecific },
  ],
  // disclosures: no sub-sections (all are disclosures) → single flat group.
};

/**
 * Group a workflow's forms into ordered sections. Forms keep their incoming
 * order within a section (so annotated/priority forms stay on top). Unmatched
 * forms land in a trailing "Additional forms" group. Empty sections are dropped.
 */
export function groupIntoSections(forms: TemplateCard[], workflowId: string): SectionGroup[] {
  const defs = WORKFLOW_SECTIONS[workflowId] ?? [];
  if (defs.length === 0) {
    return forms.length ? [{ id: "all", title: "", forms }] : [];
  }
  const groups: SectionGroup[] = defs.map((d) => ({ id: d.id, title: d.title, forms: [] }));
  const extra: TemplateCard[] = [];
  for (const t of forms) {
    const def = defs.find((d) => d.match(t));
    if (def) groups.find((g) => g.id === def.id)!.forms.push(t);
    else extra.push(t);
  }
  const result = groups.filter((g) => g.forms.length > 0);
  if (extra.length) result.push({ id: "additional", title: "Additional forms", forms: extra });
  return result;
}
