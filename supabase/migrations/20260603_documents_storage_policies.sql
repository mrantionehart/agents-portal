-- ============================================================================
-- documents storage bucket — policy backfill
-- (Sprint D-3 Track B — documents bucket parity)
-- ============================================================================
-- Background
-- ----------
-- PF-3 confirmed the `documents` storage bucket exists in production
-- (public=true) but has ZERO policies on storage.objects. Repo migration
-- 029_documents_storage_bucket.sql defined three policies for this bucket
-- but was never applied to production. Three Agent Portal routes touch this
-- bucket under service role today:
--
--   * app/api/closeiq/bundle/route.ts     → uploads to bundles/{uid}/...
--   * app/api/closeiq/contract/route.ts   → downloads from templates/...;
--                                           uploads to contracts/{uid}/...
--   * app/api/closeiq/templates/route.ts  → uploads to templates/...
--
-- This migration backfills the policies so those routes can flow under user
-- JWT. Policies are additive only; existing policies on storage.objects for
-- other buckets (pipeline-documents, transaction-documents,
-- brokerage-templates) are NOT modified by this migration.
--
-- Folder layout (confirmed by code inventory grep)
-- ------------------------------------------------
--   contracts/{user.id}/{filename}     — agent fills offer contract → own folder
--   bundles/{user.id}/{filename}       — agent assembles offer package → own folder
--   templates/{slug}_{timestamp}.pdf   — broker uploads blank form templates
--
-- Policy set (5 policies)
-- -----------------------
--   1. documents_contracts_own_folder_insert
--      authenticated INSERT scoped to contracts/{auth.uid()}/...
--
--   2. documents_bundles_own_folder_insert
--      authenticated INSERT scoped to bundles/{auth.uid()}/...
--
--   3. documents_templates_broker_insert
--      broker/admin INSERT scoped to templates/...
--
--   4. documents_authenticated_select
--      authenticated SELECT (required for closeiq/contract download of
--      template PDFs via storage.from('documents').download())
--
--   5. documents_own_folder_update
--      authenticated UPDATE where folder[2] matches the caller's uid
--      (required for upsert-mode uploads on bundles/ where the same
--      offerId may regenerate)
--
-- Idempotency
-- -----------
-- DROP POLICY IF EXISTS + CREATE POLICY — universally safe re-apply pattern.
-- Matches 006_add_broker_to_profiles.sql and
-- 20260603_compliance_notifications_broker_insert.sql.
--
-- Rollback (manual)
-- -----------------
--   DROP POLICY IF EXISTS documents_contracts_own_folder_insert  ON storage.objects;
--   DROP POLICY IF EXISTS documents_bundles_own_folder_insert    ON storage.objects;
--   DROP POLICY IF EXISTS documents_templates_broker_insert      ON storage.objects;
--   DROP POLICY IF EXISTS documents_authenticated_select         ON storage.objects;
--   DROP POLICY IF EXISTS documents_own_folder_update            ON storage.objects;
-- Reverting returns the documents bucket to its pre-D-3-Track-B state (zero
-- policies). Service-role writers are unaffected (SR bypasses RLS).
-- ============================================================================

-- 1. contracts/ — authenticated agents upload filled PDFs to their own folder
DROP POLICY IF EXISTS documents_contracts_own_folder_insert
  ON storage.objects;

CREATE POLICY documents_contracts_own_folder_insert
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = 'contracts'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- 2. bundles/ — authenticated agents upload offer packages to their own folder
DROP POLICY IF EXISTS documents_bundles_own_folder_insert
  ON storage.objects;

CREATE POLICY documents_bundles_own_folder_insert
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = 'bundles'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- 3. templates/ — brokers / admins upload blank fillable form templates
DROP POLICY IF EXISTS documents_templates_broker_insert
  ON storage.objects;

CREATE POLICY documents_templates_broker_insert
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = 'templates'
    AND EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND role = ANY (ARRAY['broker'::user_role, 'admin'::user_role])
    )
  );

-- 4. authenticated SELECT — server-side reads via storage API
--    (closeiq/contract calls .storage.from('documents').download() on
--    template paths; that call requires SELECT visibility)
DROP POLICY IF EXISTS documents_authenticated_select
  ON storage.objects;

CREATE POLICY documents_authenticated_select
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'documents');

-- 5. own-folder UPDATE — supports upsert-mode uploads where the same path
--    may be re-uploaded (closeiq/bundle uses upsert:true on bundles/)
DROP POLICY IF EXISTS documents_own_folder_update
  ON storage.objects;

CREATE POLICY documents_own_folder_update
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );
