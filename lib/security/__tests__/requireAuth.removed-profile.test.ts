/**
 * @jest-environment node
 */
// ============================================================================
// P8.1C-SEC — `requireAuth` EXECUTING against a removed / suspended profile
// ============================================================================
// The predicate and the column list are asserted in `active-profile-gate.
// test.ts`. Neither of those runs the gate. This one does: it drives the real
// `requireAuth` with a Supabase double that answers exactly what PostgREST
// answers for the three production rows, and asserts the 403.
//
// The double returns ONLY the columns the caller selected, which is what
// PostgREST does — so if the select ever loses `deleted_at`, the deleted
// profile arrives here WITHOUT the marker and these tests go red. That makes
// this file a second, independent guard on the column list.
// ============================================================================

type Row = { is_active: boolean | null; suspended_at: string | null; deleted_at: string | null };

let AUTHED_USER: { id: string } | null = null;
let ROW: Row | null = null;
let SELECTED = "";

function fakeSb() {
  return {
    auth: { getUser: async () => ({ data: { user: AUTHED_USER }, error: null }) },
    from: () => ({
      select: (cols: string) => {
        SELECTED = cols;
        return {
          eq: () => ({
            single: async () => {
              if (!ROW) return { data: null, error: { code: "PGRST116", message: "no rows" } };
              // PostgREST projection: only the selected columns come back.
              const asked = cols.split(",").map((c) => c.trim());
              const projected: Record<string, unknown> = {};
              for (const k of asked) if (k in ROW) projected[k] = (ROW as any)[k];
              return { data: projected, error: null };
            },
          }),
        };
      },
    }),
  };
}

jest.mock("@supabase/ssr", () => ({ createServerClient: () => fakeSb() }));
jest.mock("@supabase/supabase-js", () => ({ createClient: () => fakeSb() }));

import { requireAuth } from "@/lib/security/withAuth";

function req(): any {
  return { headers: new Headers(), cookies: { get: () => undefined } };
}

beforeEach(() => {
  AUTHED_USER = { id: "349fdfb8-9d12-4826-a1a9-5e7e970b5319" };
  ROW = null;
  SELECTED = "";
});

async function standing() {
  const r = await requireAuth(req());
  if (r.response) {
    const body = await r.response.json();
    return { status: r.response.status, code: body.code as string };
  }
  return { status: 200, code: "granted" };
}

describe("requireAuth · removed and suspended profiles (production rows)", () => {
  it("the removed broker — deleted_at set, is_active TRUE — is refused 403", async () => {
    // mrhart@hartfeltrei.com as measured 2026-10-30, before remediation.
    ROW = { is_active: true, suspended_at: null, deleted_at: "2026-04-17T15:16:44.532+00:00" };
    expect(await standing()).toEqual({ status: 403, code: "inactive_account" });
  });

  it("a suspended-only profile — suspended_at set, is_active TRUE — is refused 403", async () => {
    ROW = { is_active: true, suspended_at: "2026-06-29T21:43:26.686+00:00", deleted_at: null };
    expect(await standing()).toEqual({ status: 403, code: "inactive_account" });
  });

  it("Michelle Raabe — all three signals set — is refused 403", async () => {
    ROW = {
      is_active: false,
      suspended_at: "2026-06-29T21:43:26.686+00:00",
      deleted_at: "2026-06-30T21:15:35.682+00:00",
    };
    expect(await standing()).toEqual({ status: 403, code: "inactive_account" });
  });

  it("an ACTIVE agent is still granted — this change denies more, not differently", async () => {
    ROW = { is_active: true, suspended_at: null, deleted_at: null };
    expect(await standing()).toEqual({ status: 200, code: "granted" });
  });

  it("the gate asked PostgREST for all three signals", async () => {
    ROW = { is_active: true, suspended_at: null, deleted_at: null };
    await standing();
    for (const col of ["is_active", "suspended_at", "deleted_at"]) {
      expect(SELECTED).toContain(col);
    }
  });
});
