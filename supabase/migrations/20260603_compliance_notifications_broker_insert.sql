-- ============================================================================
-- compliance_notifications — authenticated INSERT by broker / admin only
-- (Security Sprint 8B Phase 4B — Step 2)
-- ============================================================================
-- Background
-- ----------
-- `005_compliance_notifications.sql` defines the table with RLS enabled and
-- two policies: SELECT and UPDATE for the recipient (auth.uid() = recipient_id).
-- It deliberately omits an INSERT policy so that only service-role calls can
-- insert — which was the right call when the only writer was a service-role
-- API route fanning out broker review actions to recipients.
--
-- Sprint 8B Phase 4B converts `app/api/compliance/review/route.ts` from
-- `adminClient('compliance-review-broker-action')` to `userClient(request)`.
-- The route is already role-gated in code (only broker / admin pass the
-- explicit check at the top of POST). To make the conversion safe, we need an
-- RLS INSERT policy that matches the in-code gate: broker or admin role only.
--
-- Pre-flight evidence (PF-1)
-- --------------------------
-- Production currently has exactly two policies on this table:
--   * "Users can read own compliance notifications" — SELECT, recipient_id = auth.uid()
--   * "Users can update own compliance notifications" — UPDATE, recipient_id = auth.uid()
-- Zero INSERT policies exist. This migration adds one. RLS is already enabled
-- (PF-2 row: public, compliance_notifications, rls_enabled=true).
--
-- Design notes
-- ------------
-- * Restricted to TO authenticated so anon-key calls cannot reach it.
-- * WITH CHECK uses an EXISTS subquery against profiles for the role gate. This
--   matches the shape used by `documents_broker_admin_select`, `manual_wins`
--   Managers-can-insert, and `transactions` broker policies — consistent with
--   the rest of the production policy surface.
-- * Service-role inserts continue to work unchanged (service role bypasses
--   RLS), so `compliance-upload-notification-fanout` and any future SR writer
--   keep functioning during the transition window before code conversion.
-- * Recipient-id is not constrained by the policy; the recipient list is
--   determined by the route logic (broker reviewing a doc → notify the
--   transaction's agent). Constraining recipient_id at the policy level would
--   require a multi-join and add maintenance burden for marginal benefit;
--   the route-side logic is the actual authorization gate.
--
-- Idempotency
-- -----------
-- DROP POLICY IF EXISTS + CREATE POLICY — universally safe pattern (works
-- on PG 14, 15, 16). Matches 006_add_broker_to_profiles.sql, which is the
-- dominant repo pattern for re-runnable policy migrations. CREATE POLICY
-- IF NOT EXISTS would be cleaner but is PG 16+ only — production may still
-- be on PG 15.
--
-- Rollback (manual)
-- -----------------
--   DROP POLICY IF EXISTS compliance_notifications_broker_insert
--     ON public.compliance_notifications;
-- Reverting this policy returns the table to "SR-only INSERT" — the original
-- 005 posture. Existing notification rows are unaffected.
-- ============================================================================

DROP POLICY IF EXISTS compliance_notifications_broker_insert
  ON public.compliance_notifications;

CREATE POLICY compliance_notifications_broker_insert
  ON public.compliance_notifications
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
