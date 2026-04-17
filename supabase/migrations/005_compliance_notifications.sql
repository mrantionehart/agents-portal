-- ─── Compliance Notifications Table ────────────────────────────────────
-- Used by agents-portal, vault, and EASE app for compliance alerts
CREATE TABLE IF NOT EXISTS compliance_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_id UUID,  -- nullable for general notifications
  notification_type TEXT NOT NULL CHECK (notification_type IN (
    'doc_uploaded',        -- agent uploaded a doc → notify broker
    'doc_approved',        -- broker approved → notify agent
    'doc_rejected',        -- broker rejected → notify agent
    'missing_signature',   -- broker flagged missing signature → notify agent
    'compliance_complete', -- all required docs approved → notify agent
    'compliance_incomplete', -- approaching close date with missing docs → notify both
    'commission_blocked',  -- commission blocked due to compliance → notify agent
    'commission_unlocked'  -- compliance cleared, commission available → notify agent
  )),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',  -- extra data: doc_label, folder, etc.
  read_at TIMESTAMPTZ,
  email_sent BOOLEAN DEFAULT FALSE,
  push_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compliance_notif_recipient ON compliance_notifications(recipient_id, read_at);
CREATE INDEX IF NOT EXISTS idx_compliance_notif_transaction ON compliance_notifications(transaction_id);
CREATE INDEX IF NOT EXISTS idx_compliance_notif_type ON compliance_notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_compliance_notif_created ON compliance_notifications(created_at DESC);

-- RLS
ALTER TABLE compliance_notifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own notifications
CREATE POLICY "Users can read own compliance notifications"
  ON compliance_notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = recipient_id);

-- Users can mark their own as read
CREATE POLICY "Users can update own compliance notifications"
  ON compliance_notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = recipient_id);

-- Service role inserts (API routes use service role key)
-- No insert policy for authenticated — only service role can create


-- ─── Add signature tracking to documents ───────────────────────────────
-- Track whether signatures are required and present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'signature_status'
  ) THEN
    ALTER TABLE documents ADD COLUMN signature_status TEXT DEFAULT 'not_required'
      CHECK (signature_status IN ('not_required', 'required', 'missing', 'present'));
    ALTER TABLE documents ADD COLUMN signature_notes TEXT;
    ALTER TABLE documents ADD COLUMN reviewed_by UUID REFERENCES auth.users(id);
    ALTER TABLE documents ADD COLUMN reviewed_at TIMESTAMPTZ;
  END IF;
END $$;


-- ─── Add compliance_approved flag to transactions ──────────────────────
-- Gates commission payout
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'compliance_approved'
  ) THEN
    ALTER TABLE transactions ADD COLUMN compliance_approved BOOLEAN DEFAULT FALSE;
    ALTER TABLE transactions ADD COLUMN compliance_approved_at TIMESTAMPTZ;
    ALTER TABLE transactions ADD COLUMN compliance_approved_by UUID REFERENCES auth.users(id);
  END IF;
END $$;


-- ─── Add signature_required flag to doc requirements ───────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transaction_doc_requirements' AND column_name = 'signature_required'
  ) THEN
    ALTER TABLE transaction_doc_requirements ADD COLUMN signature_required BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Mark which documents typically require signatures
UPDATE transaction_doc_requirements SET signature_required = TRUE
WHERE doc_label IN (
  'Listing Agreement',
  'Buyer Representation Agreement',
  'Purchase Agreement',
  'Seller Disclosure',
  'Closing Disclosure',
  'Wire Fraud Notice',
  'Brokerage Relationship Disclosure',
  'Informed Consent to Dual Agency',
  'Permission to Advertise',
  'Lead Paint/No Lead Paint Disclosure',
  'Lease Agreement',
  'Referral Agreement',
  'Commission Agreement',
  'Assignment Agreement',
  'Compliance Acknowledgment',
  'Marketing Authorization',
  'Cooperating Broker Compensation Agreement'
);
