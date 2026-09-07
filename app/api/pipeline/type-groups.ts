// ============================================================================
// SEC · P0-19 · AP pipeline transaction-type grouping — canonical + legacy
// ============================================================================
// Single source of truth for how the AP pipeline UI buckets a
// `transactions.type` value into one of the 5 tabs:
//
//   Listings | Buyers | Leases | Referrals | Other
//
// The Vault canonical vocabulary (hartfelt-vault
// src/lib/transaction-os/transaction-type.ts) is 7 types:
//   purchase | lease | listing | buyer_rep | commercial | wholesale | referral
//
// Legacy aliases that still exist in prod:
//   buyer  → maps to canonical `purchase` (buyer-side purchase contract)
//   seller → maps to canonical `listing`  (seller-side deal)
//   double_close → maps to canonical `purchase`
//
// Each bucket lists BOTH legacy AND canonical spellings so a deal stored
// with either spelling surfaces in the correct AP tab. Pre-fix the bucket
// map only knew about legacy aliases so canonical `listing` (already in
// prod today per Q1 evidence 2026-09-07) and `buyer_rep` (not yet in prod
// but a legitimate canonical type) landed in NO group and became silently
// invisible in the AP UI.
//
// `commercial` — INTENTIONAL PRODUCT RESIDUAL. AP has no semantically
// correct bucket for commercial deals today (`other` would misclassify;
// Listings/Buyers/Leases/Referrals all wrong axis). Zero commercial rows
// in prod (Q1 2026-09-07). A commercial deal stored in prod will surface
// in the overall total counts but land in NO bucket — visible-in-totals
// but not on any tab — until a product decision routes it. Do NOT force-
// map into `other` without explicit product sign-off.
//
// This module is PURE (no DB / auth / RN imports) so filter, count, and
// render code paths in the pipeline route all read from the same partition
// function — no duplicate type lists elsewhere. If a future extension
// needs a new bucket (e.g. add a Commercial tab), edit only this file.
// ============================================================================

/** One AP pipeline tab: a label + icon + the set of `transactions.type`
 *  values that surface inside it. */
export interface PipelineTypeGroup {
  readonly label: string;
  readonly icon: string;
  readonly types: readonly string[];
}

/** The 5 AP pipeline tabs, keyed by group id. Each `types` list contains
 *  BOTH legacy AND canonical spellings so mixed-vocabulary prod data
 *  surfaces correctly. See file header for `commercial` residual. */
export const TYPE_GROUPS: Readonly<Record<string, PipelineTypeGroup>> = {
  listings: {
    label: "Listings",
    icon: "home",
    // seller (legacy alias, historical prod) + listing (canonical)
    types: ["seller", "listing"],
  },
  buyers: {
    label: "Buyers",
    icon: "key",
    // buyer (legacy alias, currently 6 rows in prod) + purchase (canonical)
    // + buyer_rep (canonical, distinct from purchase per Vault SoT)
    types: ["buyer", "purchase", "buyer_rep"],
  },
  leases: {
    label: "Leases",
    icon: "building",
    types: ["lease"],
  },
  referrals: {
    label: "Referrals",
    icon: "share",
    types: ["referral"],
  },
  other: {
    label: "Other",
    icon: "layers",
    // Preserved from pre-P0-19 for backwards-compatible visible behavior.
    // Vault SoT maps `double_close` → canonical `purchase`, but AP has
    // historically shown these deals under Other; keep as-is until a
    // product decision moves them.
    types: ["wholesale", "double_close"],
  },
} as const;

/** Fixed iteration order for stable UI tab layout. */
export const TYPE_GROUP_ORDER: readonly string[] = [
  "listings",
  "buyers",
  "leases",
  "referrals",
  "other",
] as const;

/** Minimum shape the grouping function needs from a transaction. Everything
 *  the route needs downstream (contract_price, status, agent_id, etc.) is
 *  carried through unchanged — this fn only partitions. */
export interface TypedTransaction {
  readonly type: string | null | undefined;
  readonly [k: string]: unknown;
}

/**
 * Partition a list of transactions into the 5 pipeline buckets.
 * Unknown / null / empty types silently drop (do not throw); a tx appears
 * in AT MOST ONE bucket (bucket type-lists are pairwise disjoint by
 * construction — see the test suite's case 7).
 *
 * The pipeline route uses THIS function for both filtering and rendering
 * so counts and cards can never drift from each other.
 */
export function groupTransactionsByType<T extends TypedTransaction>(
  transactions: readonly T[]
): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const key of TYPE_GROUP_ORDER) {
    out[key] = [];
  }
  for (const tx of transactions) {
    const t = typeof tx.type === "string" ? tx.type : "";
    if (!t) continue;
    for (const key of TYPE_GROUP_ORDER) {
      if (TYPE_GROUPS[key].types.includes(t)) {
        out[key].push(tx);
        break; // types are disjoint; skip the rest
      }
    }
  }
  return out;
}
