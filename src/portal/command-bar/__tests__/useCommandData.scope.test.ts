/**
 * @jest-environment jsdom
 */
// ============================================================================
// P4H-15 — CommandBar `useCommandData` scopes its own `client_profiles` SELECT
// ============================================================================
// Before: the hook issued `supabase.from("client_profiles").select(...)` with
// zero filters, counting on RLS as its only defence. These tests prove the
// SELECT now carries the SAME predicates the server routes do:
//   - tenant_id = caller's tenant (always)
//   - for agent / new_agent: assigned_agent_id = me OR claimed_by = me OR
//     (visibility='dispo_feed' AND status='dispo')
//   - broker / admin / office_manager: tenant-only
// And when either lookup fails, the SELECT does not run at all — the hook
// falls through to an empty client list rather than an unfiltered read.
// ============================================================================

// Mock the shared supabase browser client this hook imports.
const mockGetSession = jest.fn();
const fromCalls: Array<{
  table: string;
  select?: string;
  eqs: Array<{ field: string; value: unknown }>;
  ors: string[];
  terminal?: { data: any; error: any };
}> = [];

function makeChain(terminal: { data: any; error: any }) {
  const call = fromCalls[fromCalls.length - 1];
  call.terminal = terminal;
  const chain: any = {
    select(cols: string) {
      call.select = cols;
      return chain;
    },
    eq(field: string, value: unknown) {
      call.eqs.push({ field, value });
      return chain;
    },
    or(expr: string) {
      call.ors.push(expr);
      return chain;
    },
    order() {
      return chain;
    },
    limit() {
      // Supabase builders are PostgrestFilterBuilders — thenable, so you can
      // keep chaining `.or()` after `.limit()`. Mirror that so the real
      // builder's "await executes" semantics do not falsely pass our test.
      return chain;
    },
    maybeSingle() {
      return Promise.resolve(terminal);
    },
    single() {
      return Promise.resolve(terminal);
    },
    then(resolve: any, reject: any) {
      return Promise.resolve(terminal).then(resolve, reject);
    },
  };
  return chain;
}

// `from()` returns a chain whose terminal is seeded by the test (one per table).
const tableTerminals: Record<string, { data: any; error: any }> = {};
function resetTerminals() {
  for (const k of Object.keys(tableTerminals)) delete tableTerminals[k];
}

jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
    },
    from(table: string) {
      fromCalls.push({ table, eqs: [], ors: [] });
      return makeChain(tableTerminals[table] ?? { data: [], error: null });
    },
  },
}));

// Stop the hook's /platform/workspace fetch from hitting the network.
global.fetch = jest.fn(async () =>
  new Response("{}", { status: 500 }),
) as unknown as typeof fetch;

import { renderHook, waitFor } from "@testing-library/react";
import { useCommandData } from "@/src/portal/command-bar/useCommandData";

beforeEach(() => {
  fromCalls.length = 0;
  resetTerminals();
  mockGetSession.mockReset();
});

describe("P4H-15 — CommandBar scopes its client_profiles SELECT", () => {
  it("[CB-1] a signed-in agent scopes by tenant AND the agent policy OR", async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          access_token: "tok",
          user: { id: "agent-mallory" },
        },
      },
    });
    tableTerminals["profiles"] = {
      data: { role: "agent", tenant_id: "tenant-HF" },
      error: null,
    };
    tableTerminals["client_profiles"] = { data: [], error: null };

    const { result } = renderHook(() => useCommandData(true));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const cpCall = fromCalls.find((c) => c.table === "client_profiles");
    expect(cpCall).toBeDefined();
    expect(cpCall!.eqs).toContainEqual({ field: "tenant_id", value: "tenant-HF" });
    expect(cpCall!.ors).toHaveLength(1);
    expect(cpCall!.ors[0]).toContain("assigned_agent_id.eq.agent-mallory");
    expect(cpCall!.ors[0]).toContain("claimed_by.eq.agent-mallory");
    expect(cpCall!.ors[0]).toContain("visibility.eq.dispo_feed");
  });

  it("[CB-2] a broker scopes by tenant ONLY — no agent-ownership OR", async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          access_token: "tok",
          user: { id: "broker-1" },
        },
      },
    });
    tableTerminals["profiles"] = {
      data: { role: "broker", tenant_id: "tenant-HF" },
      error: null,
    };
    tableTerminals["client_profiles"] = { data: [], error: null };

    const { result } = renderHook(() => useCommandData(true));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const cpCall = fromCalls.find((c) => c.table === "client_profiles");
    expect(cpCall).toBeDefined();
    expect(cpCall!.eqs).toContainEqual({ field: "tenant_id", value: "tenant-HF" });
    expect(cpCall!.ors).toHaveLength(0);
  });

  it("[CB-3] missing tenant on the caller's profile ⇒ NO client_profiles SELECT at all (fail closed)", async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          access_token: "tok",
          user: { id: "orphan" },
        },
      },
    });
    tableTerminals["profiles"] = {
      data: { role: "agent", tenant_id: null },
      error: null,
    };
    tableTerminals["client_profiles"] = { data: [{ id: "SHOULD_NOT_APPEAR" }], error: null };

    const { result } = renderHook(() => useCommandData(true));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(fromCalls.find((c) => c.table === "client_profiles")).toBeUndefined();
    expect(result.current.clients).toEqual([]);
  });

  it("[CB-4] a profile read failure ⇒ NO client_profiles SELECT at all (fail closed)", async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          access_token: "tok",
          user: { id: "ghost" },
        },
      },
    });
    tableTerminals["profiles"] = { data: null, error: null };
    tableTerminals["client_profiles"] = { data: [{ id: "SHOULD_NOT_APPEAR" }], error: null };

    const { result } = renderHook(() => useCommandData(true));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(fromCalls.find((c) => c.table === "client_profiles")).toBeUndefined();
    expect(result.current.clients).toEqual([]);
  });

  it("[CB-5] not signed in ⇒ hook exits without touching the DB", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    const { result } = renderHook(() => useCommandData(true));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(fromCalls).toHaveLength(0);
    expect(result.current.error).toBe("Not signed in");
  });
});
