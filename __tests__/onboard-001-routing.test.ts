// ============================================================================
// ONBOARD-001 — Landing-decision source-shape guards
// ============================================================================
// Two files own the "where does an authenticated user land" contract:
//   1. `app/api/login/route.ts` — fires on real login POST
//   2. `app/page.tsx`           — fires on visits to `/`
//
// A third file (`middleware.ts`) was previously a hard-lock gate on the
// same signal (`training_progress.volume_completed`); after ONBOARD-001
// it is authentication-only and MUST NOT branch on onboarding.
//
// These tests pin the exact source strings that encode the three-way
// contract — role, onboarding signal, target routes — so a future
// refactor that silently drops a branch or changes a target string is
// caught before code review. Behavioral tests that exercise the real
// Supabase client require a considerably larger mock stack; the
// deployment gates (`next build` + prod smoke verification) cover the
// runtime side. This file is the last line of defense against string
// drift.
// ============================================================================

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = resolve(__dirname, "..");
const read = (relPath: string) => readFileSync(resolve(REPO_ROOT, relPath), "utf-8");

const LOGIN_SRC = read("app/api/login/route.ts");
const ROOT_SRC = read("app/page.tsx");
const MIDDLEWARE_SRC = read("middleware.ts");

describe("ONBOARD-001 — /api/login/route.ts landing decision", () => {
  it("reads the onboarding signal from training_progress (volume='volume-1', volume_completed)", () => {
    expect(LOGIN_SRC).toMatch(/\.from\(\s*['"]training_progress['"]\s*\)/);
    expect(LOGIN_SRC).toMatch(/\.select\(\s*['"]volume_completed['"]\s*\)/);
    expect(LOGIN_SRC).toMatch(/\.eq\(\s*['"]volume['"]\s*,\s*['"]volume-1['"]\s*\)/);
  });

  it("branches to '/home' for onboarded agents", () => {
    expect(LOGIN_SRC).toContain("'/home'");
  });

  it("branches to '/training' for un-onboarded agents", () => {
    expect(LOGIN_SRC).toContain("'/training'");
  });

  it("keeps the Vault dashboard target for admin/broker roles", () => {
    expect(LOGIN_SRC).toContain("https://vault.hartfeltrealestate.com/dashboard");
  });

  it("no longer sends agents to the legacy '/dashboard' shell as the default", () => {
    // The prior contract landed EVERY agent at `/dashboard`. Post-ONBOARD-001
    // the string is unused in the landing decision. Any reintroduction is
    // a regression.
    expect(LOGIN_SRC).not.toContain(": '/dashboard'");
    expect(LOGIN_SRC).not.toContain('? "/dashboard"');
  });

  it("uses `maybeSingle` (not `single`) on the onboarding read — un-onboarded users have no row", () => {
    // `.single()` throws on 0 rows; `.maybeSingle()` returns null. A fresh
    // agent has no `training_progress` row until pcert-l01 fires the
    // bridge, so we MUST accept null.
    expect(LOGIN_SRC).toContain(".maybeSingle()");
  });
});

describe("ONBOARD-001 — app/page.tsx (root '/') mirrors the login decision", () => {
  it("is a server component (no 'use client' directive)", () => {
    // Route decisions should be server-driven; a client-side redirect
    // paints a loading spinner before the branch, and can be paused by
    // slow hydration.
    expect(ROOT_SRC).not.toMatch(/^['"]use client['"]/m);
  });

  it("redirects unauth visitors to '/login'", () => {
    expect(ROOT_SRC).toMatch(/redirect\(\s*['"]\/login['"]\s*\)/);
  });

  it("redirects broker/admin to the Vault dashboard", () => {
    expect(ROOT_SRC).toContain("https://vault.hartfeltrealestate.com/dashboard");
  });

  it("reads the same onboarding signal as the login route", () => {
    expect(ROOT_SRC).toMatch(/\.from\(\s*['"]training_progress['"]\s*\)/);
    expect(ROOT_SRC).toMatch(/\.select\(\s*['"]volume_completed['"]\s*\)/);
    expect(ROOT_SRC).toMatch(/\.eq\(\s*['"]volume['"]\s*,\s*['"]volume-1['"]\s*\)/);
  });

  it("branches to /home for onboarded agents and /training for un-onboarded", () => {
    expect(ROOT_SRC).toContain("'/home'");
    expect(ROOT_SRC).toContain("'/training'");
  });
});

describe("ONBOARD-001 — middleware.ts is authentication-only", () => {
  it("no longer imports the service-role Supabase client", () => {
    // The training gate needed service-role to bypass RLS. Removing that
    // import is the smoking-gun signal that the gate is gone.
    expect(MIDDLEWARE_SRC).not.toMatch(
      /from\s+['"]@supabase\/supabase-js['"]/,
    );
    expect(MIDDLEWARE_SRC).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("no longer reads training_progress or volume_completed (in code, not comments)", () => {
    // The historical explanation stays in the file header so future
    // readers know why the training gate was removed. What must NOT
    // appear is any live Supabase query on those columns.
    expect(MIDDLEWARE_SRC).not.toMatch(/\.from\(\s*['"]training_progress['"]\s*\)/);
    expect(MIDDLEWARE_SRC).not.toMatch(/\.select\(\s*['"]volume_completed['"]\s*\)/);
    expect(MIDDLEWARE_SRC).not.toMatch(/\.eq\(\s*['"]volume['"]\s*,\s*['"]volume-1['"]\s*\)/);
  });

  it("does not redirect authenticated users to /training", () => {
    // Grep-based negative — matches the exact prior gate call shape.
    expect(MIDDLEWARE_SRC).not.toMatch(
      /NextResponse\.redirect\(\s*new URL\(\s*['"]\/training['"]/,
    );
  });

  it("does not maintain a TRAINING_GATE_ALLOWED allowlist any more", () => {
    expect(MIDDLEWARE_SRC).not.toContain("TRAINING_GATE_ALLOWED");
  });

  it("still redirects unauthenticated requests to /login", () => {
    // The one thing middleware DOES keep.
    expect(MIDDLEWARE_SRC).toMatch(
      /NextResponse\.redirect\(\s*new URL\(\s*['"]\/login['"]/,
    );
  });
});
