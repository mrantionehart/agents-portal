-- Migration 031: Update transaction_doc_requirements for Florida compliance
-- Restructures document phases: listing_intake → under_contract → pre_closing → closing → compliance
-- Adds CDA, ALTA Settlement, Amendments, Proof of EM, and other FL-specific docs
-- Removes duplicates (Attorney Review Letter not used in Florida)

-- ============================================
-- Step 1: Deactivate all old rows (safe — doesn't delete)
-- ============================================
UPDATE transaction_doc_requirements SET is_active = false WHERE is_active = true;

-- ============================================
-- Step 2: Insert Florida-compliant requirements by transaction type
-- ============================================

-- ── COMMON (all types) ──
-- These are inserted per-type below to keep sort_order clean

-- ── SELLER ──
INSERT INTO transaction_doc_requirements (transaction_type, doc_label, folder, is_required, signature_required, sort_order, is_active) VALUES
  -- Intake
  ('seller', 'Brokerage Relationship Disclosure', 'listing_intake', true, true, 1, true),
  ('seller', 'Wire Fraud Notice', 'listing_intake', true, true, 2, true),
  ('seller', 'Listing Agreement', 'listing_intake', true, true, 3, true),
  ('seller', 'Seller Disclosure', 'listing_intake', true, true, 4, true),
  ('seller', 'Lead Paint Disclosure (Pre-1978)', 'listing_intake', true, true, 5, true),
  ('seller', 'Permission to Advertise', 'listing_intake', false, true, 6, true),
  ('seller', 'Marketing Authorization', 'listing_intake', false, true, 7, true),
  ('seller', 'HOA/Condo Association Disclosure', 'listing_intake', false, false, 8, true),
  -- Under Contract
  ('seller', 'Purchase Agreement (As-Is or FAR/BAR)', 'under_contract', true, true, 10, true),
  ('seller', 'Buyer Pre-Approval / Proof of Funds', 'under_contract', true, false, 11, true),
  ('seller', 'Proof of Earnest Money Delivered', 'under_contract', true, false, 12, true),
  ('seller', 'Amendments / Addenda', 'under_contract', false, true, 13, true),
  -- Pre-Closing
  ('seller', 'Home Inspection Report', 'pre_closing', false, false, 20, true),
  ('seller', 'Appraisal Report', 'pre_closing', false, false, 21, true),
  ('seller', 'Title Commitment / Search', 'pre_closing', false, false, 22, true),
  ('seller', 'Survey', 'pre_closing', false, false, 23, true),
  ('seller', 'Clear to Close', 'pre_closing', false, false, 24, true),
  -- Closing
  ('seller', 'ALTA Settlement Statement / HUD-1', 'closing', true, true, 30, true),
  ('seller', 'Commission Disbursement Authorization (CDA)', 'closing', true, true, 31, true),
  ('seller', 'Closing Disclosure', 'closing', true, true, 32, true),
  -- Compliance
  ('seller', 'Compliance Acknowledgment', 'compliance', true, true, 40, true);

-- ── BUYER ──
INSERT INTO transaction_doc_requirements (transaction_type, doc_label, folder, is_required, signature_required, sort_order, is_active) VALUES
  -- Intake
  ('buyer', 'Brokerage Relationship Disclosure', 'listing_intake', true, true, 1, true),
  ('buyer', 'Wire Fraud Notice', 'listing_intake', true, true, 2, true),
  ('buyer', 'Buyer Representation Agreement', 'listing_intake', true, true, 3, true),
  ('buyer', 'Pre-Approval Letter / Proof of Funds', 'listing_intake', true, false, 4, true),
  -- Under Contract
  ('buyer', 'Purchase Agreement (As-Is or FAR/BAR)', 'under_contract', true, true, 10, true),
  ('buyer', 'Lead Paint Disclosure (Pre-1978)', 'under_contract', true, true, 11, true),
  ('buyer', 'Seller Disclosure (received)', 'under_contract', true, false, 12, true),
  ('buyer', 'HOA/Condo Association Disclosure', 'under_contract', false, false, 13, true),
  ('buyer', 'Proof of Earnest Money Delivered', 'under_contract', true, false, 14, true),
  ('buyer', 'Amendments / Addenda', 'under_contract', false, true, 15, true),
  -- Pre-Closing
  ('buyer', 'Home Inspection Report', 'pre_closing', false, false, 20, true),
  ('buyer', 'Appraisal Report', 'pre_closing', false, false, 21, true),
  ('buyer', 'Title Commitment / Search', 'pre_closing', false, false, 22, true),
  ('buyer', 'Survey', 'pre_closing', false, false, 23, true),
  ('buyer', 'Homeowners Insurance Binder', 'pre_closing', false, false, 24, true),
  ('buyer', 'Clear to Close', 'pre_closing', false, false, 25, true),
  -- Closing
  ('buyer', 'ALTA Settlement Statement / HUD-1', 'closing', true, true, 30, true),
  ('buyer', 'Commission Disbursement Authorization (CDA)', 'closing', true, true, 31, true),
  ('buyer', 'Closing Disclosure', 'closing', true, true, 32, true),
  -- Compliance
  ('buyer', 'Compliance Acknowledgment', 'compliance', true, true, 40, true);

-- ── LEASE ──
INSERT INTO transaction_doc_requirements (transaction_type, doc_label, folder, is_required, signature_required, sort_order, is_active) VALUES
  ('lease', 'Brokerage Relationship Disclosure', 'listing_intake', true, true, 1, true),
  ('lease', 'Wire Fraud Notice', 'listing_intake', true, true, 2, true),
  ('lease', 'Lease Agreement', 'listing_intake', true, true, 3, true),
  ('lease', 'Lead Paint Disclosure (Pre-1978)', 'listing_intake', true, true, 4, true),
  ('lease', 'Tenant Application', 'listing_intake', false, false, 5, true),
  ('lease', 'Security Deposit Receipt', 'compliance', false, false, 10, true),
  ('lease', 'Compliance Acknowledgment', 'compliance', true, true, 40, true);

-- ── REFERRAL ──
INSERT INTO transaction_doc_requirements (transaction_type, doc_label, folder, is_required, signature_required, sort_order, is_active) VALUES
  ('referral', 'Brokerage Relationship Disclosure', 'listing_intake', true, true, 1, true),
  ('referral', 'Wire Fraud Notice', 'listing_intake', true, true, 2, true),
  ('referral', 'Referral Agreement', 'listing_intake', true, true, 3, true),
  ('referral', 'Commission Agreement', 'listing_intake', true, true, 4, true),
  ('referral', 'Cooperating Broker Compensation Agreement', 'listing_intake', false, true, 5, true),
  ('referral', 'Commission Disbursement Authorization (CDA)', 'closing', true, true, 30, true),
  ('referral', 'Compliance Acknowledgment', 'compliance', true, true, 40, true);

-- ── WHOLESALE ──
INSERT INTO transaction_doc_requirements (transaction_type, doc_label, folder, is_required, signature_required, sort_order, is_active) VALUES
  ('wholesale', 'Brokerage Relationship Disclosure', 'listing_intake', true, true, 1, true),
  ('wholesale', 'Wire Fraud Notice', 'listing_intake', true, true, 2, true),
  ('wholesale', 'Purchase Agreement', 'under_contract', true, true, 10, true),
  ('wholesale', 'Assignment Agreement', 'under_contract', true, true, 11, true),
  ('wholesale', 'Proof of Funds', 'under_contract', true, false, 12, true),
  ('wholesale', 'Proof of Earnest Money Delivered', 'under_contract', true, false, 13, true),
  ('wholesale', 'ALTA Settlement Statement / HUD-1', 'closing', true, true, 30, true),
  ('wholesale', 'Commission Disbursement Authorization (CDA)', 'closing', true, true, 31, true),
  ('wholesale', 'Compliance Acknowledgment', 'compliance', true, true, 40, true);

-- ── DOUBLE CLOSE ──
INSERT INTO transaction_doc_requirements (transaction_type, doc_label, folder, is_required, signature_required, sort_order, is_active) VALUES
  ('double_close', 'Brokerage Relationship Disclosure', 'listing_intake', true, true, 1, true),
  ('double_close', 'Wire Fraud Notice', 'listing_intake', true, true, 2, true),
  ('double_close', 'Purchase Agreement (A-B)', 'under_contract', true, true, 10, true),
  ('double_close', 'Purchase Agreement (B-C)', 'under_contract', true, true, 11, true),
  ('double_close', 'Proof of Funds', 'under_contract', true, false, 12, true),
  ('double_close', 'Proof of Earnest Money Delivered', 'under_contract', true, false, 13, true),
  ('double_close', 'ALTA Settlement Statement / HUD-1 (A-B)', 'closing', true, true, 30, true),
  ('double_close', 'ALTA Settlement Statement / HUD-1 (B-C)', 'closing', true, true, 31, true),
  ('double_close', 'Commission Disbursement Authorization (CDA)', 'closing', true, true, 32, true),
  ('double_close', 'Closing Disclosure', 'closing', true, true, 33, true),
  ('double_close', 'Compliance Acknowledgment', 'compliance', true, true, 40, true);
