// ============================================================================
// PAPERWORK UX-001 — Synonym-aware search (pure, presentation only)
// ============================================================================
// Matches form_id, friendly name, category — PLUS "common agent language"
// synonyms, so a new agent can type "listing", "hoa", or "seller financing"
// and find the right form without knowing the number.
// ============================================================================

import type { TemplateCard } from "./types";

interface Synonym {
  categories?: string[];
  idKeywords?: string[];
  nameKeywords?: string[];
}

/** Common agent language → matchers over the existing template fields. */
export const SYNONYMS: Record<string, Synonym> = {
  listing: { categories: ["listing"] },
  offer: { categories: ["purchase", "buyer_rep"] },
  purchase: { categories: ["purchase"] },
  "far/bar": { idKeywords: ["farbar", "far-bar", "far/bar"], nameKeywords: ["far/bar", "farbar"] },
  "as-is": { idKeywords: ["asis"], nameKeywords: ["as-is", "as is"] },
  hoa: { idKeywords: ["hoa"], nameKeywords: ["hoa", "homeowner"] },
  condo: { nameKeywords: ["condo", "condominium"] },
  "seller financing": { categories: ["compensation"], idKeywords: ["crsp"], nameKeywords: ["seller financ"] },
  inspection: { nameKeywords: ["inspection"] },
  flood: { nameKeywords: ["flood"] },
  "lead paint": { nameKeywords: ["lead"] },
  escrow: { nameKeywords: ["escrow"] },
  appraisal: { nameKeywords: ["appraisal"] },
  lease: { categories: ["lease"] },
  disclosure: { categories: ["disclosure"] },
  disclosures: { categories: ["disclosure"] },
  addendum: { categories: ["addendum"] },
  addenda: { categories: ["addendum"] },
};

function matchesSynonym(t: TemplateCard, s: Synonym): boolean {
  const id = t.form_id.toLowerCase();
  const name = t.form_name.toLowerCase();
  if (s.categories?.includes(t.category)) return true;
  if (s.idKeywords?.some((k) => id.includes(k))) return true;
  if (s.nameKeywords?.some((k) => name.includes(k))) return true;
  return false;
}

/**
 * Filter templates by a free-text query. Direct substring match on
 * form_id / form_name / category, plus synonym expansion (a synonym key that
 * the query contains, or that contains the query). Pure; empty query = all.
 */
export function searchTemplates(templates: TemplateCard[], query: string): TemplateCard[] {
  const q = query.trim().toLowerCase();
  if (!q) return templates;
  const syns = Object.entries(SYNONYMS)
    .filter(([k]) => q.includes(k) || k.includes(q))
    .map(([, v]) => v);
  return templates.filter((t) => {
    if (t.form_id.toLowerCase().includes(q)) return true;
    if (t.form_name.toLowerCase().includes(q)) return true;
    if (t.category.toLowerCase().includes(q)) return true;
    return syns.some((s) => matchesSynonym(t, s));
  });
}
