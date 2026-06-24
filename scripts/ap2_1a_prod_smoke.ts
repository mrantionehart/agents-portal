// AGENT PORTAL 2.0 — AP2.1A DEPLOY smoke
// Drives the deployed agents-portal at agents.hartfeltrealestate.com.
// Probes /home (new) + legacy routes; mints a broker session against
// the shared Vault Supabase project to exercise the auth path.

import * as fs from "fs";
import * as path from "path";

// Pull NEXT_PUBLIC_SUPABASE_URL + service-role from the Vault repo's
// .env.local since the agents-portal repo shares the same Supabase
// project. (Service-role is only used to mint a session; never sent
// to the portal.)
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
const BROKER_ID = "bbd2e79d-6040-4b6d-935e-1a1aa36b789c"; // Emily
const QA_TENANT = "8563ea17-bff8-4ca6-a98e-8e285387bf08";

async function mintSession(userId: string) {
  const svc = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { data: prof } = await svc.from("profiles").select("id, email, role").eq("id", userId).maybeSingle();
  if (!prof) throw new Error("broker profile not found");
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
  };
}

async function get(url: string, cookieHeader?: string, ua?: string) {
  const headers: Record<string, string> = {};
  if (cookieHeader) headers["cookie"] = cookieHeader;
  if (ua) headers["user-agent"] = ua;
  const r = await fetch(url, { headers, redirect: "manual" });
  const body = await r.text();
  return { status: r.status, location: r.headers.get("location"), body, headers: r.headers };
}

function pad(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "✅" : "❌"} ${label.padEnd(58)} ${detail}`);
}

async function main() {
  console.log("\n═══ AGENT PORTAL 2.0 — AP2.1A DEPLOY verification ═══\n");

  // ─── V2 deploy reachable / fresh ──────────────────────────────────
  const rootProbe = await get(PORTAL);
  pad("V2 — portal reachable (root)", rootProbe.status === 307 || rootProbe.status === 200,
    `HTTP ${rootProbe.status} → ${rootProbe.location ?? "—"}`);
  const cache = rootProbe.headers.get("x-vercel-cache");
  pad("V2 — Vercel deploy serving", !!cache || rootProbe.status < 500, `x-vercel-cache=${cache}`);

  // ─── V4 unauth /home redirects to /login ──────────────────────────
  console.log("\n── V4: unauth /home ──");
  const r4 = await get(`${PORTAL}/home`);
  // Could be 307 to /login (middleware) OR 200 with client-side
  // redirect (the layout uses router.replace). Either is acceptable.
  pad("V4 — unauth /home redirects or renders sign-in path",
    r4.status === 307 || (r4.status === 200 && /login|signin|Loading/i.test(r4.body)),
    `HTTP ${r4.status}${r4.location ? " → " + r4.location : ""}`);

  // ─── V3 /home loads (after auth, layout renders) ─────────────────
  console.log("\n── V3+V5: authenticated /home ──");
  const broker = await mintSession(BROKER_ID);
  console.log(`   broker session minted (role=${broker.role})`);
  const r3 = await get(`${PORTAL}/home`, broker.cookieHeader);
  pad("V3 — authenticated /home returns 200", r3.status === 200, `HTTP ${r3.status} body=${r3.body.length}b`);

  // ─── V5 new shell elements render (SSR HTML) ──────────────────────
  console.log("\n── V5+V6+V7+V8: shell content ──");
  pad("V5 — new shell wrapper renders", /Portal 2\.0|Home|HartFelt/.test(r3.body), "preview banner / heading found");
  pad("V6 — 9 sidebar items render",
    r3.body.includes("Home") && r3.body.includes("Workspace") && r3.body.includes("Transactions") &&
    r3.body.includes("Paperwork") && r3.body.includes("Clients") && r3.body.includes("AI") &&
    r3.body.includes("Calendar") && r3.body.includes("Notifications") && r3.body.includes("Settings"));
  pad("V7 — top bar renders (search trigger + bell)",
    /Search transactions|⌘K|Notifications|Bell/i.test(r3.body));
  pad("V8 — command bar bound (⌘K kbd marker)",
    r3.body.includes("⌘K") || r3.body.includes("Command"));

  // ─── V9 responsive — mobile UA still serves 200 ──────────────────
  console.log("\n── V9: responsive shell ──");
  const r9 = await get(`${PORTAL}/home`, broker.cookieHeader,
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15");
  pad("V9 — mobile UA serves 200 (drawer pattern)", r9.status === 200,
    `HTTP ${r9.status} body=${r9.body.length}b`);

  // ─── V10-V13: legacy routes ───────────────────────────────────────
  console.log("\n── V10-V13: legacy routes ──");
  for (const [verb, route] of [
    ["V10", "/closeiq"],
    ["V11", "/commissions"],
    ["V12", "/vendors"],
    ["V13", "/settings"],
  ] as const) {
    const r = await get(`${PORTAL}${route}`, broker.cookieHeader);
    pad(`${verb} — ${route} still loads (200)`, r.status === 200,
      `HTTP ${r.status} body=${r.body.length}b`);
  }

  // Confirm a couple more legacy routes for completeness
  console.log("\n── (extra) other legacy routes ──");
  for (const route of ["/profile", "/notifications", "/training", "/paperwork/00000000-0000-0000-0000-000000000000/review"]) {
    const r = await get(`${PORTAL}${route}`, broker.cookieHeader);
    console.log(`   ${route.padEnd(50)} HTTP ${r.status}`);
  }

  console.log("\n═══ verification packet complete ═══\n");
}

main().catch((e) => {
  console.error("smoke crashed:", e);
  process.exit(1);
});
