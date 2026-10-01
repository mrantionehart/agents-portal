// ---------------------------------------------------------------------------
// AP-TRAINING-SIGN-1 — training video authorization is server-side
//
// Before this change /api/training/sign-video authenticated but never
// authorized: any signed-in portal or EASE user could pass any
// training/**.mp4 key and receive a playable URL, which made
// `training_modules.required_role` unenforceable. Prod evidence: one broker
// completed all three videos of the admin+office_manager module, and one
// agent started one — the restriction was bypassed in practice, not merely
// in theory.
//
// Role contract (derived for the portal, not inherited from Vault):
//   • portal, EASE and Vault share ONE Supabase project, so `profiles.role`
//     and `training_modules.required_role` are the same rows everywhere.
//   • reading `profiles.role` inline is the portal's own idiom.
//   • EASE's AGENT_TRAINING_ROLES is a UI routing rule, strictly narrower
//     than required_role — it can withhold a screen, never grant access.
// ---------------------------------------------------------------------------
import { roleMayAccessModule } from '../video-authorization';
import * as fs from 'node:fs';
import * as path from 'node:path';

const REPO = path.resolve(__dirname, '../../..');
const read = (rel: string) => fs.readFileSync(path.join(REPO, rel), 'utf8');
const stripTs = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

const SIGN = 'app/api/training/sign-video/route.ts';
const CATALOG = 'app/api/training/catalog/route.ts';

// The one genuinely restricted module in prod.
const RESTRICTED = ['admin', 'office_manager'];
// The six broad modules.
const BROAD = ['agent', 'new_agent', 'broker', 'admin', 'office_manager'];

describe('AP-TRAINING-SIGN-1 — authorization predicate', () => {
  it('[APT-1] NULL / empty required_role is unrestricted', () => {
    for (const open of [null, undefined, [] as string[]]) {
      for (const role of ['agent', 'new_agent', 'broker', 'admin', 'office_manager', 'internal_staff', null]) {
        expect(roleMayAccessModule(open, role)).toBe(true);
      }
    }
  });

  it('[APT-2] restricted module admits only its listed roles', () => {
    expect(roleMayAccessModule(RESTRICTED, 'admin')).toBe(true);
    expect(roleMayAccessModule(RESTRICTED, 'office_manager')).toBe(true);
    // The two roles with real prod progress on this module are now denied.
    expect(roleMayAccessModule(RESTRICTED, 'broker')).toBe(false);
    expect(roleMayAccessModule(RESTRICTED, 'agent')).toBe(false);
    for (const denied of ['new_agent', 'manager', 'internal_staff', 'tc']) {
      expect(roleMayAccessModule(RESTRICTED, denied)).toBe(false);
    }
  });

  it('[APT-3] every EASE AGENT_TRAINING_ROLE keeps the six broad modules', () => {
    // EASE shows the Training Academy to exactly these four.
    for (const role of ['agent', 'new_agent', 'broker', 'admin']) {
      expect(roleMayAccessModule(BROAD, role)).toBe(true);
    }
  });

  it('[APT-4] a caller with no resolvable role never reaches a restricted module', () => {
    expect(roleMayAccessModule(RESTRICTED, null)).toBe(false);
    expect(roleMayAccessModule(RESTRICTED, '')).toBe(false);
    expect(roleMayAccessModule(null, null)).toBe(true); // …but unrestricted is fine
  });

  it('[APT-5] matching is exact — no prefix/substring admission', () => {
    expect(roleMayAccessModule(['admin'], 'admin_readonly')).toBe(false);
    expect(roleMayAccessModule(['admin'], 'superadmin')).toBe(false);
    expect(roleMayAccessModule(['office_manager'], 'manager')).toBe(false);
  });
});

describe('AP-TRAINING-SIGN-1 — sign-video enforces before signing', () => {
  const src = stripTs(read(SIGN));

  it('[APT-6] resolves the key to a video', () => {
    expect(src).toMatch(/resolveVideoByKey\s*\(\s*admin\s*,\s*key\s*\)/);
  });

  it('[APT-7] an unresolvable key is denied, never signed', () => {
    expect(src).toMatch(/if\s*\(\s*!video\s*\)\s*\{[\s\S]{0,220}?status:\s*403/);
  });

  it('[APT-8] enforces the module allowlist', () => {
    expect(src).toMatch(/if\s*\(\s*!roleMayAccessModule\([\s\S]{0,140}?status:\s*403/);
  });

  it('[APT-9] role comes from profiles, never from the request', () => {
    expect(src).toMatch(/resolveCallerRole\s*\(\s*admin\s*,\s*user\.userId\s*\)/);
    expect(src).not.toMatch(/searchParams\.get\(\s*['"`]role['"`]\s*\)/);
    expect(src).not.toMatch(/headers\.get\(\s*['"`]x-[a-z-]*role/i);
  });

  it('[APT-10] a denied request never reaches the signer', () => {
    // Ordering is the guarantee: both 403s are emitted before the R2 client
    // is built and before getSignedUrl is called.
    // Anchor on the CALL SITES. `src.indexOf('getR2Client()')` finds the
    // function DECLARATION near the top of the file and reports the signer as
    // running before the denial — a false failure. Caught in verification.
    const denyAt = src.lastIndexOf('status: 403');
    const r2At = src.search(/=\s*getR2Client\(\)/);
    const signAt = src.indexOf('await getSignedUrl(');
    expect(denyAt).toBeGreaterThan(-1);
    expect(r2At).toBeGreaterThan(denyAt);
    expect(signAt).toBeGreaterThan(denyAt);
  });
});

describe('AP-TRAINING-SIGN-1 — EASE response contract preserved', () => {
  const src = stripTs(read(SIGN));

  it('[APT-11] success shape is still { url, key, bucket, expires_in }', () => {
    expect(src).toMatch(/url:\s*signedUrl/);
    expect(src).toMatch(/\bkey,/);
    expect(src).toMatch(/\bbucket,/);
    expect(src).toMatch(/expires_in:\s*ttlSec/);
  });

  it('[APT-12] existing status codes and lowercase error bodies are unchanged', () => {
    expect(src).toMatch(/error:\s*'unauthorized'[\s\S]{0,40}status:\s*401/);
    expect(src).toMatch(/error:\s*'invalid or missing key'[\s\S]{0,40}status:\s*400/);
    expect(src).toMatch(/error:\s*'failed to sign video url'[\s\S]{0,40}status:\s*500/);
    // The new denial follows the same lowercase convention.
    expect(src).toMatch(/error:\s*'forbidden'/);
  });

  it('[APT-13] still accepts both Bearer and cookie auth (EASE uses Bearer)', () => {
    expect(src).toMatch(/authorization/i);
    expect(src).toMatch(/bearer /i);
    expect(src).toMatch(/createServerClient/);
  });

  it('[APT-14] private, no-store caching retained', () => {
    expect(src).toMatch(/'Cache-Control':\s*'private, no-store'/);
  });
});

describe('AP-TRAINING-SIGN-1 — catalog stops handing out unplayable keys', () => {
  const src = stripTs(read(CATALOG));

  it('[APT-15] filters modules through the shared predicate', () => {
    expect(src).toMatch(/roleMayAccessModule/);
    expect(src).toMatch(/visibleModules/);
  });

  it('[APT-16] narrows videos to the visible modules', () => {
    expect(src).toMatch(/visibleModuleIds/);
    expect(src).toMatch(/visibleVideos/);
  });

  it('[APT-17] response keys are unchanged for existing consumers', () => {
    expect(src).toMatch(/modules:\s*visibleModules/);
    expect(src).toMatch(/videos:\s*visibleVideos/);
    expect(src).toMatch(/progress:\s*progress \|\| \[\]/);
  });

  it('[APT-18] reads only the caller OWN profile row', () => {
    expect(src).toMatch(/from\('profiles'\)\s*\.select\('role'\)\s*\.eq\('id',\s*user\.id\)/);
  });

  it('[APT-19] progress stays scoped to the caller', () => {
    expect(src).toMatch(
      /\.select\('video_id, watched_seconds, completed'\)\s*\.eq\('user_id',\s*user\.id\)/
    );
  });
});
