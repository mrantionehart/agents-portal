-- ============================================================================
-- compliance_checks INSERT — tighten misnamed loose policy
-- (Sprint D-3 Track G.2 — F.2 sub-option A2 posture)
-- ============================================================================
-- Background
-- ----------
-- PF-1 and CC.4 (Track G.1 pre-G.2 drift check, June 9) confirmed:
--
--   policyname:    compliance_checks_insert
--   cmd:           INSERT
--   roles:         {public}
--   qual:          NULL
--   with_check:    true
--
-- The policy permits any role (including anon) to INSERT with
-- WITH CHECK true. Combined with GRANT INSERT TO anon + authenticated
-- (PF-F.2 + CC.3 baseline), any unauthenticated visitor could write
-- compliance_checks rows via PostgREST. Same misnamed-permissive class
-- as compliance_alerts pre-Track-E, notifications pre-F.2, and
-- compliance_issues just-tightened in Track G.1.
--
-- This migration replaces the loose INSERT policy with a role-gated
-- INSERT policy restricted to broker / admin profiles. service_role
-- bypasses RLS as always; the single in-portal writer
-- (app/api/compliance/scan/route.ts line 351) runs under user JWT
-- post-D3 Track E with broker/admin/compliance in-code gate; realistic
-- callers passing the gate are broker or admin only (compliance is not
-- in the user_role enum per PF-UR).
--
-- F.2 sub-option A2 posture — what this migration does and does NOT do:
--
--   DOES:
--     * DROP the misnamed loose compliance_checks_insert policy
--     * CREATE the new role-gated compliance_checks_broker_admin_insert
--       policy
--
--   DOES NOT:
--     * Touch the existing SELECT policy compliance_checks_select
--       (broker/admin OR agent-via-transaction)
--     * Revoke anon or authenticated grants (deferred — Vault writer
--       coordination still open)
--     * Change service_role grants
--     * Modify any code
--
-- Compliance scan flow safety
-- ---------------------------
-- compliance/scan creates a compliance_checks row first, then references
-- it via compliance_check_id in compliance_issues. The dependency order
-- is checks-first, issues-second. Both migrations (G.1 + G.2) tighten
-- INSERT only and preserve SELECT, so the scan's downstream lookup of
-- the just-created check row is unaffected.
--
-- Inbound FK note: CC.7b (Track G read-only audit) showed
-- compliance_issues.compliance_check_id -> compliance_checks.id CASCADE.
-- This migration does not change FK semantics; the CASCADE relationship
-- is unaffected.
--
-- Pre-flight evidence
-- -------------------
--   * PF-1, CC.4 — confirmed loose INSERT + role-gated SELECT, no drift
--   * PF-F.2 + CC.3 — confirmed full CRUD grants to anon + authenticated.
--     Not touched by this migration.
--   * Track G.1 V.1-V.6 passed; same shape will hold here.
--   * Repo consumer inventory — 1 writer (compliance/scan), 0 readers.
--   * RLS state — enabled, not forced.
--
-- Idempotency
-- -----------
-- DROP POLICY IF EXISTS twice + CREATE POLICY — same idempotent pattern
-- as G.1.
--
-- Rollback (manual)
-- -----------------
--   DROP POLICY IF EXISTS compliance_checks_broker_admin_insert
--     ON public.compliance_checks;
--
--   -- Optional restore of the prior wide-open behavior (NOT recommended):
--   DROP POLICY IF EXISTS compliance_checks_insert
--     ON public.compliance_checks;
--   CREATE POLICY compliance_checks_insert
--     ON public.compliance_checks
--     FOR INSERT TO public
--     WITH CHECK (true);
--
-- Grants are NOT touched by this migration's forward direction or
-- rollback.
-- ============================================================================

-- Step 1 — Drop the misnamed loose INSERT policy
DROP POLICY IF EXISTS compliance_checks_insert
  ON public.compliance_checks;

-- Step 2 — Replace with a role-gated INSERT policy
DROP POLICY IF EXISTS compliance_checks_broker_admin_insert
  ON public.compliance_checks;

CREATE POLICY compliance_checks_broker_admin_insert
  ON public.compliance_checks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND role = ANY (ARRAY['broker'::user_role, 'admin'::user_role])
    )
  );

-- No SELECT policy changes (compliance_checks has no UPDATE or DELETE
-- policies; no changes there).
-- No GRANT or REVOKE statements.
-- service_role retains its existing grants and continues to bypass RLS.
