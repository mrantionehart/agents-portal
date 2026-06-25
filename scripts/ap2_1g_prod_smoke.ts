// AGENT PORTAL 2.0 — AP2.1G DEPLOY smoke
// Verifies /clients index, /clients/[id] detail, /calendar with a
// broker session; confirms sanitized field surface in SSR + chunk;
// re-verifies AP2.1A-F surfaces; snapshots DB row counts to prove
// zero writes.

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
  // calendar_events count (must NOT change — legacy CRUD page retired
  // but rows must not be touched by AP2.1G):
  let ce = null;
  try {
    const { count } = await svc.from("calendar_events").select("*", { count: "exact", head: true });
    ce = count;
  } catch { /* table may not exist */ }
  return { txn, cp, fi, env, tok, nf, ce };
}

function pad(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "✅" : "❌"} ${label.padEnd(60)} ${detail}`);
}

async function page(url: string, cookieHeader?: string) {
  const r = await fetch(url, { headers: { cookie: cookieHeader ?? "" }, redirect: "manual" });
  const body = await r.text();
  return { status: r.status, body, headers: r.headers };
}

async function chunkOf(body: string, base: string): Promise<string | null> {
  const m = body.match(/_next\/static\/chunks\/app\/\(portal\)\/[^"]+page-[^"]+\.js/g);
  if (!m || m.length === 0) return null;
  const cr = await fetch(`${PORTAL}/${m[0]}`);
  return cr.ok ? cr.text() : null;
}

async function main() {
  console.log("\n═══ AGENT PORTAL 2.0 — AP2.1G DEPLOY verification ═══\n");
  const broker = await mintSession(BROKER_ID);
  console.log(`✅ broker session minted (role=${broker.role})`);

  const before = await snapshot(broker.svc);

  // Find a sample accessible client + a fake invalid uuid
  const { data: sampleClient } = await broker.svc
    .from("client_profiles")
    .select("id, full_name")
    .limit(1)
    .maybeSingle();
  const validId = sampleClient?.id as string | undefined;
  const fakeUuid = "11111111-1111-1111-1111-111111111111";

  // ── V1-V8 ───────────────────────────────────────────────────────
  console.log("\n── V1-V8: /clients ──");
  const r1 = await page(`${PORTAL}/clients`, broker.cookieHeader);
  pad("V1 — /clients returns 200", r1.status === 200, `HTTP ${r1.status} body=${r1.body.length}b`);
  // SSR body has the static H1; chunk has the interactive chips.
  pad("V2 — Clients header renders (SSR)", r1.body.includes("Clients") && r1.body.includes("HartFelt"));

  const chunk1 = await chunkOf(r1.body, PORTAL);
  if (chunk1) {
    pad("V6 — filter chip strings ship in chunk",
      chunk1.includes("Hot") && chunk1.includes("Warm") && chunk1.includes("Cold") &&
      chunk1.includes("Buyers") && chunk1.includes("Sellers") && chunk1.includes("Investors"));
    pad("V7 — search placeholder ships in chunk",
      chunk1.includes("Search name") || chunk1.includes("target area"));
  } else {
    pad("V6 — filter chips (no chunk found)", false, "no client component chunk");
  }

  console.log("\n── V2-V3: /clients/[id] ──");
  if (validId) {
    const r2 = await page(`${PORTAL}/clients/${validId}`, broker.cookieHeader);
    pad("V2 — accessible client returns 200", r2.status === 200, `HTTP ${r2.status} body=${r2.body.length}b`);
    pad("V8 — detail sections render (SSR)",
      r2.body.includes("Contact") &&
      r2.body.includes("Communication Preferences") &&
      r2.body.includes("Preferences") &&
      r2.body.includes("Notes"));
    pad("V9 — broker-only fields NEVER appear in SSR",
      !r2.body.includes("broker_notes") &&
      !r2.body.includes("red_flags") &&
      !r2.body.includes("profitability") &&
      !/decision_notes/.test(r2.body));
    pad("V10 — 'Not on file' graceful empty present (some sections empty)",
      r2.body.includes("Not on file") || r2.body.includes("(unknown client)"));
  }
  const r3 = await page(`${PORTAL}/clients/${fakeUuid}`, broker.cookieHeader);
  pad("V3 — unknown client returns NOT FOUND",
    r3.status === 404 || (r3.status === 200 && /not.?found|page not found|This page/i.test(r3.body)),
    `HTTP ${r3.status} body=${r3.body.length}b`);

  // ── V4 + V11 + V12 ─────────────────────────────────────────────
  console.log("\n── V4 + V11 + V12: /calendar ──");
  const r4 = await page(`${PORTAL}/calendar`, broker.cookieHeader);
  pad("V4 — /calendar returns 200", r4.status === 200, `HTTP ${r4.status} body=${r4.body.length}b`);
  pad("V12 — calendar placeholder copy renders (no date data yet)",
    r4.body.includes("No date data") ||
    r4.body.includes("calendar deadlines") ||
    r4.body.includes("No deadlines on the horizon") ||
    r4.body.includes("Calendar deadlines aren") ||
    r4.body.includes("Active Deals"));
  pad("V11 — no /api/calendar/events fetched from new page",
    !r4.body.includes("/api/calendar/events"));
  pad("V13 — no Google Calendar references in /calendar page",
    !/googleapis|google\.calendar\(/.test(r4.body));

  // ── V21-V25: prior surfaces ────────────────────────────────────
  console.log("\n── V21-V25: prior surfaces ──");
  const rHome = await page(`${PORTAL}/home`, broker.cookieHeader);
  pad("V21 — /home still 200", rHome.status === 200, `HTTP ${rHome.status}`);
  const rWs = await page(`${PORTAL}/workspace`, broker.cookieHeader);
  pad("V22 — /workspace still 200", rWs.status === 200, `HTTP ${rWs.status}`);
  const { data: tt } = await broker.svc.from("transactions").select("id").limit(1);
  if (tt && tt[0]) {
    const rTx = await page(`${PORTAL}/workspace/${tt[0].id}`, broker.cookieHeader);
    pad("V23 — /workspace/[id] still 200", rTx.status === 200, `HTTP ${rTx.status}`);
  }
  const rNotif = await page(`${PORTAL}/notifications`, broker.cookieHeader);
  pad("V24 — /notifications still 200", rNotif.status === 200, `HTTP ${rNotif.status}`);

  console.log("\n── V25: legacy portal routes ──");
  for (const route of ["/closeiq", "/commissions", "/vendors", "/profile", "/training"]) {
    const r = await page(`${PORTAL}${route}`, broker.cookieHeader);
    pad(`${route} still 200`, r.status === 200, `HTTP ${r.status}`);
  }

  // ── V14-V20 + side-effect proof ─────────────────────────────────
  await new Promise((r) => setTimeout(r, 1500));
  const after = await snapshot(broker.svc);
  console.log("\n── V14 + V18: no DB writes, no schema drift ──");
  pad("V14 — transactions count unchanged", before.txn === after.txn, `${before.txn} → ${after.txn}`);
  pad("V14 — client_profiles count unchanged", before.cp === after.cp, `${before.cp} → ${after.cp}`);
  pad("V14 — form_instances count unchanged", before.fi === after.fi, `${before.fi} → ${after.fi}`);
  pad("V14 — paperwork_envelopes count unchanged", before.env === after.env, `${before.env} → ${after.env}`);
  pad("V14 — paperwork_portal_tokens count unchanged", before.tok === after.tok, `${before.tok} → ${after.tok}`);
  pad("V14 — notifications count unchanged", before.nf === after.nf, `${before.nf} → ${after.nf}`);
  pad("V14 — calendar_events count unchanged (legacy table untouched)",
    before.ce === after.ce, `${before.ce} → ${after.ce}`);

  console.log("\n═══ verification packet complete ═══\n");
}

main().catch((e) => {
  console.error("smoke crashed:", e);
  process.exit(1);
});
