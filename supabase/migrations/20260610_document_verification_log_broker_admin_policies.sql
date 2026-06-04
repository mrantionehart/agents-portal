-- ============================================================================
-- document_verification_log policy overhaul — replace misnamed wide-open
-- "Allow all for service role" policy with role-gated authenticated
-- INSERT + SELECT policies for broker/admin.
-- (Sprint D-3 Track G.3 — F.2 sub-option A2 posture)
-- ============================================================================
-- Background
-- ----------
-- PF-DVL (Sprint D-3 Track D) and DVL.4 (Track G.3 pre-flight drift check,
-- June 10) confirmed exactly one policy on this table:
--
--   policyname:    Allow all for service role
--   cmd:           ALL
--   roles:         {public}
--   qual:          true
--   with_check:    NULL
--
-- Despite the name, this policy applies to {public} (every role) and
-- with cmd=ALL + qual=true + with_check=NULL it permits ALL operations
-- (SELECT, INSERT, UPDATE, DELETE) on ALL rows by ANY role. Combined
-- with GRANT ALL on the table to anon + authenticated (DVL.4b baseline),
-- any unauthenticated visitor could read/write/delete verification log
-- rows via PostgREST. Same misnamed-permissive class as compliance_alerts
-- pre-Track-E, notifications pre-F.2, compliance_issues pre-G.1, and
-- compliance_checks pre-G.2 — but broader because cmd=ALL covers every
-- verb, not just INSERT.
--
-- This migration replaces the single loose policy with two narrow
-- role-gated policies (INSERT + SELECT) restricted to broker / admin.
-- Per approved sprint spec: no UPDATE policy, no DELETE policy.
-- Post-migration, any user-JWT UPDATE or DELETE will be blocked by RLS;
-- only service_role + postgres (which bypass RLS) can mutate or remove
-- existing rows. This matches the audit-log semantics of the table —
-- verification log entries should be append-only from user space, with
-- broker/admin visibility for review.
--
-- F.2 sub-option A2 posture — what this migration does and does NOT do:
--
--   DOES:
--     * DROP the misnamed loose "Allow all for service role" policy
--     * CREATE document_verification_log_broker_admin_insert
--       (FOR INSERT TO authenticated, broker/admin only)
--     * CREATE document_verification_log_broker_admin_select
--       (FOR SELECT TO authenticated, broker/admin only)
--
--   DOES NOT:
--     * Create any UPDATE policy (RLS will block authenticated UPDATEs;
--       service_role still bypasses)
--     * Create any DELETE policy (RLS will block authenticated DELETEs;
--       service_role still bypasses)
--     * Revoke anon or authenticated grants (deferred — Vault writer
--       coordination still open)
--     * Change service_role grants
--     * Modify any code
--
-- Consumer audit (June 10, repo grep, agents-portal/)
-- ---------------------------------------------------
--   WRITERS (any client):
--     * app/api/compliance/review/route.ts:371
--       admin.from('document_verification_log').insert({...})
--       Uses service-role client (withServiceRole). service_role bypasses
--       RLS unconditionally — this writer is UNAFFECTED by the policy
--       change.
--
--   READERS (any client): 0 in Agent Portal source.
--   userClient WRITERS:   0 in Agent Portal source.
--   userClient READERS:   0 in Agent Portal source.
--
--   The only userClient INSERT path that exists is the broker/admin
--   future-state writer enabled by this migration — there is no current
--   userClient INSERT that could be broken.
--
-- Pre-flight evidence
-- -------------------
--   * PF-DVL (Track D) — confirmed loose "Allow all for service role"
--     existed with cmd=ALL.
--   * DVL.4a — confirmed exact policyname literal: `Allow all for
--     service role` (with spaces). One policy total. No drift.
--   * DVL.4b — confirmed full CRUD grants to anon, authenticated,
--     postgres, service_role. Not touched by this migration.
--   * DVL.4c — RLS enabled (relrowsecurity=true).
--   * DVL.4d — row_count = 0 (baseline for post-migration check).
--   * Repo consumer inventory (above) — 1 service-role writer, 0 readers.
--
-- Idempotency
-- -----------
-- DROP POLICY IF EXISTS for the old loose policy + DROP IF EXISTS for the
-- two new policies (in case migration is re-run) + CREATE POLICY. Same
-- idempotent pattern as Tracks E / G.1 / G.2.
--
-- Rollback (manual)
-- -----------------
--   DROP POLICY IF EXISTS document_verification_log_broker_admin_insert
--     ON public.document_verification_log;
--   DROP POLICY IF EXISTS document_verification_log_broker_admin_select
--     ON public.document_verification_log;
--
--   -- Optional restore of the prior wide-open behavior (NOT recommended):
--   DROP POLICY IF EXISTS "Allow all for service role"
--     ON public.document_verification_log;
--   CREATE POLICY "Allow all for service role"
--     ON public.document_verification_log
--     FOR ALL TO public
--     USING (true);
--
-- Grants are NOT touched by this migration's forward direction or
-- rollback.
-- ============================================================================

-- Step 1 — Drop the misnamed loose policy.
-- Quote the identifier exactly as it appears in pg_policies (mixed case,
-- spaces, no underscores) so the DROP matches the canonical name.
DROP POLICY IF EXISTS "Allow all for service role"
  ON public.document_verification_log;

-- Step 2 — Drop new policies if they already exist (idempotency).
DROP POLICY IF EXISTS document_verification_log_broker_admin_insert
  ON public.document_verification_log;
DROP POLICY IF EXISTS document_verification_log_broker_admin_select
  ON public.document_verification_log;

-- Step 3 — Create role-gated INSERT policy (broker/admin only).
CREATE POLICY document_verification_log_broker_admin_insert
  ON public.document_verification_log
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

-- Step 4 — Create role-gated SELECT policy (broker/admin only).
-- Note: no agent-own-transaction read path. Verification log entries are
-- audit data restricted to compliance reviewers. If agent read access is
-- later required, add an OR clause in a follow-up migration.
CREATE POLICY document_verification_log_broker_admin_select
  ON public.document_verification_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND role = ANY (ARRAY['broker'::user_role, 'admin'::user_role])
    )
  );

-- No UPDATE policy — authenticated UPDATEs will be blocked by RLS.
-- No DELETE policy — authenticated DELETEs will be blocked by RLS.
-- service_role bypasses RLS and retains all operations.
-- No GRANT or REVOKE statements.
