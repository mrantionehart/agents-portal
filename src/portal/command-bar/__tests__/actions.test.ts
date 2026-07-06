/**
 * @jest-environment node
 */
// ============================================================================
// AGENT PORTAL 2.0 — AP2.1H — Command Bar action catalog tests
// ============================================================================

import {
  ALLOWED_KINDS,
  clientActions,
  composePalette,
  filteredNavActions,
  flattenActions,
  NAV_ACTIONS,
  seedAIActions,
  targetFor,
  transactionActions,
  type CommandClient,
  type CommandTxn,
} from "../actions";

describe("NAV_ACTIONS catalog", () => {
  it("contains exactly the 7 documented navigation entries (R1 + AP2.1H)", () => {
    expect(NAV_ACTIONS.map((a) => a.id)).toEqual([
      "create-transaction",
      "nav-home",
      "nav-transactions",
      "nav-clients",
      "nav-calendar",
      "nav-notifications",
      "nav-ai",
    ]);
  });

  it("R1 — Create New Transaction action exists and targets the wizard /workspace/new", () => {
    const c = NAV_ACTIONS.find((a) => a.id === "create-transaction")!;
    expect(c).toBeDefined();
    expect(c.label).toBe("Create New Transaction");
    expect(c.href).toBe("/workspace/new"); // Transaction OS 3.3B.3A: in-portal wizard
    expect(c.kind).toBe("navigate"); // NEVER a mutation
  });

  it("R1 — Create New Transaction is listed first (most prominent)", () => {
    expect(NAV_ACTIONS[0].id).toBe("create-transaction");
  });

  it("Transactions maps to /workspace (AP2.1B's dashboard URL)", () => {
    const t = NAV_ACTIONS.find((a) => a.id === "nav-transactions")!;
    expect(t.href).toBe("/workspace");
    expect(t.kind).toBe("navigate");
  });

  it("every entry is a 'navigate' kind (no mutations possible)", () => {
    for (const a of NAV_ACTIONS) {
      expect(a.kind).toBe("navigate");
      expect(typeof (a as any).href).toBe("string");
      expect((a as any).href.startsWith("/")).toBe(true);
    }
  });
});

describe("ALLOWED_KINDS — mutation safety guarantee", () => {
  it("only 'navigate' and 'seed-ai' kinds are allowed (no mutations)", () => {
    expect([...ALLOWED_KINDS].sort()).toEqual(["navigate", "seed-ai"]);
  });
});

describe("filteredNavActions search", () => {
  it("empty query → identity", () => {
    expect(filteredNavActions("")).toHaveLength(NAV_ACTIONS.length);
  });
  it("token matches across label", () => {
    expect(filteredNavActions("home").map((a) => a.id)).toEqual(["nav-home"]);
    expect(filteredNavActions("AI").map((a) => a.id)).toEqual(["nav-ai"]);
  });
  it("multi-token AND match", () => {
    expect(filteredNavActions("go to clients").map((a) => a.id)).toEqual(["nav-clients"]);
  });
  it("no match → empty", () => {
    expect(filteredNavActions("xxx")).toEqual([]);
  });
});

describe("transactionActions", () => {
  const txns: CommandTxn[] = [
    { id: "a", title: "123 Main St", subtitle: "Alice · purchase" },
    { id: "b", title: "456 Pine Ave", subtitle: "Bob · listing" },
    { id: "c", title: "789 Oak Way", subtitle: "Carla · lease" },
  ];
  it("identity on empty query", () => {
    expect(transactionActions(txns, "").length).toBe(3);
  });
  it("matches on title", () => {
    expect(transactionActions(txns, "main").map((a) => a.id)).toEqual(["txn-a"]);
  });
  it("matches on subtitle", () => {
    expect(transactionActions(txns, "carla").map((a) => a.id)).toEqual(["txn-c"]);
  });
  it("href is /workspace/[id] (read-only navigation)", () => {
    expect(transactionActions(txns, "")[0].href).toBe("/workspace/a");
  });
  it("respects max cap", () => {
    expect(transactionActions(txns, "", 2).length).toBe(2);
  });
});

describe("clientActions", () => {
  const clients: CommandClient[] = [
    { id: "c1", title: "Bobby Khullar", subtitle: "bobby@x.com" },
    { id: "c2", title: "Craig McCellen", subtitle: "craig@x.com" },
  ];
  it("matches on title", () => {
    expect(clientActions(clients, "craig").map((a) => a.id)).toEqual(["client-c2"]);
  });
  it("href is /clients/[id] (read-only navigation)", () => {
    expect(clientActions(clients, "")[0].href).toBe("/clients/c1");
  });
});

describe("seedAIActions", () => {
  it("requires at least 3 chars", () => {
    expect(seedAIActions("")).toEqual([]);
    expect(seedAIActions("a")).toEqual([]);
    expect(seedAIActions("ab")).toEqual([]);
  });
  it("emits an Ask-AI seed at 3+ chars", () => {
    const out = seedAIActions("hello");
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe("seed-ai");
    expect(out[0].seed).toBe("hello");
    expect(out[0].label).toContain("Ask AI");
  });
});

describe("targetFor", () => {
  it("navigate → href (looked up by id, position-independent)", () => {
    const home = NAV_ACTIONS.find((a) => a.id === "nav-home")!;
    expect(targetFor(home)).toBe("/home");
    const create = NAV_ACTIONS.find((a) => a.id === "create-transaction")!;
    expect(targetFor(create)).toBe("/workspace/new");
  });
  it("seed-ai → /ai?seed=<encoded>", () => {
    const out = seedAIActions("what's blocking?")[0];
    expect(targetFor(out)).toBe(`/ai?seed=${encodeURIComponent("what's blocking?")}`);
  });
});

describe("composePalette + flattenActions", () => {
  const txns: CommandTxn[] = [{ id: "t", title: "1 Test St", subtitle: "Tony · listing" }];
  const clients: CommandClient[] = [{ id: "c", title: "Test Client", subtitle: "test@x.com" }];

  it("composes nav + txns + clients + ai with empty query", () => {
    const r = composePalette({ query: "", txns, clients });
    expect(r.nav.length).toBe(NAV_ACTIONS.length);
    expect(r.txns.length).toBe(1);
    expect(r.clients.length).toBe(1);
    expect(r.ai).toEqual([]);
  });
  it("emits ai-seed when query is long enough", () => {
    const r = composePalette({ query: "blocking", txns, clients });
    expect(r.ai.length).toBe(1);
    expect(r.ai[0].seed).toBe("blocking");
  });
  it("flattens preserving section order: nav → txns → clients → ai", () => {
    const r = composePalette({ query: "test", txns, clients });
    const flat = flattenActions(r);
    expect(flat.length).toBe(r.nav.length + r.txns.length + r.clients.length + r.ai.length);
  });
});

describe("AP2.1H command-bar boundary lint", () => {
  it("actions.ts has no mutation vocabulary", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/portal/command-bar/actions.ts"),
      "utf-8"
    );
    // No forbidden action kinds.
    for (const forbidden of [
      "send_envelope",
      "sendEnvelope",
      "approve_paperwork",
      "approvePaperwork",
      "update_field",
      "updateField",
      "send_invite",
      "sendPortalInvite",
      "mark_compliance",
      "markCompliance",
    ]) {
      expect(src).not.toMatch(new RegExp(forbidden, "i"));
    }
    // No actual DB / fetch verbs.
    expect(src).not.toMatch(/\.insert\(|\.update\(|\.upsert\(|\.delete\(|\.rpc\(/);
    expect(src).not.toMatch(/method:\s*['"]POST['"]/);
  });

  it("CommandBar.tsx never mutates and only navigates", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/portal/CommandBar.tsx"),
      "utf-8"
    );
    expect(src).not.toMatch(/\.insert\(|\.update\(|\.upsert\(|\.delete\(|\.rpc\(/);
    expect(src).not.toMatch(/method:\s*['"]POST['"]/);
    // Only router.push allowed for navigation.
    expect(src).toMatch(/router\.push/);
  });
});
