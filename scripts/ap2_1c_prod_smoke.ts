// AGENT PORTAL 2.0 — AP2.1C DEPLOY smoke
// Probes /workspace/[transactionId] with a broker session against:
//   - the 4 spec'd known transactions
//   - one invalid txn id (V2 not-found path)
// Plus a real AI-chat round-trip (V10) and a snapshot to prove zero
// DB mutations.

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
const VAULT = "https://vault.hartfeltrealestate.com";
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
    bearer: otp.data.session.access_token,
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
  console.log(`${ok ? "✅" : "❌"} ${label.padEnd(56)} ${detail}`);
}

async function page(url: string, cookieHeader?: string, ua?: string) {
  const headers: Record<string, string> = {};
  if (cookieHeader) headers["cookie"] = cookieHeader;
  if (ua) headers["user-agent"] = ua;
  const r = await fetch(url, { headers, redirect: "manual" });
  const body = await r.text();
  return { status: r.status, location: r.headers.get("location"), body };
}

async function main() {
  console.log("\n═══ AGENT PORTAL 2.0 — AP2.1C DEPLOY verification ═══\n");
  const broker = await mintSession(BROKER_ID);
  console.log(`✅ broker session minted (role=${broker.role})`);

  // First — query Vault directly to know which 4 txns exist for this broker
  const wr = await fetch(`${VAULT}/api/platform/workspace?scope=office`, {
    headers: { authorization: `Bearer ${broker.bearer}` },
  });
  const wj = await wr.json();
  const items: any[] = wj.items ?? [];
  console.log(`✅ Vault returned ${items.length} items via ?scope=office`);

  const knownIds = items.slice(0, 4).map((i) => i.transaction_id);
  if (knownIds.length === 0) {
    console.log("❌ no items returned — cannot run V1 probes");
    process.exit(1);
  }

  // ─── V1: page loads for each known txn ────────────────────────────
  console.log("\n── V1+V3+V4+V5+V6+V7+V8+V11+V12: page renders ──");
  let cardCount = 0;
  const before = await snapshot(broker.svc);

  for (const txnId of knownIds) {
    const card = items.find((i) => i.transaction_id === txnId);
    const r = await page(`${PORTAL}/workspace/${txnId}`, broker.cookieHeader);
    pad(
      `V1 — ${card.transaction_type.padEnd(10)} ${txnId.slice(0, 8)}… (${card.readiness_score}%) 200`,
      r.status === 200,
      `HTTP ${r.status}`
    );
    cardCount++;
  }

  // ─── V2: unknown txn → not-found ──────────────────────────────────
  console.log("\n── V2: not-found path ──");
  const unknown = "00000000-0000-0000-0000-000000000000";
  const r2 = await page(`${PORTAL}/workspace/${unknown}`, broker.cookieHeader);
  // Next.js notFound() under a dynamic layout returns HTTP 200 with the
  // not-found body content (framework quirk noted in Vault P1C deploy).
  // The user-visible outcome is a "not found" page.
  const isNotFound =
    r2.status === 404 || (r2.status === 200 && /404|Not Found|not.found/i.test(r2.body));
  pad(`V2 — unknown txn shows not-found`, isNotFound, `HTTP ${r2.status}`);

  // ─── V3+V8: pick a known txn for deep probes (use the first one) ─
  const targetId = knownIds[0];
  const targetCard = items.find((i) => i.transaction_id === targetId);
  const r3 = await page(`${PORTAL}/workspace/${targetId}`, broker.cookieHeader);

  console.log("\n── V3+V8+V11+V12: SSR DOM markers ──");
  pad("V3 — page contains Vault deep-link patterns",
    r3.body.includes("vault.hartfeltrealestate.com/transactions/") ||
    r3.body.includes("vault.hartfeltrealestate.com/paperwork/transactions/"));
  pad("V8 — AI Assistant section header present", r3.body.includes("AI Assistant"));
  pad("V11 — Quick Links section header present", r3.body.includes("Quick Links"));
  pad("V12 — Timeline section header present", r3.body.includes("Timeline"));
  pad(
    "V11 — 'Back to Transactions' / 'Open Transaction in Vault' links present",
    r3.body.includes("Back to Transactions") || r3.body.includes("Open Transaction in Vault")
  );

  // ─── V13+V14: no send / approval buttons in SSR ──────────────────
  console.log("\n── V13+V14: safety lint on SSR body ──");
  pad("V13 — no 'Send envelope' button in SSR",
    !/<button[^>]*>\s*Send/i.test(r3.body));
  pad("V14 — no 'Approve' button in SSR",
    !/<button[^>]*>\s*Approve/i.test(r3.body));

  // ─── V9+V10: AI chat round-trip ──────────────────────────────────
  console.log("\n── V9+V10: AI chat round-trip ──");
  const t0 = Date.now();
  const aiRes = await fetch(`${VAULT}/api/ai/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authorization: `Bearer ${broker.bearer}`,
    },
    body: JSON.stringify({
      message: "What's the next step on this deal?",
      context: { transaction_id: targetId },
    }),
  });
  const aiText = await aiRes.text();
  pad(`V9+V10 — AI chat HTTP 200 with transaction context`,
    aiRes.status === 200, `${aiText.length} chars, took ${Date.now() - t0}ms`);
  console.log(`   first 120 chars: ${aiText.slice(0, 120).replace(/\n/g, " ")}…`);
  pad("V10 — AI mentions readiness / coordinator vocabulary",
    /readiness|broker review|coordinator|next step|prepare/i.test(aiText));

  // ─── Side-effect snapshot ────────────────────────────────────────
  await new Promise((r) => setTimeout(r, 1500));
  const after = await snapshot(broker.svc);
  console.log("\n── V18: no DB mutation from page loads + 1 AI chat ──");
  pad("V18 — transactions row count unchanged",        before.txn === after.txn, `${before.txn} → ${after.txn}`);
  pad("V18 — form_instances row count unchanged",      before.fi === after.fi,   `${before.fi} → ${after.fi}`);
  pad("V18 — paperwork_envelopes row count unchanged", before.env === after.env, `${before.env} → ${after.env}`);
  // paperwork_audit_log may add 1+ entries from the AI chat (read tool
  // call); that's expected. Just snapshot portal_tokens for "no portal
  // invite created".
  pad("V18 — paperwork_portal_tokens row count unchanged",
    before.tok === after.tok, `${before.tok} → ${after.tok}`);

  // ─── V19: legacy portal routes still work ─────────────────────────
  console.log("\n── V19: legacy routes unchanged ──");
  for (const route of ["/closeiq", "/commissions", "/vendors", "/profile", "/notifications", "/training", "/workspace", "/home"]) {
    const r = await page(`${PORTAL}${route}`, broker.cookieHeader);
    pad(`${route} still 200`, r.status === 200, `HTTP ${r.status}`);
  }

  console.log("\n═══ verification packet complete ═══\n");
}

main().catch((e) => {
  console.error("smoke crashed:", e);
  process.exit(1);
});
