// ============================================================================
// P4H-13 — the Rental Listing type, end to end through the wizard's plumbing
// ============================================================================
// Runner: jest (NOT vitest — a vitest suite here fails to parse).
//
// The load-bearing assertion is the MARKER. `rental_listing` stores as the
// existing `listing` enum value, so without terms.listing.listing_kind the row
// is indistinguishable from a sale listing: Vault would require ERS-20sa,
// EBLA-13 and SPDR-4x, and block the agent on a seller, a list price and a
// Johnson v. Davis disclosure that an exclusive right to lease does not have.
// ============================================================================

import * as fs from "fs";
import * as path from "path";

import {
  TRANSACTION_TYPE_OPTIONS,
  isCanonicalTransactionType,
  isLeaseType,
} from "../transaction-types";
import { REQUIRED_PARTIES_BY_TYPE } from "../party-requirements";
import {
  toEnumTransactionType,
  TRANSACTION_TYPE_ENUM_VALUES,
} from "@/lib/portal-transaction-type";

describe("the Rental Listing option", () => {
  const option = TRANSACTION_TYPE_OPTIONS.find((t) => t.id === "rental_listing");

  it("[APERL-1] is offered in the type picker, and names the instrument", () => {
    expect(option).toBeDefined();
    expect(option!.label).toBe("Rental Listing");
    expect(option!.description).toMatch(/Exclusive Right to Lease/i);
    expect(option!.description).toMatch(/landlord/i);
  });

  it("[APERL-2] is a canonical type the wizard will accept", () => {
    expect(isCanonicalTransactionType("rental_listing")).toBe(true);
  });

  it("[APERL-3] is NOT the sale listing, and NOT a lease", () => {
    const sale = TRANSACTION_TYPE_OPTIONS.find((t) => t.id === "listing")!;
    expect(sale.description).toMatch(/seller/i);
    expect(option!.id).not.toBe(sale.id);
    // isLeaseType drives lease date relabeling; a rental listing is not a lease.
    expect(isLeaseType("rental_listing")).toBe(false);
  });
});

describe("parties", () => {
  it("[APERL-4] requires a landlord", () => {
    expect(REQUIRED_PARTIES_BY_TYPE.rental_listing).toEqual([
      { role: "landlord", label: "Landlord / owner" },
    ]);
  });

  it("[APERL-5] does NOT require a tenant — the agreement is signed to go find one", () => {
    const roles = REQUIRED_PARTIES_BY_TYPE.rental_listing.map((r) => r.role);
    expect(roles).not.toContain("tenant");
    expect(roles).not.toContain("seller");
  });

  it("[APERL-6] the sale listing's requirement is untouched", () => {
    expect(REQUIRED_PARTIES_BY_TYPE.listing).toEqual([{ role: "seller", label: "Seller" }]);
  });
});

describe("storage mapping", () => {
  it("[APERL-7] stores as the EXISTING 'listing' enum value — no migration", () => {
    expect(toEnumTransactionType("rental_listing")).toBe("listing");
    // And it is deliberately NOT a new enum member.
    expect(TRANSACTION_TYPE_ENUM_VALUES).not.toContain("rental_listing");
  });

  it("[APERL-8] every other mapping is unchanged", () => {
    expect(toEnumTransactionType("listing")).toBe("listing");
    expect(toEnumTransactionType("lease")).toBe("lease");
    expect(toEnumTransactionType("purchase")).toBe("buyer");
    expect(toEnumTransactionType("buyer_rep")).toBe("buyer_rep");
  });
});

describe("the marker the whole feature hangs on", () => {
  const createRoute = fs
    .readFileSync(
      path.join(process.cwd(), "app/api/transactions/create/route.ts"),
      "utf-8",
    )
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  it("[APERL-9] the create route accepts the canonical type", () => {
    const i = createRoute.indexOf("const validTypes");
    expect(i).toBeGreaterThan(-1);
    expect(createRoute.slice(i, createRoute.indexOf("]", i))).toContain("rental_listing");
  });

  it("[APERL-10] it writes terms.listing.listing_kind = 'rental' on insert", () => {
    // Anchored inside the INSERT payload, not the whole file: a match anywhere
    // else would false-pass while the row went in unmarked.
    const i = createRoute.indexOf(".insert({");
    expect(i).toBeGreaterThan(-1);
    const payload = createRoute.slice(i, createRoute.indexOf("})", i));
    expect(payload).toMatch(/type === 'rental_listing'/);
    expect(payload).toMatch(/listing_kind: 'rental'/);
  });

  it("[APERL-11] it marks ONLY a rental listing — a sale listing stays unmarked", () => {
    const i = createRoute.indexOf(".insert({");
    const payload = createRoute.slice(i, createRoute.indexOf("})", i));
    // The write is conditional on the canonical type, not unconditional.
    expect(payload).not.toMatch(/terms:\s*\{\s*listing:\s*\{\s*listing_kind:\s*'rental'\s*\}\s*\}\s*,\s*$/m);
    expect(payload).toContain("?");
  });
});
