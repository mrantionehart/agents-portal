-- Migration 028: Add form_type column to contract_templates
-- Distinguishes XFA (Florida Realtors) from AcroForm PDFs
-- This determines which filling strategy the contract endpoint uses

ALTER TABLE contract_templates
  ADD COLUMN IF NOT EXISTS form_type text DEFAULT 'acroform'
  CHECK (form_type IN ('xfa', 'acroform', 'none'));

COMMENT ON COLUMN contract_templates.form_type IS 'PDF form type: xfa (Florida Realtors), acroform (standard), or none';
