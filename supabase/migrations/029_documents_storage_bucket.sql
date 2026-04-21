-- Migration 029: Create 'documents' storage bucket for CloseIQ contracts
-- Contracts, offer documents, and generated PDFs are stored here

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  true,
  52428800, -- 50MB limit
  ARRAY['application/pdf', 'image/png', 'image/jpeg']
)
ON CONFLICT (id) DO NOTHING;

-- Policy: authenticated users can upload to their own folder
CREATE POLICY IF NOT EXISTS "Users can upload documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = 'contracts');

-- Policy: authenticated users can read all documents
CREATE POLICY IF NOT EXISTS "Users can read documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'documents');

-- Policy: users can update their own documents
CREATE POLICY IF NOT EXISTS "Users can update own documents"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[2]);
