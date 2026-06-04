-- ============================================================================
-- notifications INSERT — tighten misnamed loose policy
-- (Sprint D-3 Track F.2 — sub-option A2)
-- ============================================================================
-- Background
-- ----------
-- PF-1 and PF-F revealed that public.notifications has a misnamed INSERT
-- policy:
--
--   policyname:    "Service role can insert notifications"
--   cmd:           INSERT
--   roles:         {public}
--   using_clause:  null
--   check_clause:  true
--
-- Despite its name, the policy permits any role (including anon) to INSERT
-- with `WITH CHECK true`. Combined with the existing GRANT INSERT TO anon
-- + authenticated (PF-F.2), the practical posture is that any
-- unauthenticated visitor to PostgREST can write any notification with any
-- user_id. The name was misleading; the gate did nothing.
--
-- This migration replaces that policy with a role-gated INSERT policy that
-- restricts authenticated callers to broker / admin / office_manager only.
-- Service-role callers continue to bypass RLS as always, so all four
-- agents-portal SR-backed writers (calendar/events, licenses/check,
-- compliance/scan [now user-JWT post-D3-Track-E], onboarding/webhook) are
-- unaffected.
--
-- F.2 sub-option A2 — what this migration does and does NOT do:
--
--   DOES:
--     * DROP the misnamed loose INSERT policy
--     * CREATE the new role-gated INSERT policy (broker/admin/office_manager)
--
--   DOES NOT:
--     * Touch the existing SELECT or UPDATE policies on notifications
--     * Revoke anon or authenticated grants (deferred pending Vault writer
--       confirmation — see Track F audit for context)
--     * Change service_role grants
--     * Modify any code
--     * Insert, update, or delete any notification rows
--
-- Vault writer status
-- -------------------
-- PF-F.6 revealed one 'announcement' row in production with lineage that
-- could not be tied to any agents-portal route (most likely a Vault broker
-- broadcast feature or a manual dashboard insert; one row in 30+ days
-- suggests not an active feature). If Vault has a notifications writer
-- using user-JWT under a broker/admin/office_manager profile, the new
-- policy will accept it. If Vault uses service_role, the policy does not
-- affect it. If Vault uses anon-keyed REST writes, this migration leaves
-- the anon grant in place so those writes still succeed (grants govern
-- table-level access; RLS would have denied them under WITH CHECK true
-- for anon's lack of an auth.uid(), but the wide-open policy let them
-- through). The cross-repo coordination question — whether Vault uses
-- anon for notifications writes — is deferred to a follow-up sprint.
--
-- Pre-flight evidence (PF-F.1, PF-F.2, PF-F.6)
-- -------------------------------------------
--   * notifications has 4 policies total: 1 INSERT (the loose one being
--     replaced), 2 SELECT (admin/broker + own), 1 UPDATE (own).
--   * All 4 agents-portal known writers were confirmed via repo grep:
--     calendar/events, licenses/check, compliance/scan, onboarding/webhook.
--     All four insert under either service-role or post-F.0.2-converted
--     user-JWT shape; the latter (compliance/scan) is a broker/admin
--     caller and would pass the new role check.
--   * 30-day type distribution showed 36 admin_alert + 1 announcement.
--     The lineage of the announcement row is unclear but the row's writer
--     is not an agents-portal route.
--
-- Idempotency
-- -----------
-- DROP POLICY IF EXISTS twice (once for the misnamed legacy, once for the
-- new policy) + CREATE POLICY — same proven idempotent pattern as Tracks
-- B / C / D / E.
--
-- Rollback (manual; if needed)
-- ----------------------------
--   DROP POLICY IF EXISTS notifications_role_gated_insert
--     ON public.notifications;
--
--   -- If you need to restore the prior wide-open behavior (NOT
--   -- recommended — that was the misnamed/insecure posture):
--   DROP POLICY IF EXISTS "Service role can insert notifications"
--     ON public.notifications;
--   CREATE POLICY "Service role can insert notifications"
--     ON public.notifications
--     FOR INSERT
--     TO public
--     WITH CHECK (true);
--
-- Grants are NOT touched by this migration's rollback — they were not
-- changed in the forward direction either.
-- ============================================================================

-- Step 1 — Drop the misnamed loose INSERT policy
DROP POLICY IF EXISTS "Service role can insert notifications"
  ON public.notifications;

-- Step 2 — Replace with a role-gated INSERT policy
DROP POLICY IF EXISTS notifications_role_gated_insert
  ON public.notifications;

CREATE POLICY notifications_role_gated_insert
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND role = ANY (ARRAY[
          'broker'::user_role,
          'admin'::user_role,
          'office_manager'::user_role
        ])
    )
  );

-- No DELETE, SELECT, or UPDATE policy changes.
-- No GRANT or REVOKE statements.
-- service_role retains its existing grants and continues to bypass RLS.
