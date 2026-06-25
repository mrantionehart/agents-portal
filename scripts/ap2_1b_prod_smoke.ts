// AGENT PORTAL 2.0 — AP2.1B DEPLOY smoke
// Probes the deployed /workspace screen on agents.hartfeltrealestate.com
// with a broker session, verifies the page server-renders cards from
// Vault, and confirms zero legacy regressions.

import * as fs from "fs";
import * as path from "path";

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
  const { count: fi } = await svc.from("form_instances").select("*", { count: "exact", head: true });
  const { count: env } = await svc.from("paperwork_envelopes").select("*", { count: "exact", head: true });
  const { count: tok } = await svc.from("paperwork_portal_tokens").select("*", { count: "exact", head: true });
  return { txn, fi, env, tok };
}

function pad(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "✅" : "❌"} ${label.padEnd(58)} ${detail}`);
}

async function get(url: string, cookieHeader?: string, ua?: string) {
  const headers: Record<string, string> = {};
  if (cookieHeader) headers["cookie"] = cookieHeader;
  if (ua) headers["user-agent"] = ua;
  const r = await fetch(url, { headers, redirect: "manual" });
  const body = await r.text();
  return { status: r.status, location: r.headers.get("location"), body };
}

async function main() {
  console.log("\n═══ AGENT PORTAL 2.0 — AP2.1B DEPLOY verification ═══\n");

  const broker = await mintSession(BROKER_ID);
  console.log(`✅ broker session minted (role=${broker.role})`);

  // ─── V2 deploy reachable ──────────────────────────────────────────
  console.log("\n── V2: deploy reachable ──");
  const noauth = await get(`${PORTAL}/workspace`);
  pad("V2 — /workspace unauth → 307 /login (middleware)",
    noauth.status === 307 && (noauth.location ?? "").endsWith("/login"),
    `HTTP ${noauth.status} → ${noauth.location}`);

  // ─── snapshot before ──────────────────────────────────────────────
  const before = await snapshot(broker.svc);

  // ─── V3+V5+V7: authenticated /workspace renders cards ────────────
  console.log("\n── V3+V5+V7: authenticated /workspace ──");
  const r3 = await get(`${PORTAL}/workspace`, broker.cookieHeader);
  pad("V3 — broker GET /workspace returns 200", r3.status === 200,
    `HTTP ${r3.status} body=${r3.body.length}b`);
  pad("V3 — Vault token forwarded server-side (no error banner)",
    r3.status === 200 && !/Please sign in to view|don't have permission/i.test(r3.body));

  // ─── V8: card field shape sanity (visible in SSR) ─────────────────
  console.log("\n── V8: card fields ──");
  pad("V8 — page heading 'Workspace' present", r3.body.includes("Workspace"));
  pad("V8 — 'Active transactions' description present",
    r3.body.toLowerCase().includes("active transactions"));

  // Look for any card readiness % digits and badge labels.
  const has87 = /\b87\b[^<]*%|>87<[^>]*>.*%/.test(r3.body);
  const has100 = /\b100\b[^<]*%|>100<[^>]*>.*%/.test(r3.body);
  const has54 = /\b54\b[^<]*%|>54<[^>]*>.*%/.test(r3.body);
  pad("V8 — at least one card with readiness % rendered",
    has87 || has100 || has54 || /\b\d{1,3}\s*%/.test(r3.body));

  pad("V8 — 'Ready for Broker Review' badge present", r3.body.includes("Ready for Broker Review"));
  pad("V8 — 'Ready for Signature Prep' badge present", r3.body.includes("Ready for Signature Prep"));
  pad("V8 — 'Awaiting Party Disclosure' badge present", r3.body.includes("Awaiting Party Disclosure"));
  pad("V8 — 'Broker Confirmation Required' badge present", r3.body.includes("Broker Confirmation Required"));

  // ─── V9: filter chips render ──────────────────────────────────────
  console.log("\n── V9: filter chips ──");
  pad("V9 — All chip rendered", /All\s*\(\d+\)/.test(r3.body));
  pad("V9 — Ready for Review chip rendered", /Ready for Review\s*\(\d+\)/.test(r3.body));
  pad("V9 — Ready for Signature chip rendered", /Ready for Signature\s*\(\d+\)/.test(r3.body));
  pad("V9 — Needs More Info chip rendered", /Needs More Info\s*\(\d+\)/.test(r3.body));
  pad("V9 — type chips render", r3.body.includes("Lease") && r3.body.includes("Listing") &&
    r3.body.includes("Buyer Rep") && r3.body.includes("Purchase"));

  // ─── V10: action links render (4 per card) ────────────────────────
  console.log("\n── V10: action links ──");
  pad("V10 — 'Continue' link present", r3.body.includes(">Continue<"));
  pad("V10 — 'Open Transaction' link present", r3.body.includes("Open Transaction"));
  pad("V10 — 'Open Paperwork' link present", r3.body.includes("Open Paperwork"));
  pad("V10 — 'Continue with AI' link present", r3.body.includes("Continue with AI"));
  pad("V10 — Vault transaction deep-links present",
    r3.body.includes("vault.hartfeltrealestate.com/transactions/"));
  pad("V10 — Vault paperwork deep-links present",
    r3.body.includes("vault.hartfeltrealestate.com/paperwork/transactions/"));

  // ─── V11/V12: no send buttons, no POST verbs in SSR ───────────────
  console.log("\n── V11+V12: no send / POST ──");
  pad("V11 — no 'Send envelope' button in SSR",
    !/<button[^>]*>\s*Send/i.test(r3.body));
  pad("V11 — no 'Approve' button in SSR",
    !/<button[^>]*>\s*Approve/i.test(r3.body));
  pad("V12 — no `method:\"POST\"` literal in SSR body",
    !/method:\s*['"]POST['"]/.test(r3.body));

  // ─── V9 mobile UA ─────────────────────────────────────────────────
  console.log("\n── responsive: mobile UA ──");
  const r9 = await get(`${PORTAL}/workspace`, broker.cookieHeader,
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15");
  pad("mobile UA serves 200", r9.status === 200, `HTTP ${r9.status}`);

  // ─── V16: legacy routes unchanged ─────────────────────────────────
  console.log("\n── V16: legacy routes still ship ──");
  for (const route of ["/closeiq", "/commissions", "/vendors", "/profile", "/notifications", "/training"]) {
    const r = await get(`${PORTAL}${route}`, broker.cookieHeader);
    pad(`${route} still 200`, r.status === 200, `HTTP ${r.status} body=${r.body.length}b`);
  }

  // ─── V13: no DB mutation from the page load ───────────────────────
  await new Promise((r) => setTimeout(r, 1500));
  const after = await snapshot(broker.svc);
  console.log("\n── V13: side-effect proof ──");
  pad("V13 — transactions row count unchanged", before.txn === after.txn, `${before.txn} → ${after.txn}`);
  pad("V13 — form_instances row count unchanged", before.fi === after.fi, `${before.fi} → ${after.fi}`);
  pad("V13 — paperwork_envelopes row count unchanged", before.env === after.env, `${before.env} → ${after.env}`);
  pad("V13 — paperwork_portal_tokens row count unchanged", before.tok === after.tok, `${before.tok} → ${after.tok}`);

  console.log("\n═══ verification packet complete ═══\n");
}

main().catch((e) => {
  console.error("smoke crashed:", e);
  process.exit(1);
});
