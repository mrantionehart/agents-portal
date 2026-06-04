-- ============================================================================
-- compliance_issues INSERT — tighten misnamed loose policy
-- (Sprint D-3 Track G.1 — F.2 sub-option A2 posture)
-- ============================================================================
-- Background
-- ----------
-- PF-1 and CI.4 (Track G read-only audit) confirmed:
--
--   policyname:    compliance_issues_insert
--   cmd:           INSERT
--   roles:         {public}
--   qual:          NULL
--   with_check:    true
--
-- The policy permits any role (including anon) to INSERT with
-- WITH CHECK true. Combined with the existing GRANT INSERT TO anon +
-- authenticated (PF-F.2 + CC.3 baseline), the practical posture is that
-- any unauthenticated visitor could write compliance_issues rows via
-- PostgREST. The policy is misnamed/loose in the same pattern as
-- compliance_alerts pre-Track-E and notifications pre-F.2.
--
-- This migration replaces the loose INSERT policy with a role-gated INSERT
-- policy restricted to broker / admin profiles. service_role bypasses RLS
-- as always; the single in-portal writer (app/api/compliance/scan/route.ts
-- line 398, dual-key fallback at 409) already runs under user JWT post-D3
-- Track E and gates to broker/admin in code, so it will satisfy the new
-- WITH CHECK clause.
--
-- F.2 sub-option A2 posture — what this migration does and does NOT do:
--
--   DOES:
--     * DROP the misnamed loose compliance_issues_insert policy
--     * CREATE the new role-gated compliance_issues_broker_admin_insert
--       policy
--
--   DOES NOT:
--     * Touch the existing SELECT policy compliance_issues_select
--       (broker/admin OR agent-via-transaction)
--     * Touch the existing UPDATE policy compliance_issues_update
--       (broker/admin)
--     * Revoke anon or authenticated grants (deferred — Vault writer
--       coordination still open)
--     * Change service_role grants
--     * Modify any code
--
-- Why broker/admin only (no 'compliance' role)
-- --------------------------------------------
-- The user_role enum (PF-UR) contains: agent, admin, broker, tc, manager,
-- new_agent. 'compliance' is NOT in the enum. The compliance/scan route's
-- in-code allowedRoles = ['broker', 'admin', 'compliance'] is a documented
-- dead branch (Sprint D-3 Track E commit message). Realistic callers
-- passing the in-code gate are broker or admin only; both pass the new
-- policy.
--
-- Foreign key safety
-- ------------------
-- CI.7a confirmed compliance_issues has three outbound FKs:
--   compliance_check_id -> compliance_checks.id CASCADE
--   resolved_by         -> profiles.id NO ACTION
--   transaction_id      -> transactions.id CASCADE
--
-- The CASCADE relationships are unaffected by an INSERT policy change.
-- The NO ACTION on resolved_by preserves attribution. No FK-cascade
-- behavior changes.
--
-- Pre-flight evidence
-- -------------------
--   * PF-1, CI.4 — confirmed loose INSERT, role-gated SELECT + UPDATE,
--     no drift.
--   * PF-F.2 + CC.3 — confirmed full CRUD grants to anon + authenticated.
--     Not touched by this migration.
--   * CI.7a — outbound FKs catalogued; no surprises.
--   * Repo consumer inventory — 1 writer (compliance/scan), 0 readers.
--   * RLS state — enabled, not forced.
--   * Row count + recent-row fingerprint not captured pre-apply; deferred
--     to post-apply verification.
--
-- Idempotency
-- -----------
-- DROP POLICY IF EXISTS twice + CREATE POLICY — same idempotent pattern
-- as Tracks B / C / D / E / F.2.
--
-- Rollback (manual)
-- -----------------
--   DROP POLICY IF EXISTS compliance_issues_broker_admin_insert
--     ON public.compliance_issues;
--
--   -- Optional restore of the prior wide-open behavior (NOT recommended):
--   DROP POLICY IF EXISTS compliance_issues_insert
--     ON public.compliance_issues;
--   CREATE POLICY compliance_issues_insert
--     ON public.compliance_issues
--     FOR INSERT TO public
--     WITH CHECK (true);
--
-- Grants are NOT touched by this migration's forward direction or
-- rollback.
-- ============================================================================

-- Step 1 — Drop the misnamed loose INSERT policy
DROP POLICY IF EXISTS compliance_issues_insert
  ON public.compliance_issues;

-- Step 2 — Replace with a role-gated INSERT policy
DROP POLICY IF EXISTS compliance_issues_broker_admin_insert
  ON public.compliance_issues;

CREATE POLICY compliance_issues_broker_admin_insert
  ON public.compliance_issues
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

-- No SELECT, UPDATE, or DELETE policy changes.
-- No GRANT or REVOKE statements.
-- service_role retains its existing grants and continues to bypass RLS.
