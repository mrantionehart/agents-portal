# Marketing Card — Agent Portal UI (implementation note)

**Status: implemented, NOT deployed.** Consumes the Vault companion contracts.
The whole feature is inert until Vault rolls out the migrations/bucket/flags — the
UI degrades safely (hidden / read-only / "not available yet") until then.

## UI location
A reusable section `MarketingProfileSection` rendered on the authenticated profile
page (`app/profile/page.tsx`, next to `ProfileBirthdaySection`). **Not** duplicated
elsewhere; **not** wired into onboarding (see Placement). No unrelated screens
changed; brokerage-email/license editing permissions and the fixed "Luxury
Advisor" title are untouched (all read-only here).

## Vault endpoints consumed
- `GET  {VAULT_API_URL}/agent/marketing-profile` — self-state.
- `PATCH {VAULT_API_URL}/agent/marketing-profile/phone` — preferred phone.
- `POST {VAULT_API_URL}/agent/avatar` — self headshot upload.

One typed client: `src/portal/marketing-profile/api.ts`
(`getMarketingProfile` / `updatePreferredPublicPhone` / `uploadAvatar`). It
delegates to the canonical `authFetch` (`lib/supabase.ts`) — no duplicate fetch.

## Bearer / CORS model
`authFetch` attaches the **cached** Supabase access token as
`Authorization: Bearer` (it never calls `getSession()` on the request path — the
LockManager hang) and self-heals a 401 once. Requests use **`credentials: 'omit'`**
(the Vault fail-closed CORS contract). Base URL is `VAULT_API_URL`
(`lib/vault-client.ts`, `NEXT_PUBLIC_VAULT_API_URL`) — never guessed from request
headers. The client sends **only** the image / phone field — never `agent_id`,
`tenant_id`, `profile_id`, `bucket`, `path`, or `hash`.

### Deployment-origin requirements
The browser calls Vault cross-origin, so the **Agent Portal origin** must be on
Vault's `AGENT_PORTAL_ALLOWED_ORIGINS` allowlist:
- Production: `https://agents.hartfeltrealestate.com` (Vault default).
- Local dev: `http://localhost:3000` (Vault default).
Verify these before enabling in each environment.

## File formats & size
Accepts `image/jpeg`, `image/png`, `image/webp`; client-side rejects SVG / other
types / empty files / files over **8 MB** (mirrors the Vault request bound). The
**server remains authoritative** (deterministic PNG normalization, MIME/size
re-check). No crop / retouch / beautify / recolor / background / AI / remote-URL /
base64 / target-agent selection. Upload body is the image only.

## Sources of truth (server-owned)
- **Preferred phone:** canonical `preferred_public_phone` only — the UI never
  touches login/SMS/private/emergency phone (none exist on this page). Normalized
  by the server; the UI displays the returned normalized value. Nullable: clearing
  sends `null`.
- **Readiness:** canonical `computeReadiness` from Vault. The browser **never**
  recomputes it and never infers Ready from filled fields — it renders the exact
  `readiness` value + `missingRequirements` (mapped to friendly labels), and
  refreshes after every successful phone/avatar mutation.

## Capability combinations (partial rollout)
Independent capabilities from the server (`avatar.uploadAvailable`,
`marketingCard.phoneUpdateAvailable`):
- Phone available / avatar unavailable → phone editable; upload hidden ("not
  available yet"); no-photo fallback.
- Avatar available / phone unavailable → avatar displays; phone locked; no other
  phone substituted.
- Both unavailable → read-only canonical fields; conservative readiness.
- Both available → full experience.
Raw Vault env flags are never inspected or exposed.

## Privacy / no-persistence
Local preview uses a temporary object URL that is revoked on replacement and on
unmount. No image bytes, display URLs, or responses are persisted to
localStorage / sessionStorage / IndexedDB / durable caches, logs, or analytics.
The transient signed `displayUrl` is rendered directly and refreshed from the
server after upload — never synthesized, never cache-busted with a hash.

## 404 semantics — undeployed route vs structured error
The client parses responses **strictly as the Vault JSON contract** (content-type
must be `application/json`; empty/malformed → non-contract). This distinguishes:
- **A — Undeployed / absent route:** a **non-JSON platform 404** (e.g. Next/Vercel
  HTML 404) → `MarketingProfileError { contract:false, status:404 }` → the additive
  section **hides quietly**; the rest of the profile page is unaffected; no
  disruptive global error.
- **B — Structured Vault JSON 404** (`{ success:false, code:'PROFILE_NOT_FOUND' }`)
  → `contract:true` → a **bounded, retryable message** ("Your marketing profile is
  unavailable right now."), section not hidden.
- **C — 401:** canonical session-expired message.
- **D — Network / CORS** (fetch rejects): "Unable to connect to the profile
  service. Please try again." + retry.
- **E — 403 / 429 / 500 / 503:** bounded mapped messages (capability / rate-limit /
  unavailable).

The client never reads a non-JSON body into any value that could reach a
component, never surfaces raw HTML/text, and preserves only `{ code, status,
contract }`.

## Error mapping (bounded, safe)
Stable Vault codes → friendly text; never SQL/Supabase/stack/bucket/path/hash/
token/signed-URL detail. 400 `PHONE_INVALID`/`PHONE_TOO_LONG`, 401
`UNAUTHENTICATED` (session-expired message), 403 capability, 404
`AVATAR_UPLOAD_DISABLED` (or feature-not-deployed → section hides), 413/415 file,
429 rate-limit, 500/503 unavailable. A **network/CORS** failure (fetch rejects) is
distinguished from a server JSON error and shows "Unable to connect to the profile
service. Please try again." with a retry — no console CORS detail surfaced.

## Current (pre-rollout / mocked) behavior
Tested entirely against mocked Vault responses (`__tests__/`): complete state, no
avatar, each capability combination, each `awaiting_*` / `ready_to_generate`
readiness, upload success/rejection, phone success/validation, rate-limit, infra
unavailable, expired bearer, network/CORS. In production, until Vault deploys the
endpoints, `GET` returns 404 → the section **hides quietly**; a transient
connectivity error shows the safe retry message.

## Placement decision
Headshot + preferred phone are **marketing-card readiness requirements**, surfaced
as **optional profile enhancements** here — NOT onboarding requirements and **not**
a global access blocker. Onboarding remains resumable and unchanged. Making them an
onboarding gate would require separate approval.

## Required public configuration
Client path reads only `NEXT_PUBLIC_*` vars: `NEXT_PUBLIC_VAULT_API_URL`
(explicit Vault base URL — **never** guessed from request Host headers),
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public anon key by
design). **No secret / service-role env** is referenced in this feature or embedded
in the browser bundle. If `NEXT_PUBLIC_VAULT_API_URL` is unset it falls back to the
repo default (`lib/vault-client.ts`); set it per environment. Tests are hermetic
(mocked `VAULT_API_URL` / `authFetch`) and never call production.

## Build / lint / test status (this branch)
- **Production build (`npm run build`):** compiles successfully ("✓ Compiled
  successfully"); the overall build then FAILS at page-data collection for the
  unrelated route `/api/client/deal/[token]` with `[Deal Copilot env] 2 validation
  errors` — a **missing-environment-configuration** failure. **Reproduced
  identically on clean `origin/master`** (stash-verified) → pre-existing baseline,
  not introduced by this branch. My code compiles cleanly in both.
- **Lint:** ESLint is **not a repository dependency**; `next lint` cannot run
  without installing it (declined per instruction). Rely on CI's lint conventions.
- **Typecheck (`tsc --noEmit`):** 0 errors in this feature's files (pre-existing
  baseline errors exist in unrelated files).
- **Tests:** 36 marketing-profile tests pass; full AP suite green except 2
  pre-existing baseline failures (`documents/details/edit/editable.test.ts` reads a
  `../vault` sibling path absent in a worktree).

## Future controlled E2E
After Vault rollout (migrations `20260824`+`20260825`, `agent-avatars` bucket,
`MARKETING_CARD_SCHEMA_ENABLED` / `AVATAR_CANONICAL_ENABLED` / `AVATAR_UPLOAD_READY`
/ `AVATAR_UPLOAD_ENABLED`, AP origin in the allowlist), run a controlled
real-headshot E2E in staging with a test agent. Not performed here.
