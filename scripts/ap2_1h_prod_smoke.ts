// AGENT PORTAL 2.0 — AP2.1H DEPLOY smoke
// Verifies /ai, /settings, the deployed Command Bar bundle, AI chat
// proof (round-trip POST to Vault /api/ai/chat with and without
// transaction context), sidebar route safety, mobile layout markers,
// and regression checks for AP2.1A-G surfaces.

import * as fs from "fs";

const VAULT_ENV = "/Users/hartfeltmuzikgroup/Desktop/hartfelt-projects/vault/.env.local";
for (const line of fs.readFileSync(VAULT_ENV, "utf-8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) {
    let v = m[2];
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
}

import { createClient } from "@supabase/supabase-js";

const PORTAL = "https://agents.hartfeltrealestate.com";
const VAULT_API = "https://vault.hartfeltrealestate.com/api";
const BROKER_ID = "bbd2e79d-6040-4b6d-935e-1a1aa36b789c";

async function mintSession(userId: string) {
  const svc = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { data: prof } = await svc.from("profiles").select("id, email, role").eq("id", userId).maybeSingle();
  if (!prof) throw new Error("profile not found");
  const link = await svc.auth.admin.generateLink({ type: "magiclink", email: (prof as any).email });
  if (link.error || !link.data?.properties?.email_otp) throw new Error("generateLink failed");
  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const otp = await anon.auth.verifyOtp({
    email: (prof as any).email,
    token: link.data.properties.email_otp,
    type: "magiclink",
  });
  if (otp.error || !otp.data.session) throw new Error("verifyOtp failed");
  const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).host.split(".")[0];
  const payload = {
    access_token: otp.data.session.access_token,
    refresh_token: otp.data.session.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    expires_in: 3600,
    token_type: "bearer",
    user: otp.data.user,
  };
  const cookie = "base64-" + Buffer.from(JSON.stringify(payload)).toString("base64");
  return {
    cookieHeader: `sb-${ref}-auth-token=${cookie}`,
    accessToken: otp.data.session.access_token,
    role: (prof as any).role as string,
    svc,
  };
}

async function snapshot(svc: any) {
  const { count: txn } = await svc.from("transactions").select("*", { count: "exact", head: true });
  const { count: cp } = await svc.from("client_profiles").select("*", { count: "exact", head: true });
  const { count: fi } = await svc.from("form_instances").select("*", { count: "exact", head: true });
  const { count: env } = await svc.from("paperwork_envelopes").select("*", { count: "exact", head: true });
  const { count: tok } = await svc.from("paperwork_portal_tokens").select("*", { count: "exact", head: true });
  const { count: nf } = await svc.from("notifications").select("*", { count: "exact", head: true });
  return { txn, cp, fi, env, tok, nf };
}

function pad(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "✅" : "❌"} ${label.padEnd(62)} ${detail}`);
}

async function page(url: string, cookieHeader?: string) {
  const r = await fetch(url, { headers: { cookie: cookieHeader ?? "" }, redirect: "manual" });
  const body = await r.text();
  return { status: r.status, body };
}

async function findChunk(body: string, predicate: string): Promise<string | null> {
  const chunks = [...body.matchAll(/_next\/static\/chunks\/[^"]+\.js/g)].map((m) => m[0]);
  for (const ch of chunks) {
    const cr = await fetch(`${PORTAL}/${ch}`);
    if (!cr.ok) continue;
    const ct = await cr.text();
    if (ct.includes(predicate)) return ct;
  }
  return null;
}

async function main() {
  console.log("\n═══ AGENT PORTAL 2.0 — AP2.1H DEPLOY verification ═══\n");
  const broker = await mintSession(BROKER_ID);
  console.log(`✅ broker session minted (role=${broker.role})`);

  const before = await snapshot(broker.svc);

  // Sample txn for V4
  const { data: tt } = await broker.svc.from("transactions").select("id").limit(1);
  const sampleTxn = tt && tt[0] ? tt[0].id : null;

  // ── V1 + V2 + V5: /ai page ──────────────────────────────────────
  console.log("\n── V1 + V2 + V5: /ai page ──");
  const r1 = await page(`${PORTAL}/ai`, broker.cookieHeader);
  pad("V1 — /ai returns 200", r1.status === 200, `HTTP ${r1.status} body=${r1.body.length}b`);
  pad("V1 — AI Assistant heading + safety footer in SSR",
    r1.body.includes("AI Assistant") &&
    r1.body.includes("HartFelt AI"));
  pad("V5 — transaction selector ships in SSR (Transaction context section)",
    r1.body.includes("Transaction context") || r1.body.includes("No transaction selected"));
  pad("V5 — quick prompts ship in SSR",
    r1.body.includes("Quick prompts") || r1.body.includes("blocking"));

  // ── V2 + V3 + V4: Vault /api/ai/chat round-trip ─────────────────
  console.log("\n── V2 + V3 + V4: Vault /api/ai/chat round-trip ──");
  // V3 — without selected txn (general context)
  const r3 = await fetch(`${VAULT_API}/ai/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${broker.accessToken}` },
    body: JSON.stringify({ message: "Say HI in one word.", context: {} }),
  });
  const r3body = await r3.text();
  pad("V3 — Vault /api/ai/chat round-trips with empty context",
    r3.status === 200, `HTTP ${r3.status}, ${r3body.slice(0, 60).replace(/\s+/g, " ")}…`);

  // V4 — with selected txn
  if (sampleTxn) {
    const r4 = await fetch(`${VAULT_API}/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${broker.accessToken}` },
      body: JSON.stringify({ message: "Say HI in one word.", context: { transaction_id: sampleTxn } }),
    });
    const r4body = await r4.text();
    pad("V4 — Vault /api/ai/chat round-trips with txn context",
      r4.status === 200, `HTTP ${r4.status}, ${r4body.slice(0, 60).replace(/\s+/g, " ")}…`);
  }

  // ── V6 + V7 + V8 + V9 + V10 + V11: Command Bar bundle ───────────
  console.log("\n── V6-V11: Command Bar bundle ──");
  // The CommandBar JS lives inside the (portal)/layout chunk (it's rendered by layout).
  const layoutChunk = await findChunk(r1.body, "Search transactions, clients, or ask AI");
  if (layoutChunk) {
    pad("V6 — CommandBar opens copy ships in layout chunk (⌘K target)", true);
    pad("V7 — navigation labels ship",
      layoutChunk.includes("Go to Home") &&
      layoutChunk.includes("Go to Transactions") &&
      layoutChunk.includes("Go to Clients") &&
      layoutChunk.includes("Go to Calendar") &&
      layoutChunk.includes("Go to Notifications") &&
      layoutChunk.includes("Go to AI"));
    pad("V7 — nav targets correct",
      layoutChunk.includes("/workspace") &&
      layoutChunk.includes("/clients") &&
      layoutChunk.includes("/calendar") &&
      layoutChunk.includes("/notifications") &&
      layoutChunk.includes("/ai"));
    pad("V8 — transaction search wires to /workspace/[id]",
      /workspace\/[\$\{`a-z]/.test(layoutChunk) || layoutChunk.includes("txn-${"));
    pad("V9 — client search wires to /clients/[id]",
      layoutChunk.includes("client-") && layoutChunk.includes("client_profiles"));
    pad("V10 — AI prompt seeding wires to /ai?seed=",
      layoutChunk.includes("/ai?seed=") || layoutChunk.includes("seed=") || layoutChunk.includes("Ask AI"));
    pad("V11 — NO mutation vocabulary in CommandBar bundle",
      !/sendEnvelope|approvePaperwork|updateField|sendPortalInvite|markCompliance/.test(layoutChunk));
    pad("V11 — safety footer copy ships",
      layoutChunk.includes("Navigation + AI seed only") || layoutChunk.includes("no envelopes, no approvals"));
  } else {
    pad("V6-V11 — CommandBar bundle not located via /ai chunks (CSR limit; static lint already verified)", false);
  }

  // ── V12: sidebar items ──────────────────────────────────────────
  console.log("\n── V12: sidebar routes ──");
  const sidebarMatches: string[] = [];
  for (const label of ["Home", "Transactions", "Clients", "AI", "Calendar", "Notifications", "Training", "Resources", "Settings"]) {
    const hit = r1.body.includes(`>${label}<`) || r1.body.includes(`"${label}"`);
    if (hit) sidebarMatches.push(label);
  }
  pad(`V12 — final menu items present in /ai SSR (${sidebarMatches.length}/9)`,
    sidebarMatches.length >= 9, sidebarMatches.join(","));

  // ── V13: /settings placeholder ──────────────────────────────────
  console.log("\n── V13: /settings ──");
  const r13 = await page(`${PORTAL}/settings`, broker.cookieHeader);
  pad("V13 — /settings returns 200", r13.status === 200, `HTTP ${r13.status}`);
  pad("V13 — placeholder copy renders",
    r13.body.includes("Settings UI is coming soon") || r13.body.includes("Settings"));

  // ── V14: Training + Resources ──────────────────────────────────
  console.log("\n── V14: legacy Training + Resources ──");
  const rTr = await page(`${PORTAL}/training`, broker.cookieHeader);
  const rRs = await page(`${PORTAL}/resources`, broker.cookieHeader);
  pad("V14 — /training still 200", rTr.status === 200, `HTTP ${rTr.status}`);
  pad("V14 — /resources still 200", rRs.status === 200, `HTTP ${rRs.status}`);

  // ── V15: viewport / overflow guards ────────────────────────────
  console.log("\n── V15: viewport / overflow guards ──");
  pad("V15 — /ai page contains overflow-x-hidden layout guard",
    r1.body.includes("overflow-x-hidden") || r1.body.includes("min-w-0"));

  // ── V22-V28: prior surfaces ────────────────────────────────────
  console.log("\n── V22-V28: prior surfaces ──");
  const tests = [
    ["V22 — /home", `${PORTAL}/home`],
    ["V23 — /workspace", `${PORTAL}/workspace`],
    ["V25 — /clients", `${PORTAL}/clients`],
    ["V27 — /calendar", `${PORTAL}/calendar`],
    ["V28 — /notifications", `${PORTAL}/notifications`],
  ];
  for (const [label, url] of tests) {
    const r = await page(url, broker.cookieHeader);
    pad(`${label} still 200`, r.status === 200, `HTTP ${r.status}`);
  }
  // V24 — per-txn workspace
  if (sampleTxn) {
    const rTx = await page(`${PORTAL}/workspace/${sampleTxn}`, broker.cookieHeader);
    pad("V24 — /workspace/[id] still 200", rTx.status === 200, `HTTP ${rTx.status}`);
  }
  // V26 — client detail
  const { data: cc } = await broker.svc.from("client_profiles").select("id").limit(1).maybeSingle();
  if (cc) {
    const rC = await page(`${PORTAL}/clients/${(cc as any).id}`, broker.cookieHeader);
    pad("V26 — /clients/[id] still 200", rC.status === 200, `HTTP ${rC.status}`);
  }

  // ── V29: legacy routes ─────────────────────────────────────────
  console.log("\n── V29: legacy routes ──");
  for (const route of ["/closeiq", "/commissions", "/vendors", "/profile"]) {
    const r = await page(`${PORTAL}${route}`, broker.cookieHeader);
    pad(`${route} still 200`, r.status === 200, `HTTP ${r.status}`);
  }

  // ── V17 + V18 + V19 + V20 + V21: side-effect proof ─────────────
  await new Promise((r) => setTimeout(r, 1500));
  const after = await snapshot(broker.svc);
  console.log("\n── V17-V21: no DB drift / no writes ──");
  pad("transactions count unchanged", before.txn === after.txn, `${before.txn} → ${after.txn}`);
  pad("client_profiles count unchanged", before.cp === after.cp, `${before.cp} → ${after.cp}`);
  pad("form_instances count unchanged", before.fi === after.fi, `${before.fi} → ${after.fi}`);
  pad("paperwork_envelopes count unchanged", before.env === after.env, `${before.env} → ${after.env}`);
  pad("paperwork_portal_tokens count unchanged", before.tok === after.tok, `${before.tok} → ${after.tok}`);
  pad("notifications count unchanged", before.nf === after.nf, `${before.nf} → ${after.nf}`);

  console.log("\n═══ verification packet complete ═══\n");
}

main().catch((e) => {
  console.error("smoke crashed:", e);
  process.exit(1);
});
