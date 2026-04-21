-- 027_contract_templates.sql
-- Contract template system for Florida Realtors / FAR-BAR fillable PDF forms
-- Stores template metadata, field mappings, and references to PDF files in storage

-- ─────────────────────────────────────────────────────────────────────────────
-- contract_templates — one row per uploaded fillable PDF form
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contract_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  -- who uploaded it (broker)
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- human-readable name, e.g. "FAR-BAR As-Is Residential Contract"
  name TEXT NOT NULL,
  -- short code for programmatic use
  slug TEXT NOT NULL UNIQUE,
  -- category for grouping
  category TEXT NOT NULL DEFAULT 'contract'
    CHECK (category IN ('contract', 'addendum', 'disclosure', 'rider', 'other')),
  -- description / notes
  description TEXT,
  -- Supabase storage path to the blank fillable PDF
  storage_path TEXT NOT NULL,
  -- original file name
  file_name TEXT NOT NULL,
  -- JSON array of extracted PDF form field names
  -- e.g. ["BuyerName", "PropertyAddress", "PurchasePrice", ...]
  form_fields JSONB DEFAULT '[]',
  -- JSON object mapping our offer data keys → PDF field names
  -- e.g. {"buyer_name": "BuyerName", "offer_price": "PurchasePrice", ...}
  field_mapping JSONB DEFAULT '{}',
  -- whether the mapping has been verified / is ready to use
  mapping_verified BOOLEAN DEFAULT FALSE,
  -- form version / year for tracking updates
  form_version TEXT,
  -- active flag (soft-disable old versions)
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_contract_templates_slug ON contract_templates(slug);
CREATE INDEX IF NOT EXISTS idx_contract_templates_category ON contract_templates(category, is_active);
CREATE INDEX IF NOT EXISTS idx_contract_templates_uploaded_by ON contract_templates(uploaded_by);

-- RLS
ALTER TABLE contract_templates ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read active templates
DO $$ BEGIN
  CREATE POLICY "Authenticated users can read active templates"
    ON contract_templates FOR SELECT TO authenticated
    USING (is_active = TRUE);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Only broker (role = 'broker') can insert/update templates
DO $$ BEGIN
  CREATE POLICY "Brokers can insert templates"
    ON contract_templates FOR INSERT TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'broker'
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Brokers can update templates"
    ON contract_templates FOR UPDATE TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'broker'
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Update offer_documents to link to template used
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE offer_documents
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES contract_templates(id);

-- ─────────────────────────────────────────────────────────────────────────────
-- updated_at trigger
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_contract_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_contract_templates_updated_at ON contract_templates;
CREATE TRIGGER trg_contract_templates_updated_at
  BEFORE UPDATE ON contract_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_contract_templates_updated_at();
