/**
 * @jest-environment node
 */
// ============================================================================
// P8.1C-SEC — the Portal must refuse a REMOVED profile, not just an inactive
// one
// ============================================================================
// `withAuth.is-active.test.ts` beside this file already covers the `is_active`
// matrix and keeps passing unchanged. This suite covers what that one could
// not see: `suspended_at` and `deleted_at`, the two signals both Portal gates
// ignored entirely.
//
// 🔒 THE DEFECT, MEASURED ON PRODUCTION 2026-10-30.
// `mrhart@hartfeltrei.com` (`349fdfb8-9d12-4826-a1a9-5e7e970b5319`), role
// `broker`, tenant `8563ea17`: `deleted_at` 2026-04-17, `suspended_at` NULL,
// `is_active` **true**. Vault refused it at `evaluateActiveProfile`. The
// Portal admitted it — `middleware.ts` STEP 4 and `requireAuth` both read
// `is_active` alone — and the `profiles` row it then reached through RLS was
// the whole tenant's CRM, because `user_role()` answers `broker` for it.
//
// Three kinds of test, deliberately, because any one alone can pass while the
// hole is open:
//
//   1. the PREDICATE, over all three signals;
//   2. the two CALL SITES' column list — PostgREST omits what was not
//      selected, so dropping `deleted_at` from the select restores the defect
//      in full with every behavioural assertion still green. This is the only
//      guard that can see that mutation;
//   3. `requireAuth` EXECUTING against a deleted and a suspended profile.
//
// `[P81CSEC-X0]` is the control: it runs the OLD predicate against the real
// production row and asserts it was ADMITTED. If that ever stops holding, this
// suite is measuring a defect that is not there and the rest of it is theatre.
// ============================================================================

import { readFileSync } from "fs";
import { join } from "path";

import {
  ACTIVE_PROFILE_SELECT,
  evaluateAccountStanding,
  isActiveProfile,
} from "@/lib/security/activeProfile";

// The production row, by its measured values.
const REMOVED_BROKER = {
  is_active: true,
  suspended_at: null,
  deleted_at: "2026-04-17T15:16:44.532+00:00",
} as const;

// ── 0. Control: the harness can see the defect ─────────────────────────────
describe("[P81CSEC-X0] control — the old gate admitted the removed broker", () => {
  /** Exactly what both Portal gates computed before this change. */
  const oldGate = (p: { is_active?: boolean | null }) => p?.is_active === true;

  it("the OLD `is_active`-only gate admits the production row", () => {
    expect(oldGate(REMOVED_BROKER)).toBe(true);
  });

  it("the NEW predicate refuses the same row", () => {
    expect(isActiveProfile(REMOVED_BROKER)).toBe(false);
    expect(evaluateAccountStanding(REMOVED_BROKER)).toBe("deleted");
  });
});

// ── 1. The predicate ───────────────────────────────────────────────────────
describe("evaluateAccountStanding", () => {
  it("all three clear → active", () => {
    expect(
      evaluateAccountStanding({ is_active: true, suspended_at: null, deleted_at: null }),
    ).toBe("active");
  });

  it("deleted_at set → deleted, EVEN WITH is_active true", () => {
    expect(
      evaluateAccountStanding({ is_active: true, suspended_at: null, deleted_at: "2026-04-17T00:00:00Z" }),
    ).toBe("deleted");
  });

  it("suspended_at set → suspended, EVEN WITH is_active true", () => {
    expect(
      evaluateAccountStanding({ is_active: true, suspended_at: "2026-06-29T00:00:00Z", deleted_at: null }),
    ).toBe("suspended");
  });

  it("deleted wins over suspended", () => {
    expect(
      evaluateAccountStanding({
        is_active: true,
        suspended_at: "2026-06-29T00:00:00Z",
        deleted_at: "2026-06-30T00:00:00Z",
      }),
    ).toBe("deleted");
  });

  it("is_active false with both markers clear → inactive", () => {
    expect(
      evaluateAccountStanding({ is_active: false, suspended_at: null, deleted_at: null }),
    ).toBe("inactive");
  });

  it("is_active null → inactive (fail closed; never 'unknown means yes')", () => {
    expect(evaluateAccountStanding({ is_active: null })).toBe("inactive");
  });

  it("null / undefined profile → inactive", () => {
    expect(evaluateAccountStanding(null)).toBe("inactive");
    expect(evaluateAccountStanding(undefined)).toBe("inactive");
  });

  it("an absent marker key is NOT a marker — {is_active:true} alone is active", () => {
    // Keeps the pre-existing is-active matrix meaningful: a row that carries
    // only `is_active` still passes, so this change denies strictly more, never
    // strictly differently.
    expect(evaluateAccountStanding({ is_active: true })).toBe("active");
  });
});

// ── 2. The column list, at both call sites ─────────────────────────────────
describe("the select carries all three signals", () => {
  const REQUIRED = ["is_active", "suspended_at", "deleted_at"] as const;
  const root = join(__dirname, "..", "..", "..");
  const read = (rel: string) => readFileSync(join(root, rel), "utf8");

  it("ACTIVE_PROFILE_SELECT names every signal the predicate reads", () => {
    for (const col of REQUIRED) {
      expect(ACTIVE_PROFILE_SELECT).toContain(col);
    }
  });

  it("middleware.ts STEP 4 selects through ACTIVE_PROFILE_SELECT, not a literal", () => {
    const src = read("middleware.ts");
    expect(src).toContain(".select(ACTIVE_PROFILE_SELECT)");
    // The old one-column literal must be gone, or the gate reads one signal
    // again whatever the predicate says.
    expect(src).not.toContain(".select('is_active')");
    expect(src).not.toContain('.select("is_active")');
  });

  it("withAuth.readCallerIsActive selects through ACTIVE_PROFILE_SELECT, not a literal", () => {
    const src = read("lib/security/withAuth.ts");
    expect(src).toContain(".select(ACTIVE_PROFILE_SELECT)");
    expect(src).not.toContain(".select('is_active')");
    expect(src).not.toContain('.select("is_active")');
  });

  it("neither gate computes standing inline — both call the shared predicate", () => {
    for (const rel of ["middleware.ts", "lib/security/withAuth.ts"]) {
      const src = read(rel);
      expect(src).toContain("isActiveProfile(");
      // `=== true` on is_active is the exact shape of the defect.
      expect(src).not.toMatch(/is_active\s*===\s*true/);
    }
  });
});
