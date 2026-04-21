-- 026_closeiq_notifications.sql
-- Add CloseIQ notification types to compliance_notifications CHECK constraint
-- and ensure broker can receive offer submission alerts

-- 1. Drop the old CHECK constraint on notification_type and add expanded one
ALTER TABLE compliance_notifications
  DROP CONSTRAINT IF EXISTS compliance_notifications_notification_type_check;

ALTER TABLE compliance_notifications
  ADD CONSTRAINT compliance_notifications_notification_type_check
  CHECK (notification_type IN (
    -- Existing compliance types
    'doc_uploaded',
    'doc_approved',
    'doc_rejected',
    'missing_signature',
    'compliance_complete',
    'compliance_incomplete',
    'commission_blocked',
    'commission_unlocked',
    -- New CloseIQ types
    'offer_submitted',
    'offer_approved',
    'offer_rejected',
    'offer_revision_requested',
    'offer_escalated'
  ));
