-- Migration 032: Add conditional compliance logic
-- Adds financing_type, has_hoa, year_built to transactions
-- Adds condition column to transaction_doc_requirements
-- Supports: "Required if Applicable" badges

-- ============================================
-- 1. Add conditional fields to transactions
-- ============================================
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS financing_type TEXT DEFAULT 'conventional'
  CHECK (financing_type IN ('conventional', 'fha', 'va', 'cash', 'usda', 'other'));
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS has_hoa BOOLEAN DEFAULT false;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS year_built INTEGER;

-- ============================================
-- 2. Add condition column to doc requirements
-- ============================================
-- condition values:
--   NULL or 'always'     → always applies (normal required/optional)
--   'if_financed'        → required only when financing_type != 'cash'
--   'if_hoa'             → required only when has_hoa = true
--   'if_pre1978'         → required only when year_built < 1978
--   'if_uploaded'        → optional, but once uploaded must be approved
ALTER TABLE transaction_doc_requirements ADD COLUMN IF NOT EXISTS condition TEXT;

-- ============================================
-- 3. Fix data: Title Commitment → REQUIRED
-- ============================================
UPDATE transaction_doc_requirements
SET is_required = true
WHERE doc_label = 'Title Commitment / Search'
  AND is_active = true;

-- ============================================
-- 4. Fix data: Seller Disclosure wording
-- ============================================
UPDATE transaction_doc_requirements
SET doc_label = 'Seller Property Disclosure (Signed)'
WHERE doc_label = 'Seller Disclosure (received)'
  AND is_active = true;

-- ============================================
-- 5. Set conditional flags
-- ============================================

-- Clear to Close → required if financed
UPDATE transaction_doc_requirements
SET condition = 'if_financed', is_required = true
WHERE doc_label = 'Clear to Close'
  AND is_active = true;

-- Homeowners Insurance Binder → required if financed
UPDATE transaction_doc_requirements
SET condition = 'if_financed', is_required = true
WHERE doc_label = 'Homeowners Insurance Binder'
  AND is_active = true;

-- HOA Disclosure → required if HOA
UPDATE transaction_doc_requirements
SET condition = 'if_hoa', is_required = true
WHERE doc_label LIKE 'HOA/Condo%'
  AND is_active = true;

-- Lead Paint Disclosure → required if pre-1978
UPDATE transaction_doc_requirements
SET condition = 'if_pre1978'
WHERE doc_label LIKE 'Lead Paint%'
  AND is_active = true;

-- Amendments → once uploaded must be approved
UPDATE transaction_doc_requirements
SET condition = 'if_uploaded'
WHERE doc_label = 'Amendments / Addenda'
  AND is_active = true;
