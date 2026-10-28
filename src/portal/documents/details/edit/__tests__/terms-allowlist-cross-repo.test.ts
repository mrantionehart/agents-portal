// ============================================================================
// P4H-13 · The listing allowlist is the SAME SET in both repos
// ============================================================================
// This is the test that would have caught the drift. Its sibling in
// hartfelt-vault (src/lib/paperwork/__tests__/terms-allowlist-cross-repo.test.ts)
// asserts the identical digest against Vault's own list, so whichever repo
// moves alone goes red.
//
// Runner is JEST here, not vitest — a vitest-style suite does not fail in this
// repo, it fails to PARSE, which reads like a broken module.
// ============================================================================

import { TERMS_PATH_ALLOWLIST_MIRROR } from "../editable-fields";
import {
  LISTING_ALLOWLIST_DIGEST,
  listingAllowlistDigest,
  canonicalizeListingAllowlist,
} from "../terms-allowlist-digest";

describe("P4H-13 — listing terms allowlist is a cross-repo contract", () => {
  it("[APXREPO-1] the Portal's listing allowlist hashes to the agreed digest", () => {
    const actual = listingAllowlistDigest(TERMS_PATH_ALLOWLIST_MIRROR);
    expect(actual).toBe(LISTING_ALLOWLIST_DIGEST);
  });

  it("[APXREPO-2] the failure message tells you to move BOTH repos", () => {
    // The guidance lives where someone reading a red build will see it.
    const src = require("fs").readFileSync(
      require("path").join(__dirname, "..", "terms-allowlist-digest.ts"),
      "utf-8"
    );
    expect(src).toMatch(/BOTH repos/);
  });

  it("[APXREPO-3] the digest describes a SET, not a file order", () => {
    const reversed = [...TERMS_PATH_ALLOWLIST_MIRROR].reverse();
    expect(listingAllowlistDigest(reversed)).toBe(
      listingAllowlistDigest(TERMS_PATH_ALLOWLIST_MIRROR)
    );
  });

  it("[APXREPO-4] re-widening the second owner moves the digest", () => {
    // The specific drift this reconciliation closed. ERL-14 has ONE printed
    // owner line and two signature slots; a second owner signs as a
    // transaction_party, which is where the envelope reads recipients from.
    const widened = [
      ...TERMS_PATH_ALLOWLIST_MIRROR,
      /^listing\.owners\.1\.(name|phone|address)$/,
    ];
    expect(listingAllowlistDigest(widened)).not.toBe(LISTING_ALLOWLIST_DIGEST);
  });

  it("[APXREPO-5] the Portal offers exactly what Vault accepts", () => {
    const matches = (p: string) =>
      TERMS_PATH_ALLOWLIST_MIRROR.some((r) => r.test(p));
    // Accepted by Vault, so the Portal must offer it.
    expect(matches("listing.rental.current_lease_expires")).toBe(true);
    expect(matches("listing.owners.0.name")).toBe(true);
    expect(matches("listing.owners.1.email")).toBe(true);
    // Rejected by Vault, so the Portal must not offer it — editing one of
    // these used to fail only after the agent had typed it.
    expect(matches("listing.owners.1.name")).toBe(false);
    expect(matches("listing.owners.1.phone")).toBe(false);
    expect(matches("listing.owners.1.address")).toBe(false);
  });

  it("[APXREPO-6] the canonical set is the 14 listing patterns", () => {
    const canon = canonicalizeListingAllowlist(TERMS_PATH_ALLOWLIST_MIRROR);
    expect(canon.split("\n")).toHaveLength(14);
  });
});
