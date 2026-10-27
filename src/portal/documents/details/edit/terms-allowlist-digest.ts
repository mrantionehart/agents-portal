// ============================================================================
// P4H-13 · The one thing that makes the terms allowlist a real contract
// ============================================================================
// MIRROR of hartfelt-vault/src/lib/paperwork/terms-allowlist-digest.ts.
// Keep the functions and the constant byte-identical in both repos.
//
// The `listing.*` allowlist is written out in FOUR places: this file's
// neighbour editable-fields.ts and its contract test, and Vault's
// TERMS_PATH_ALLOWLIST and its contract test. Each repo's test compared its
// own list against its own literal, so both stayed green while the two repos
// disagreed — which is exactly what happened:
//
//   listing.owners.1.name / .phone / .address   AP offered them for editing,
//                                               Vault REJECTED the write, so
//                                               the edit failed after the
//                                               agent had made it.
//   listing.rental.current_lease_expires        Vault accepted it, AP never
//                                               offered the field, and ERL-14
//                                               maps it to Page1.p01df007.
//
// Neither suite could see it. A test that only checks a repo against itself
// cannot detect that the other repo moved.
//
// THE FIX IS A SHARED DIGEST, not a shared import — the two repos have no
// common package, and adding one to carry fourteen regexes is a worse trade
// than this. Both repos compute the digest of their OWN list and assert it
// equals the SAME constant. Change one side's patterns and that side's CI goes
// red immediately, with a message saying the other repo must move too.
//
// It is not a network check and needs no credentials, so it runs in every CI
// job and in every local run, including on a private repo and offline.
//
// ── WHEN YOU CHANGE THE LISTING ALLOWLIST ──────────────────────────────────
//   1. change the patterns in BOTH repos so the sets are identical;
//   2. run either contract test — it prints the new digest on failure;
//   3. paste that digest into LISTING_ALLOWLIST_DIGEST in BOTH repos.
// ============================================================================

import { createHash } from "crypto";

/**
 * Canonical serialization of the listing allowlist.
 *
 * Sorted and de-duplicated, so the digest describes the SET of patterns and
 * not the order they happen to sit in a file. Reordering a list for
 * readability must not look like a contract change; adding or removing a
 * pattern must.
 */
export function canonicalizeListingAllowlist(
  patterns: ReadonlyArray<RegExp | string>
): string {
  const sources = patterns.map((p) => (typeof p === "string" ? p : p.source));
  const listing = sources.filter((s) => s.startsWith("^listing\\."));
  return [...new Set(listing)].sort().join("\n");
}

/** sha256 of the canonical serialization, as hex. */
export function listingAllowlistDigest(
  patterns: ReadonlyArray<RegExp | string>
): string {
  return createHash("sha256")
    .update(canonicalizeListingAllowlist(patterns))
    .digest("hex");
}

/**
 * The agreed digest. IDENTICAL in hartfelt-vault and lease-audit-ap.
 *
 * Covers the 14 `listing.*` patterns ERL-14 needs. Reconciled 2026-10-27:
 * AP had been offering a second owner's name, phone and address, which this
 * form has no blank for — it carries one printed owner line and two signature
 * slots — and which Vault's route rejected. AP was narrowed to match rather
 * than Vault widened, because storing terms no document reads is how a terms
 * object grows fields nobody can account for. Production carried no such
 * value on any of its 44 transactions with terms, so nothing was orphaned.
 */
export const LISTING_ALLOWLIST_DIGEST =
  "dbfe8fa63522150167165246c5f14bc62e2d0b79b307e15d451ff756af14dc38";
