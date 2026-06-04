-- ============================================================================
-- documents table — additive policy backfill (D-3 Track C)
-- ============================================================================
-- Background
-- ----------
-- PF-1 confirmed two gaps on public.documents that block conversion of
-- compliance routes from service-role to user JWT:
--
--   1. The existing UPDATE policy named "Brokers can update review status"
--      has a USING clause that only allows role='admin' despite its name.
--      Under user JWT, a broker caller cannot UPDATE document review
--      status fields. (Blocks compliance/review broker path. Track C does
--      NOT yet unblock that route — Track D pre-flight on
--      document_verification_log is still required.)
--
--   2. The existing SELECT policies cover own-uploads, deals.agent_id, and
--      broker/admin override — but NOT transaction-linked docs for the
--      agent who owns the transaction. So an agent viewing their own
--      transaction's document list would miss any document a broker /
--      compliance-bot uploaded on the same transaction. (Blocks
--      compliance/transactions agent doc-count path.)
--
-- This migration is purely additive. It introduces TWO NEW policies under
-- new names. The existing policies on public.documents are NOT modified.
-- PERMISSIVE RLS policies combine with OR — so the new policies broaden
-- the allowed set; they cannot narrow it.
--
-- Pre-flight evidence (PF-1)
-- --------------------------
-- public.documents currently has 4 policies in production:
--
--   "Users can upload documents"                INSERT  (uploaded_by self
--                                                       OR transactions
--                                                       OR deals OR admin/broker)
--   "Users can view own documents"              SELECT  (uploaded_by self
--                                                       OR deals.agent_id
--                                                       OR admin)
--   documents_broker_admin_select               SELECT  (broker/admin role)
--   "Brokers can update review status"          UPDATE  (admin role only —
--                                                       MISNAMED; D-3.1
--                                                       finding)
--
-- RLS enabled (PF-2). All four are PERMISSIVE.
--
-- Design notes
-- ------------
-- * Both policies target TO authenticated so anon-key callers cannot reach
--   them.
-- * Both use EXISTS subqueries against public.profiles / public.transactions
--   for role / ownership checks — same shape as offers_agent_policy,
--   documents_broker_admin_select, transactions broker policies.
-- * Policy 1 only addresses the broker side of the UPDATE gap. Admin
--   UPDATE continues to work via the existing misnamed "Brokers can update
--   review status" policy. compliance/review conversion is NOT unblocked
--   by Track C alone — Track D's document_verification_log PF must run
--   first.
-- * Policy 2 closes the agent visibility gap for transaction-linked docs.
--   It mirrors the shape of the existing SELECT policies' deals-join path
--   but uses transactions instead. compliance/transactions agent view
--   becomes safe to flip to user JWT once this lands.
--
-- Idempotency
-- -----------
-- DROP POLICY IF EXISTS + CREATE POLICY — universally safe re-apply.
-- Same posture as 20260603_compliance_notifications_broker_insert.sql
-- and 20260603_documents_storage_policies.sql.
--
-- Rollback (manual)
-- -----------------
--   DROP POLICY IF EXISTS documents_broker_update_review_status
--     ON public.documents;
--   DROP POLICY IF EXISTS documents_agent_own_transaction_select
--     ON public.documents;
-- Reverting these returns documents to its pre-Track-C posture — the
-- original 4 policies remain untouched. No data is affected.
-- ============================================================================

-- Policy 1 — broker UPDATE for compliance review
-- Resolves D-3.1: the misnamed admin-only policy gets a broker companion
-- without being modified. Both policies coexist; brokers gain UPDATE via
-- this new policy; admins keep UPDATE via the existing one.
DROP POLICY IF EXISTS documents_broker_update_review_status
  ON public.documents;

CREATE POLICY documents_broker_update_review_status
  ON public.documents
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'broker'::user_role
    )
  );

-- Policy 2 — agent SELECT on docs linked to own transactions
-- Closes the count regression risk for compliance/transactions: an agent
-- viewing their own transaction list now sees ALL docs on those
-- transactions, not just the ones they personally uploaded.
DROP POLICY IF EXISTS documents_agent_own_transaction_select
  ON public.documents;

CREATE POLICY documents_agent_own_transaction_select
  ON public.documents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.transactions t
      WHERE t.id = documents.transaction_id
        AND t.agent_id = auth.uid()
    )
  );
