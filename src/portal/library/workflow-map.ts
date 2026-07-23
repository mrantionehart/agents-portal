// ============================================================================
// PAPERWORK UX-001 — Workflow map (presentation config only)
// ============================================================================
// Re-presents the EXISTING Vault `category` taxonomy as agent-verb workflows.
// This adds NO document, changes NO form_id, and moves NO file — it is a view
// over the templates the Vault agent-templates API already returns.
//
// Folders are driven by `category` (every template has one), so a workflow can
// never silently hide a form. Per-form annotations (friendly ordering + "when
// required") are OPTIONAL and keyed by form_id — absence is fine.
// ============================================================================

import type { TemplateCard } from "./types";

export interface Workflow {
  id: string;
  /** Agent verb-phrase ("Taking a Listing"), never a category name. */
  label: string;
  emoji: string;
  blurb: string;
  /** Vault `category` values this workflow surfaces. */
  categories: string[];
}

export const WORKFLOWS: Workflow[] = [
  { id: "listing", label: "Taking a Listing", emoji: "🏡", blurb: "Everything needed to take a listing.", categories: ["listing", "disclosure"] },
  { id: "offer", label: "Writing an Offer", emoji: "🛒", blurb: "Everything needed to write an offer.", categories: ["purchase", "buyer_rep", "addendum", "compensation"] },
  { id: "lease", label: "Leasing a Property", emoji: "🔑", blurb: "Residential leasing forms.", categories: ["lease", "disclosure"] },
  { id: "disclosures", label: "Preparing Disclosures", emoji: "📋", blurb: "Standalone disclosures.", categories: ["disclosure"] },
  { id: "addenda", label: "Working with Addenda", emoji: "📎", blurb: "Additional contract documents.", categories: ["addendum", "compensation"] },
];

/** Optional, broker-extensible annotations keyed by the real Vault form_id. */
export interface FormAnnotation {
  /** Lower sorts earlier within a workflow. Unlisted forms sort after (999). */
  order?: number;
  /** Scannable "Use when: {use}" — the situation this form fits. */
  use?: string;
  /** Scannable "Required if: {requiredIf}" — highest precedence. */
  requiredIf?: string;
  /** Scannable "Only for: {onlyFor}" — e.g. "Condo purchases". */
  onlyFor?: string;
  /** One-line friendly explanation. */
  blurb?: string;
}
export const FORM_ANNOTATIONS: Record<string, FormAnnotation> = {
  "ERS-20sa": { order: 1, use: "Listing a property for sale", blurb: "Exclusive Right of Sale listing agreement." },
  "CRSP-17_Z": { order: 5, requiredIf: "Seller financing", blurb: "Seller financing / purchase-money mortgage terms." },
  // Broker curates more here over time; unlisted forms still appear, ordered by name.
};

export function workflowById(id: string): Workflow | undefined {
  return WORKFLOWS.find((w) => w.id === id);
}

export function annotationFor(formId: string): FormAnnotation | undefined {
  return FORM_ANNOTATIONS[formId];
}

/**
 * Forms relevant to a workflow: filter by the workflow's categories, dedupe by
 * form_id, and order by annotation `order` then friendly name. Pure.
 */
export function formsForWorkflow(templates: TemplateCard[], workflow: Workflow): TemplateCard[] {
  const seen = new Set<string>();
  const inWorkflow = templates.filter((t) => {
    if (!workflow.categories.includes(t.category)) return false;
    if (seen.has(t.form_id)) return false;
    seen.add(t.form_id);
    return true;
  });
  return inWorkflow.sort((a, b) => {
    const oa = FORM_ANNOTATIONS[a.form_id]?.order ?? 999;
    const ob = FORM_ANNOTATIONS[b.form_id]?.order ?? 999;
    if (oa !== ob) return oa - ob;
    return a.form_name.localeCompare(b.form_name);
  });
}
