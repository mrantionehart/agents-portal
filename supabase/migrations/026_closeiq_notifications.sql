-- 026_closeiq_notifications.sql
-- Creates compliance_notifications table (if missing) and adds CloseIQ notification types
-- ALREADY RUN in Supabase on 2026-04-21

CREATE TABLE IF NOT EXISTS compliance_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_id UUID,
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  read_at TIMESTAMPTZ,
  email_sent BOOLEAN DEFAULT FALSE,
  push_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compliance_notif_recipient ON compliance_notifications(recipient_id, read_at);
CREATE INDEX IF NOT EXISTS idx_compliance_notif_type ON compliance_notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_compliance_notif_created ON compliance_notifications(created_at DESC);

ALTER TABLE compliance_notifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can read own compliance notifications"
    ON compliance_notifications FOR SELECT TO authenticated
    USING (auth.uid() = recipient_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own compliance notifications"
    ON compliance_notifications FOR UPDATE TO authenticated
    USING (auth.uid() = recipient_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE compliance_notifications
  ADD CONSTRAINT compliance_notifications_notification_type_check
  CHECK (notification_type IN (
    'doc_uploaded', 'doc_approved', 'doc_rejected', 'missing_signature',
    'compliance_complete', 'compliance_incomplete', 'commission_blocked', 'commission_unlocked',
    'offer_submitted', 'offer_approved', 'offer_rejected', 'offer_revision_requested', 'offer_escalated'
  ));
