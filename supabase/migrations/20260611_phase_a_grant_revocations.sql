-- ============================================================================
-- Phase A — Grant revocations on 5 hardened tables
-- (Priority 1 from Vault writer coordination audit, 2026-06-04)
-- ============================================================================
-- Background
-- ----------
-- Following Tracks E (compliance_alerts), F.2 (notifications), G.1
-- (compliance_issues), G.2 (compliance_checks), and G.3
-- (document_verification_log), every targeted policy has been tightened
-- to authenticated + broker/admin or equivalent role-gated shape. The
-- final security hardening step is to REVOKE the wide-open grants that
-- still sit underneath those policies — they remain a defense-in-depth
-- gap even though the policies would currently reject anything outside
-- broker/admin.
--
-- This migration applies the Phase A revocations approved per
-- Priority-1 audit. Phase B/C/D follow in later sprints (EASE
-- migration to Vault API + final revocations on notifications +
-- compliance_alerts when EASE coordination completes).
--
-- Pre-flight PF-GRANT (operator-run, June 4) confirmed:
--   * compliance_alerts already at Phase-A target (Track E revoked
--     wide-open grants previously) — REVOKE statements below are
--     no-ops against compliance_alerts but kept for declarative
--     completeness and idempotency
--   * compliance_checks, compliance_issues, document_verification_log,
--     notifications: full 28-row baseline (4 roles × 7 privileges),
--     no prior partial revocation
--   * RLS enabled on all 5 tables, not forced
--   * Policies match expected post-G.3 hardened inventory (no loose
--     policies, no drift)
--
-- F.2 sub-option A2 posture continuation:
--   * service_role grants UNCHANGED on all 5 tables
--   * postgres grants UNCHANGED on all 5 tables
--   * RLS policies UNCHANGED
--   * No code changes
--
-- Authenticated grants preserved per audit Section 4:
--   * notifications: SELECT, INSERT, UPDATE
--   * compliance_alerts: SELECT, INSERT, UPDATE
--   * compliance_checks: SELECT, INSERT
--   * compliance_issues: SELECT, INSERT
--   * document_verification_log: (none — full revoke)
--
-- Anon grants on all 5 tables: fully revoked. No anon-role writer or
-- reader exists for any of these tables per the consumer inventory in
-- Vault, EASE, and Agents-Portal. EASE uses the anon publishable key
-- as base, but every operational write/read in EASE occurs only after
-- login — under the `authenticated` role, not `anon`.
--
-- Idempotency
-- -----------
-- PostgreSQL REVOKE is idempotent against absent privileges. Re-running
-- this migration is safe. compliance_alerts statements are explicit
-- no-ops against grants that were already revoked in Track E
-- (20260605_compliance_alerts_hardening.sql).
--
-- Rollback (manual, NOT recommended)
-- ----------------------------------
-- To restore wide-open grants:
--   GRANT ALL ON public.notifications              TO anon, authenticated;
--   GRANT ALL ON public.compliance_alerts          TO anon, authenticated;
--   GRANT ALL ON public.compliance_checks          TO anon, authenticated;
--   GRANT ALL ON public.compliance_issues          TO anon, authenticated;
--   GRANT ALL ON public.document_verification_log  TO anon, authenticated;
-- Rolling back is a security regression; do not run without explicit
-- sprint approval.
-- ============================================================================

-- ------------------------------------------------------------------
-- TABLE 1: notifications
-- ------------------------------------------------------------------
-- Authenticated keeps: SELECT (3 read paths), INSERT (broker writers
-- via Vault broker-review-panel + EASE BrokerChatScreen/DocReviewScreen
-- + Agents-Portal page hooks), UPDATE (Vault dashboard markAllRead +
-- Agents-Portal mark-as-read via read_at)

REVOKE ALL ON public.notifications FROM anon;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.notifications FROM authenticated;

-- ------------------------------------------------------------------
-- TABLE 2: compliance_alerts
-- ------------------------------------------------------------------
-- Track E already revoked anon entirely + DELETE/TRUNCATE/REFERENCES/
-- TRIGGER from authenticated. These statements are no-ops; preserved
-- for declarative completeness so a future PF-GRANT diff would still
-- show the migration source applying the expected target state.
--
-- Authenticated keeps: SELECT, INSERT, UPDATE (EASE DocReviewScreen
-- flag/review flow + Agents-Portal compliance/scan).

REVOKE ALL ON public.compliance_alerts FROM anon;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.compliance_alerts FROM authenticated;

-- ------------------------------------------------------------------
-- TABLE 3: compliance_checks
-- ------------------------------------------------------------------
-- Authenticated keeps: SELECT (Vault ai/compliance-check pre-check
-- validation via SSR userClient), INSERT (Agents-Portal compliance/
-- scan post Track G.2). No userClient UPDATE/DELETE writers exist.

REVOKE ALL ON public.compliance_checks FROM anon;
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.compliance_checks FROM authenticated;

-- ------------------------------------------------------------------
-- TABLE 4: compliance_issues
-- ------------------------------------------------------------------
-- Authenticated keeps: SELECT (Vault ai/compliance-check pre-check
-- validation), INSERT (Agents-Portal compliance/scan post Track G.1).

REVOKE ALL ON public.compliance_issues FROM anon;
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.compliance_issues FROM authenticated;

-- ------------------------------------------------------------------
-- TABLE 5: document_verification_log
-- ------------------------------------------------------------------
-- Full revoke from both anon and authenticated. Zero userClient
-- consumers exist in any repo (Vault writer at /api/broker/documents/
-- verify uses service-role; Agents-Portal writer at /api/compliance/
-- review uses service-role via withServiceRole). service_role bypasses
-- RLS and retains its grants — the only post-migration write path.

REVOKE ALL ON public.document_verification_log FROM anon;
REVOKE ALL ON public.document_verification_log FROM authenticated;

-- ============================================================================
-- Out of scope for this migration:
--   * service_role grants on any table
--   * postgres grants on any table
--   * RLS policies on any table
--   * any code path
--   * document_analysis (separate sprint)
--   * storage buckets
--   * notifications policy (Phase D will revisit once EASE migration completes)
-- ============================================================================
