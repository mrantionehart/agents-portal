#!/usr/bin/env node
// ============================================================================
// Secret scanner — fail the build if a real credential is committed.
// ============================================================================
// Zero dependencies. Scans every git-tracked text file.
//
//   node scripts/security/scan-secrets.mjs
//
// WHY THIS EXISTS. A production Supabase `service_role` key (full RLS bypass)
// was committed to this repo in an orphaned debug script, and a second copy to
// a sibling repo. Nothing caught it. This gate catches the whole class.
//
// Primary rule: NO committed Supabase JWT whose decoded payload carries a
// project `ref` and `role=service_role`. The local-development demo keys that
// `supabase start` prints have NO `ref` (and expire 2032-11-11); they are the
// documented public defaults and are deliberately allowed. A real project key
// always carries its `ref`.
//
// Plus a short list of live provider-secret prefixes (Stripe, Anthropic,
// SendGrid, Resend, Supabase `sb_secret_`, GitHub PAT, AWS, PEM private keys),
// each guarded by a placeholder heuristic so test fixtures do not trip it.
//
// False positive? Put an inline `secret-scan: allow` comment on that line, or
// add the path to IGNORE_PATHS below. Prefer removing the secret.
// ============================================================================

import cp from "node:child_process";
import fs from "node:fs";

const SKIP_EXT =
  /\.(lock|png|jpe?g|gif|ico|pdf|woff2?|ttf|otf|eot|zip|gz|tgz|mp4|mov|webp|svg|xlsx?|parquet|wasm)$/i;

// Paths that legitimately contain secret-shaped strings (redaction libraries,
// scanner self-tests). Keep this list short and specific.
const IGNORE_PATHS = [
  /(^|\/)scripts\/security\/scan-secrets\.mjs$/,
  /(^|\/)scripts\/r2-bootstrap\/lib\/redact\.py$/,
  /(^|\/)bootstrap\/manifest\/tests\//,
];

const ALLOW_MARK = /secret-scan:\s*allow/i;

const PLACEHOLDER =
  /placeholder|example|dummy|fake|sample|redact|xxxx+|0000+|1234567890|abcdef|your[-_]|replace[-_ ]?with|not[-_ ]?a[-_ ]?real|test[-_]?key/i;

const PROVIDERS = [
  { name: "stripe-live-secret", re: /\bsk_live_[A-Za-z0-9]{20,}\b/ },
  { name: "stripe-live-restricted", re: /\brk_live_[A-Za-z0-9]{20,}\b/ },
  { name: "anthropic-key", re: /\bsk-ant-(?:api03|admin01)-[A-Za-z0-9_-]{24,}\b/ },
  { name: "openai-key", re: /\bsk-[A-Za-z0-9]{32,}\b/ },
  { name: "sendgrid-key", re: /\bSG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/ },
  { name: "stripe-webhook-secret", re: /\bwhsec_[A-Za-z0-9]{20,}\b/ },
  { name: "resend-key", re: /\bre_[A-Za-z0-9]{20,}\b/ },
  { name: "supabase-secret-key", re: /\bsb_secret_[A-Za-z0-9]{16,}\b/ },
  { name: "github-pat", re: /\bghp_[A-Za-z0-9]{36}\b/ },
  { name: "aws-access-key-id", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "pem-private-key", re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[A-Za-z0-9+/=\s]{40,}/ },
];

const JWT = /eyJ[A-Za-z0-9_-]{8,}\.(eyJ[A-Za-z0-9_-]{8,})\.[A-Za-z0-9_-]{6,}/;

function tracked() {
  return cp
    .execSync("git ls-files", { encoding: "utf8", maxBuffer: 1 << 28 })
    .split("\n")
    .filter(Boolean)
    .filter((f) => !SKIP_EXT.test(f))
    .filter((f) => !/(^|\/)package-lock\.json$/.test(f))
    .filter((f) => !/\.example(\.|$)/.test(f));
}

const findings = [];
const files = tracked();

for (const f of files) {
  if (IGNORE_PATHS.some((r) => r.test(f))) continue;
  let txt;
  try {
    txt = fs.readFileSync(f, "utf8");
  } catch {
    continue;
  }
  if (!txt.includes("eyJ") && !/sk[-_]|SG\.|whsec_|re_|sb_secret_|ghp_|AKIA|PRIVATE KEY/.test(txt)) {
    continue; // fast path: nothing secret-shaped in the file
  }
  const lines = txt.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    if (ALLOW_MARK.test(ln)) continue;

    // Supabase JWT with a real project ref
    const g = new RegExp(JWT.source, "g");
    let m;
    while ((m = g.exec(ln))) {
      let p;
      try {
        p = JSON.parse(Buffer.from(m[1], "base64").toString("utf8"));
      } catch {
        continue;
      }
      if (p && p.ref && p.role === "service_role")
        findings.push({ f, line: i + 1, kind: `supabase service_role JWT (ref=${p.ref})`, sev: "CRITICAL" });
      else if (p && p.ref && p.role === "anon")
        findings.push({ f, line: i + 1, kind: `supabase anon JWT (ref=${p.ref})`, sev: "WARN" });
    }

    // Live provider secrets. In TEST files these are structurally-realistic
    // fixtures by design (e.g. config validators assert a real-shaped key is
    // accepted), so they warn rather than fail. The Supabase service_role JWT
    // rule above stays CRITICAL everywhere — that key must never appear at all.
    const isTest = /(^|\/)__tests__\/|\.(test|spec)\.[cm]?[jt]sx?$/.test(f);
    for (const pr of PROVIDERS) {
      const mm = ln.match(pr.re);
      if (mm && !PLACEHOLDER.test(mm[0]))
        findings.push({ f, line: i + 1, kind: pr.name, sev: isTest ? "WARN" : "CRITICAL" });
    }
  }
}

const crit = findings.filter((x) => x.sev === "CRITICAL");
const warn = findings.filter((x) => x.sev === "WARN");

for (const x of findings)
  console.log(`${x.sev === "CRITICAL" ? "✖" : "⚠"} ${x.sev}  ${x.f}:${x.line}  ${x.kind}`);

if (crit.length) {
  console.error(
    `\n✖ secret-scan FAILED: ${crit.length} committed credential(s). ` +
      `Remove the secret from the file, ROTATE it (a committed secret is compromised), ` +
      `and allowlist only a genuine false positive with an inline "secret-scan: allow" comment.`,
  );
  process.exit(1);
}
console.log(
  `✓ secret-scan clean — ${files.length} tracked files scanned` +
    (warn.length ? `, ${warn.length} non-blocking warning(s).` : "."),
);
