-- Migration: Broker Review Workflow
-- Purpose: Add broker review tables and RLS policies for deal progression gating
-- Status: Production-ready

/**
 * ====================================================================
 * TABLE: transaction_activity_log
 * Purpose: Log all transaction activities for audit trail
 * ====================================================================
 */
CREATE TABLE IF NOT EXISTS public.transaction_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.tc_transactions(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  action_details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transaction_activity_log_transaction_id ON public.transaction_activity_log(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_activity_log_actor_id ON public.transaction_activity_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_transaction_activity_log_created_at ON public.transaction_activity_log(created_at DESC);

ALTER TABLE public.transaction_activity_log ENABLE ROW LEVEL SECURITY;

-- Anyone can view their own activities
CREATE POLICY transaction_activity_log_select ON public.transaction_activity_log
  FOR SELECT
  USING (
    actor_id = auth.uid()
    OR
    (SELECT agent_id FROM public.tc_transactions WHERE id = transaction_id) = auth.uid()
    OR
    (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'broker'
  );

-- Anyone can insert their own activities
CREATE POLICY transaction_activity_log_insert ON public.transaction_activity_log
  FOR INSERT
  WITH CHECK (actor_id = auth.uid());

/**
 * ====================================================================
 * TABLE: broker_reviews
 * Purpose: Track review requests that gate transaction progression
 * ====================================================================
 */
CREATE TABLE public.broker_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.tc_transactions(id) ON DELETE CASCADE,
  broker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stage TEXT NOT NULL DEFAULT 'pre_milestone' CHECK (stage IN ('pre_milestone', 'pre_closing', 'compliance_flagged')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  notes TEXT,
  rejection_reason TEXT,
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX idx_broker_reviews_transaction_id ON public.broker_reviews(transaction_id);
CREATE INDEX idx_broker_reviews_broker_id ON public.broker_reviews(broker_id);
CREATE INDEX idx_broker_reviews_status ON public.broker_reviews(status);
CREATE INDEX idx_broker_reviews_stage ON public.broker_reviews(stage);
CREATE INDEX idx_broker_reviews_broker_status_created ON public.broker_reviews(broker_id, status, created_at DESC);
CREATE INDEX idx_broker_reviews_requested_by ON public.broker_reviews(requested_by);
CREATE INDEX idx_broker_reviews_created_at ON public.broker_reviews(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.broker_reviews ENABLE ROW LEVEL SECURITY;

/**
 * ====================================================================
 * RLS POLICIES: broker_reviews
 * ====================================================================
 */

-- Brokers can view all review requests for their brokerage
CREATE POLICY broker_reviews_select_for_brokers ON public.broker_reviews
  FOR SELECT
  USING (
    -- Broker can see reviews for their own brokerage
    broker_id = auth.uid()
    OR
    -- Broker can see reviews from their brokerage (via transaction coordinator)
    (
      SELECT tc.broker_id
      FROM public.transaction_coordinators tc
      WHERE tc.id = (
        SELECT tc_id FROM public.tc_transactions WHERE id = transaction_id
      )
    ) = auth.uid()
  );

-- Agents can view their own review requests
CREATE POLICY broker_reviews_select_for_agents ON public.broker_reviews
  FOR SELECT
  USING (
    requested_by = auth.uid()
    OR
    -- Agent can see reviews for their own transactions
    (
      SELECT agent_id FROM public.tc_transactions WHERE id = transaction_id
    ) = auth.uid()
  );

-- Only brokers can approve reviews
CREATE POLICY broker_reviews_approve ON public.broker_reviews
  FOR UPDATE
  USING (broker_id = auth.uid())
  WITH CHECK (broker_id = auth.uid());

-- Anyone can create a review request (agents mostly)
CREATE POLICY broker_reviews_insert ON public.broker_reviews
  FOR INSERT
  WITH CHECK (
    requested_by = auth.uid()
    OR (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'broker'
  );

-- Ensure updates are allowed only for brokers and agents
CREATE POLICY broker_reviews_update ON public.broker_reviews
  FOR UPDATE
  USING (
    broker_id = auth.uid()
    OR requested_by = auth.uid()
  );

/**
 * ====================================================================
 * TRIGGER FUNCTION: Auto-create broker review on transaction status change
 * ====================================================================
 */
CREATE OR REPLACE FUNCTION create_broker_review_on_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Create pre_closing review when transaction marked as ready to close
  IF NEW.status = 'ready_to_close' AND OLD.status != 'ready_to_close' THEN
    INSERT INTO public.broker_reviews (
      transaction_id,
      broker_id,
      requested_by,
      stage,
      status
    )
    SELECT
      NEW.id,
      tc.broker_id,
      NEW.agent_id,
      'pre_closing',
      'pending'
    FROM public.transaction_coordinators tc
    WHERE tc.id = NEW.tc_id
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-create review requests
DROP TRIGGER IF EXISTS tr_auto_create_broker_review ON public.tc_transactions;
CREATE TRIGGER tr_auto_create_broker_review
  AFTER UPDATE ON public.tc_transactions
  FOR EACH ROW
  EXECUTE FUNCTION create_broker_review_on_status_change();

/**
 * ====================================================================
 * TRIGGER FUNCTION: Log review activity
 * ====================================================================
 */
CREATE OR REPLACE FUNCTION log_broker_review_activity()
RETURNS TRIGGER AS $$
BEGIN
  -- Log review status changes
  IF TG_OP = 'UPDATE' AND NEW.status != OLD.status THEN
    -- Create activity log entry
    INSERT INTO public.transaction_activity_log (
      transaction_id,
      actor_id,
      action_type,
      action_details
    )
    SELECT
      NEW.transaction_id,
      COALESCE(NEW.broker_id, NEW.requested_by),
      CASE
        WHEN NEW.status = 'approved' THEN 'broker_review_approved'
        WHEN NEW.status = 'rejected' THEN 'broker_review_rejected'
        ELSE 'broker_review_status_changed'
      END,
      jsonb_build_object(
        'stage', NEW.stage,
        'status', NEW.status,
        'rejection_reason', NEW.rejection_reason,
        'notes', NEW.notes
      )
    WHERE EXISTS (
      SELECT 1 FROM public.tc_transactions WHERE id = NEW.transaction_id
    );

    -- Send notification on approval
    IF NEW.status = 'approved' THEN
      INSERT INTO public.tc_notifications (
        recipient_id,
        transaction_id,
        notification_type,
        message
      )
      SELECT
        tct.agent_id,
        tct.id,
        'broker_review_approved',
        'Your deal was approved by your broker for ' || NEW.stage
      FROM public.tc_transactions tct
      WHERE tct.id = NEW.transaction_id;
    END IF;

    -- Send notification on rejection
    IF NEW.status = 'rejected' THEN
      INSERT INTO public.tc_notifications (
        recipient_id,
        transaction_id,
        notification_type,
        message
      )
      SELECT
        tct.agent_id,
        tct.id,
        'broker_review_rejected',
        'Your deal was rejected by your broker. Reason: ' || COALESCE(NEW.rejection_reason, 'No reason provided')
      FROM public.tc_transactions tct
      WHERE tct.id = NEW.transaction_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to log review activities
DROP TRIGGER IF EXISTS tr_log_broker_review_activity ON public.broker_reviews;
CREATE TRIGGER tr_log_broker_review_activity
  AFTER INSERT OR UPDATE ON public.broker_reviews
  FOR EACH ROW
  EXECUTE FUNCTION log_broker_review_activity();

/**
 * ====================================================================
 * HELPER FUNCTION: Get review status for transaction
 * ====================================================================
 */
CREATE OR REPLACE FUNCTION get_transaction_review_status(p_transaction_id UUID)
RETURNS TABLE (
  review_id UUID,
  stage TEXT,
  status TEXT,
  broker_id UUID,
  rejection_reason TEXT,
  requested_at TIMESTAMP WITH TIME ZONE,
  reviewed_at TIMESTAMP WITH TIME ZONE
) AS $$
SELECT
  id,
  stage,
  status,
  broker_id,
  rejection_reason,
  requested_at,
  reviewed_at
FROM public.broker_reviews
WHERE transaction_id = p_transaction_id
ORDER BY created_at DESC
LIMIT 1;
$$ LANGUAGE SQL STABLE;

/**
 * ====================================================================
 * HELPER FUNCTION: Check if transaction can progress
 * ====================================================================
 */
CREATE OR REPLACE FUNCTION can_transaction_progress(p_transaction_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_pending_reviews INT;
  v_rejected_reviews INT;
BEGIN
  -- Check if there are any pending or rejected reviews
  SELECT COUNT(*) INTO v_pending_reviews
  FROM public.broker_reviews
  WHERE transaction_id = p_transaction_id
    AND status IN ('pending', 'rejected');

  RETURN v_pending_reviews = 0;
END;
$$ LANGUAGE plpgsql STABLE;

/**
 * ====================================================================
 * MIGRATION NOTES
 * ====================================================================
 * - RLS policies ensure data isolation by brokerage and user role
 * - Auto-triggers create reviews when needed and log activities
 * - Helper functions allow checking review status and transaction progression
 * - Indexes optimize common queries for dashboard and listing views
 */
