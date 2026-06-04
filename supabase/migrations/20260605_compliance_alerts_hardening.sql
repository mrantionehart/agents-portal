-- ============================================================================
-- compliance_alerts — hardening (D-3 Track E)
-- ============================================================================
-- Background
-- ----------
-- PF-CA established that public.compliance_alerts is currently:
--   * RLS DISABLED
--   * Granted full CRUD to anon AND authenticated roles, creating a
--     PostgREST exposure: any unauthenticated visitor could SELECT,
--     INSERT, UPDATE, DELETE, or TRUNCATE the table via the public
--     REST endpoint without a JWT.
--   * Written to (silently broken) by a single Agent Portal route —
--     app/api/compliance/scan/route.ts. The INSERT payload references a
--     column named 'message' that does not exist in production
--     (production has 'description'). The route's catch-and-log error
--     handler swallows the failure; no rows from agents-portal have
--     ever landed in this table.
--   * Read by zero Agent Portal code paths.
--   * Holds 3 stale seed rows (lineage external to agents-portal;
--     identical microsecond timestamp suggests SQL dump or dashboard
--     manual insert). All three rows have status='pending', NULL
--     related_agent, NULL related_transaction, and have never been
--     mutated.
--   * Designed as a Type A broker-operational table per its schema
--     (reviewed_by / reviewed_at / status + a status btree index that
--     signals an intended broker-review UI).
--
-- This migration brings the table in line with the rest of the
-- production policy surface (R-7/R-8/R-9/R-16/R-17/R-18 era pattern):
--
--   1. Enable RLS.
--   2. REVOKE the over-broad anon + authenticated grants.
--   3. Re-grant SELECT/INSERT/UPDATE to authenticated only (no DELETE,
--      no TRUNCATE).
--   4. Add three role-gated policies for broker/admin.
--
-- PF-UR (read-only) confirmed that the production user_role enum
-- contains 6 values: agent, admin, broker, tc, manager, new_agent.
-- There is no 'compliance' enum value, so this migration uses a
-- broker/admin-only policy model. The compliance/scan route's
-- in-code reference to a 'compliance' role
--   const allowedRoles = ['broker', 'admin', 'compliance'];
-- is preserved as a documented dead branch. Resolving it
-- (adding the enum value OR dropping the branch) is a future product
-- decision deliberately out of scope here.
--
-- Seed rows preserved
-- -------------------
-- The 3 existing seed rows (all status='pending', all created at
-- 2026-04-13 20:25:53.325191+00) are untouched by ENABLE RLS, by
-- REVOKE, and by the new policies. They become visible only to
-- broker/admin callers under user JWT after this migration applies.
-- Service-role callers continue to see everything regardless.
--
-- Service-role unchanged
-- ----------------------
-- service_role retains its full grants. The compliance/scan route is
-- still SR-backed at the moment this migration applies; it will be
-- converted to user JWT in the follow-up Commit B AFTER this migration
-- has been verified live in production. The verification queries are
-- documented in the D-3 Track E sprint plan (Step 3).
--
-- Idempotency
-- -----------
--   * ALTER TABLE ... ENABLE ROW LEVEL SECURITY → no-op if already enabled
--   * REVOKE ALL ... → no-op if grants already absent for that role
--   * GRANT ... → re-grants safely if already granted
--   * DROP POLICY IF EXISTS + CREATE POLICY → safe re-apply pattern
--   Matches the proven pattern from:
--     20260603_compliance_notifications_broker_insert.sql
--     20260603_documents_storage_policies.sql
--     20260604_documents_track_c_policies.sql
--
-- Rollback (manual; documented for ops)
-- -------------------------------------
--   DROP POLICY IF EXISTS compliance_alerts_broker_admin_select
--     ON public.compliance_alerts;
--   DROP POLICY IF EXISTS compliance_alerts_broker_admin_insert
--     ON public.compliance_alerts;
--   DROP POLICY IF EXISTS compliance_alerts_broker_admin_update
--     ON public.compliance_alerts;
--   ALTER TABLE public.compliance_alerts DISABLE ROW LEVEL SECURITY;
--   GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
--     ON public.compliance_alerts TO anon, authenticated;
--   -- WARNING: the GRANT restoration above re-creates the pre-sprint
--   -- critical anon CRUD exposure. Only run if you have explicit
--   -- reason; the intended end-state is hardened.
-- ============================================================================

-- Step 1 — Enable RLS
ALTER TABLE public.compliance_alerts ENABLE ROW LEVEL SECURITY;

-- Step 2 — Remove over-broad grants
--   anon:           full revoke (no legitimate use case)
--   authenticated:  full revoke (will be re-granted narrowly below;
--                   simplest path to a clean state)
REVOKE ALL ON public.compliance_alerts FROM anon;
REVOKE ALL ON public.compliance_alerts FROM authenticated;

-- Step 3 — Narrow re-grant for authenticated
-- RLS filters by broker/admin role via the policies below; this grant
-- restores enough table-level capability for the policies to be
-- consulted. No DELETE, no TRUNCATE — alerts are append-only.
GRANT SELECT, INSERT, UPDATE ON public.compliance_alerts TO authenticated;

-- Step 4 — broker/admin SELECT
DROP POLICY IF EXISTS compliance_alerts_broker_admin_select
  ON public.compliance_alerts;

CREATE POLICY compliance_alerts_broker_admin_select
  ON public.compliance_alerts
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

-- Step 5 — broker/admin INSERT
DROP POLICY IF EXISTS compliance_alerts_broker_admin_insert
  ON public.compliance_alerts;

CREATE POLICY compliance_alerts_broker_admin_insert
  ON public.compliance_alerts
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

-- Step 6 — broker/admin UPDATE
DROP POLICY IF EXISTS compliance_alerts_broker_admin_update
  ON public.compliance_alerts;

CREATE POLICY compliance_alerts_broker_admin_update
  ON public.compliance_alerts
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND role = ANY (ARRAY['broker'::user_role, 'admin'::user_role])
    )
  );

-- No DELETE policy — alerts are append-only. The reviewed_by /
-- reviewed_at / status workflow handles "resolution" without deletion.
