-- Migration: Enhance Milestone Engine
-- Purpose: Add fields to tc_milestones table for richer milestone tracking
-- Status: Production-ready

/**
 * ====================================================================
 * MILESTONE ENGINE ENHANCEMENTS
 * ====================================================================
 */

-- Add missing fields to tc_milestones if they don't exist
ALTER TABLE public.tc_milestones
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS "order" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

-- Create index for order field for milestone ordering
CREATE INDEX IF NOT EXISTS idx_tc_milestones_order ON public.tc_milestones("order");
CREATE INDEX IF NOT EXISTS idx_tc_milestones_transaction_id_order ON public.tc_milestones(transaction_id, "order");
CREATE INDEX IF NOT EXISTS idx_tc_milestones_is_deleted ON public.tc_milestones(is_deleted);

-- Update milestone table status check constraint if needed (verify it includes all statuses)
-- The existing constraint should be: 'pending', 'completed', 'overdue', 'skipped'

/**
 * ====================================================================
 * MIGRATION HELPER FUNCTIONS
 * ====================================================================
 */

-- Function to get milestone completion percentage for a transaction
CREATE OR REPLACE FUNCTION get_milestone_completion_status(p_transaction_id UUID)
RETURNS TABLE (
  total_milestones INT,
  completed_milestones INT,
  pending_milestones INT,
  overdue_milestones INT,
  completion_percentage NUMERIC
) AS $$
SELECT
  COUNT(*)::INT as total_milestones,
  COUNT(CASE WHEN status = 'completed' THEN 1 END)::INT as completed_milestones,
  COUNT(CASE WHEN status = 'pending' THEN 1 END)::INT as pending_milestones,
  COUNT(CASE WHEN status = 'overdue' THEN 1 END)::INT as overdue_milestones,
  CASE
    WHEN COUNT(*) = 0 THEN 0
    ELSE ROUND((COUNT(CASE WHEN status = 'completed' THEN 1 END)::NUMERIC / COUNT(*)) * 100, 2)
  END as completion_percentage
FROM public.tc_milestones
WHERE transaction_id = p_transaction_id
  AND is_deleted = FALSE;
$$ LANGUAGE SQL STABLE;

-- Function to get auto-marked overdue milestones
CREATE OR REPLACE FUNCTION auto_mark_milestone_overdue()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'pending'
    AND NEW.due_date < CURRENT_DATE
    AND NEW.is_deleted = FALSE THEN
    NEW.status = 'overdue';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-mark overdue milestones on insert/update
DROP TRIGGER IF EXISTS tr_milestone_auto_overdue ON public.tc_milestones;
CREATE TRIGGER tr_milestone_auto_overdue
  BEFORE INSERT OR UPDATE ON public.tc_milestones
  FOR EACH ROW
  EXECUTE FUNCTION auto_mark_milestone_overdue();

-- Function to create milestone activity log entry
CREATE OR REPLACE FUNCTION log_milestone_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.tc_notifications (
      recipient_id,
      transaction_id,
      notification_type,
      message
    )
    SELECT
      tct.agent_id,
      tct.id,
      'milestone_created',
      'Milestone created: ' || NEW.milestone_name
    FROM public.tc_transactions tct
    WHERE tct.id = NEW.transaction_id;
  ELSIF TG_OP = 'UPDATE' AND NEW.status != OLD.status THEN
    IF NEW.status = 'completed' THEN
      INSERT INTO public.tc_notifications (
        recipient_id,
        transaction_id,
        notification_type,
        message
      )
      SELECT
        tct.agent_id,
        tct.id,
        'milestone_completed',
        'Milestone completed: ' || NEW.milestone_name
      FROM public.tc_transactions tct
      WHERE tct.id = NEW.transaction_id;
    ELSIF NEW.status = 'overdue' THEN
      INSERT INTO public.tc_notifications (
        recipient_id,
        transaction_id,
        notification_type,
        message
      )
      SELECT
        tct.agent_id,
        tct.id,
        'deadline_approaching',
        'Milestone overdue: ' || NEW.milestone_name
      FROM public.tc_transactions tct
      WHERE tct.id = NEW.transaction_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for milestone activity logging
DROP TRIGGER IF EXISTS tr_milestone_activity_log ON public.tc_milestones;
CREATE TRIGGER tr_milestone_activity_log
  AFTER INSERT OR UPDATE ON public.tc_milestones
  FOR EACH ROW
  EXECUTE FUNCTION log_milestone_activity();

/**
 * ====================================================================
 * VERIFICATION AND TESTING
 * ====================================================================
 */

-- Verify new columns exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'tc_milestones'
ORDER BY ordinal_position;

-- Verify indexes exist
SELECT indexname
FROM pg_indexes
WHERE tablename = 'tc_milestones'
ORDER BY indexname;

-- Verify triggers exist
SELECT trigger_name
FROM information_schema.triggers
WHERE event_object_table = 'tc_milestones'
ORDER BY trigger_name;
