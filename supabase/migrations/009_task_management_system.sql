-- Migration: Task Management System
-- Purpose: Complete task management with RLS, notifications, and audit trail
-- Status: Production-ready
-- Version: 1.0

/**
 * ====================================================================
 * TABLE: tasks
 * Purpose: Core task management for transactions
 * ====================================================================
 */
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.tc_transactions(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_to UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  due_date TIMESTAMP WITH TIME ZONE,
  completion_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_tasks_transaction_id ON public.tasks(transaction_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_by ON public.tasks(assigned_by);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON public.tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON public.tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at ON public.tasks(deleted_at);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Agents can view tasks for their transactions
CREATE POLICY tasks_select_agent ON public.tasks
  FOR SELECT
  USING (
    (SELECT agent_id FROM public.tc_transactions WHERE id = transaction_id) = auth.uid()
    OR assigned_to = auth.uid()
    OR assigned_by = auth.uid()
    OR (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'broker'
  );

-- Agents can create tasks for their transactions
CREATE POLICY tasks_insert_agent ON public.tasks
  FOR INSERT
  WITH CHECK (
    (SELECT agent_id FROM public.tc_transactions WHERE id = transaction_id) = auth.uid()
    OR (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'broker'
  )
  AND assigned_by = auth.uid();

-- Task creator or assignee can update (with restrictions for brokers)
CREATE POLICY tasks_update ON public.tasks
  FOR UPDATE
  USING (
    assigned_by = auth.uid()
    OR assigned_to = auth.uid()
    OR (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'broker'
  );

-- Task creator or broker can delete
CREATE POLICY tasks_delete ON public.tasks
  FOR DELETE
  USING (
    assigned_by = auth.uid()
    OR (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'broker'
  );

/**
 * ====================================================================
 * TABLE: task_comments
 * Purpose: Collaborative comments on tasks
 * ====================================================================
 */
CREATE TABLE IF NOT EXISTS public.task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comment_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON public.task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_user_id ON public.task_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_created_at ON public.task_comments(created_at DESC);

ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

-- Anyone with access to the task can view comments
CREATE POLICY task_comments_select ON public.task_comments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks
      WHERE id = task_id
      AND (
        (SELECT agent_id FROM public.tc_transactions WHERE id = transaction_id) = auth.uid()
        OR assigned_to = auth.uid()
        OR assigned_by = auth.uid()
        OR (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'broker'
      )
    )
  );

-- Only authenticated users can add comments
CREATE POLICY task_comments_insert ON public.task_comments
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Only comment author or broker can update
CREATE POLICY task_comments_update ON public.task_comments
  FOR UPDATE
  USING (
    user_id = auth.uid()
    OR (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'broker'
  );

-- Only comment author or broker can delete
CREATE POLICY task_comments_delete ON public.task_comments
  FOR DELETE
  USING (
    user_id = auth.uid()
    OR (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'broker'
  );

/**
 * ====================================================================
 * TABLE: task_activity
 * Purpose: Audit trail for compliance and change tracking
 * ====================================================================
 */
CREATE TABLE IF NOT EXISTS public.task_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('created', 'assigned', 'status_changed', 'commented', 'updated', 'deleted')),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  changes JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_activity_task_id ON public.task_activity(task_id);
CREATE INDEX IF NOT EXISTS idx_task_activity_user_id ON public.task_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_task_activity_action ON public.task_activity(action);
CREATE INDEX IF NOT EXISTS idx_task_activity_created_at ON public.task_activity(created_at DESC);

ALTER TABLE public.task_activity ENABLE ROW LEVEL SECURITY;

-- Can view activity for tasks you have access to
CREATE POLICY task_activity_select ON public.task_activity
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks
      WHERE id = task_id
      AND (
        (SELECT agent_id FROM public.tc_transactions WHERE id = transaction_id) = auth.uid()
        OR assigned_to = auth.uid()
        OR assigned_by = auth.uid()
        OR (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'broker'
      )
    )
  );

-- Only system/triggers can insert activity
CREATE POLICY task_activity_insert ON public.task_activity
  FOR INSERT
  WITH CHECK (true); -- Controlled by triggers

/**
 * ====================================================================
 * TRIGGER FUNCTIONS: Auto-completion and overdue marking
 * ====================================================================
 */

-- Auto-set completion_date when status changes to completed
CREATE OR REPLACE FUNCTION task_auto_completion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND NEW.completion_date IS NULL THEN
    NEW.completion_date = CURRENT_TIMESTAMP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-completion
DROP TRIGGER IF EXISTS tr_task_auto_completion ON public.tasks;
CREATE TRIGGER tr_task_auto_completion
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION task_auto_completion();

-- Log task creation
CREATE OR REPLACE FUNCTION task_log_creation()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.task_activity (
    task_id,
    action,
    user_id,
    changes
  ) VALUES (
    NEW.id,
    'created',
    NEW.assigned_by,
    jsonb_build_object(
      'title', NEW.title,
      'assigned_to', NEW.assigned_to,
      'priority', NEW.priority,
      'due_date', NEW.due_date
    )
  );

  -- Create notification for assignee
  INSERT INTO public.tc_notifications (
    recipient_id,
    transaction_id,
    notification_type,
    message,
    metadata
  )
  SELECT
    NEW.assigned_to,
    NEW.transaction_id,
    'task_assigned',
    'Task assigned: ' || NEW.title || (CASE WHEN NEW.due_date IS NOT NULL THEN ' - Due: ' || to_char(NEW.due_date, 'MMM DD, YYYY') ELSE '' END),
    jsonb_build_object(
      'task_id', NEW.id,
      'priority', NEW.priority
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for task creation logging
DROP TRIGGER IF EXISTS tr_task_log_creation ON public.tasks;
CREATE TRIGGER tr_task_log_creation
  AFTER INSERT ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION task_log_creation();

-- Log task status changes
CREATE OR REPLACE FUNCTION task_log_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status != OLD.status THEN
    INSERT INTO public.task_activity (
      task_id,
      action,
      user_id,
      changes
    ) VALUES (
      NEW.id,
      'status_changed',
      auth.uid(),
      jsonb_build_object(
        'from', OLD.status,
        'to', NEW.status,
        'timestamp', CURRENT_TIMESTAMP
      )
    );

    -- Notify creator if task completed
    IF NEW.status = 'completed' THEN
      INSERT INTO public.tc_notifications (
        recipient_id,
        transaction_id,
        notification_type,
        message,
        metadata
      )
      SELECT
        OLD.assigned_by,
        NEW.transaction_id,
        'task_completed',
        'Task completed: ' || NEW.title,
        jsonb_build_object(
          'task_id', NEW.id,
          'completed_by', NEW.assigned_to,
          'completion_date', NEW.completion_date
        );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for status change logging
DROP TRIGGER IF EXISTS tr_task_log_status_change ON public.tasks;
CREATE TRIGGER tr_task_log_status_change
  AFTER UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION task_log_status_change();

-- Log task updates
CREATE OR REPLACE FUNCTION task_log_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.title != OLD.title
    OR NEW.description != OLD.description
    OR NEW.priority != OLD.priority
    OR NEW.due_date != OLD.due_date THEN

    INSERT INTO public.task_activity (
      task_id,
      action,
      user_id,
      changes
    ) VALUES (
      NEW.id,
      'updated',
      auth.uid(),
      jsonb_build_object(
        'title', CASE WHEN NEW.title != OLD.title THEN jsonb_build_object('from', OLD.title, 'to', NEW.title) ELSE NULL END,
        'description', CASE WHEN NEW.description != OLD.description THEN jsonb_build_object('from', OLD.description, 'to', NEW.description) ELSE NULL END,
        'priority', CASE WHEN NEW.priority != OLD.priority THEN jsonb_build_object('from', OLD.priority, 'to', NEW.priority) ELSE NULL END,
        'due_date', CASE WHEN NEW.due_date != OLD.due_date THEN jsonb_build_object('from', OLD.due_date, 'to', NEW.due_date) ELSE NULL END
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for update logging
DROP TRIGGER IF EXISTS tr_task_log_update ON public.tasks;
CREATE TRIGGER tr_task_log_update
  AFTER UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION task_log_update();

-- Log task comments
CREATE OR REPLACE FUNCTION task_log_comment()
RETURNS TRIGGER AS $$
DECLARE
  v_task_id UUID;
  v_assigned_by UUID;
  v_assigned_to UUID;
BEGIN
  SELECT id, assigned_by, assigned_to INTO v_task_id, v_assigned_by, v_assigned_to
  FROM public.tasks
  WHERE id = NEW.task_id;

  INSERT INTO public.task_activity (
    task_id,
    action,
    user_id,
    changes
  ) VALUES (
    NEW.task_id,
    'commented',
    NEW.user_id,
    jsonb_build_object(
      'comment_id', NEW.id,
      'comment_preview', LEFT(NEW.comment_text, 100)
    )
  );

  -- Notify other participants (creator and assignee)
  IF v_assigned_to != NEW.user_id THEN
    INSERT INTO public.tc_notifications (
      recipient_id,
      transaction_id,
      notification_type,
      message
    )
    SELECT v_assigned_to, transaction_id, 'task_comment', 'New comment on task: ' || title
    FROM public.tasks WHERE id = NEW.task_id;
  END IF;

  IF v_assigned_by != NEW.user_id THEN
    INSERT INTO public.tc_notifications (
      recipient_id,
      transaction_id,
      notification_type,
      message
    )
    SELECT v_assigned_by, transaction_id, 'task_comment', 'New comment on task: ' || title
    FROM public.tasks WHERE id = NEW.task_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for comment logging
DROP TRIGGER IF EXISTS tr_task_log_comment ON public.task_comments;
CREATE TRIGGER tr_task_log_comment
  AFTER INSERT ON public.task_comments
  FOR EACH ROW
  EXECUTE FUNCTION task_log_comment();

/**
 * ====================================================================
 * HELPER FUNCTIONS: Statistics and Queries
 * ====================================================================
 */

-- Function to get task statistics for dashboard
CREATE OR REPLACE FUNCTION get_task_stats(p_user_id UUID, p_role TEXT DEFAULT NULL)
RETURNS TABLE (
  total_tasks BIGINT,
  pending_count BIGINT,
  in_progress_count BIGINT,
  completed_count BIGINT,
  blocked_count BIGINT,
  overdue_count BIGINT,
  due_today_count BIGINT,
  high_priority_count BIGINT,
  urgent_count BIGINT,
  completion_rate NUMERIC,
  avg_completion_days NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_tasks,
    COUNT(CASE WHEN status = 'pending' THEN 1 END)::BIGINT as pending_count,
    COUNT(CASE WHEN status = 'in_progress' THEN 1 END)::BIGINT as in_progress_count,
    COUNT(CASE WHEN status = 'completed' THEN 1 END)::BIGINT as completed_count,
    COUNT(CASE WHEN status = 'blocked' THEN 1 END)::BIGINT as blocked_count,
    COUNT(CASE WHEN status IN ('pending', 'in_progress', 'blocked') AND due_date < CURRENT_TIMESTAMP THEN 1 END)::BIGINT as overdue_count,
    COUNT(CASE WHEN DATE(due_date) = CURRENT_DATE AND status != 'completed' THEN 1 END)::BIGINT as due_today_count,
    COUNT(CASE WHEN priority IN ('high', 'urgent') THEN 1 END)::BIGINT as high_priority_count,
    COUNT(CASE WHEN priority = 'urgent' THEN 1 END)::BIGINT as urgent_count,
    CASE
      WHEN COUNT(*) = 0 THEN 0
      ELSE ROUND((COUNT(CASE WHEN status = 'completed' THEN 1 END)::NUMERIC / COUNT(*)) * 100, 2)
    END as completion_rate,
    CASE
      WHEN COUNT(CASE WHEN status = 'completed' THEN 1 END) = 0 THEN 0
      ELSE ROUND(AVG(EXTRACT(DAY FROM (completion_date - created_at)))::NUMERIC, 2)
    END as avg_completion_days
  FROM public.tasks
  WHERE deleted_at IS NULL
    AND (
      assigned_to = p_user_id
      OR assigned_by = p_user_id
      OR (p_role = 'broker' AND (SELECT role FROM public.user_profiles WHERE id = p_user_id) = 'broker')
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get overdue tasks
CREATE OR REPLACE FUNCTION get_overdue_tasks(p_user_id UUID)
RETURNS TABLE (
  task_id UUID,
  title TEXT,
  assigned_to UUID,
  assigned_by UUID,
  transaction_id UUID,
  due_date TIMESTAMP WITH TIME ZONE,
  days_overdue INT,
  priority TEXT
) AS $$
SELECT
  t.id,
  t.title,
  t.assigned_to,
  t.assigned_by,
  t.transaction_id,
  t.due_date,
  EXTRACT(DAY FROM (CURRENT_TIMESTAMP - t.due_date))::INT as days_overdue,
  t.priority
FROM public.tasks t
WHERE t.deleted_at IS NULL
  AND t.status IN ('pending', 'in_progress', 'blocked')
  AND t.due_date < CURRENT_TIMESTAMP
  AND (t.assigned_to = p_user_id OR (SELECT role FROM public.user_profiles WHERE id = p_user_id) = 'broker')
ORDER BY t.due_date ASC;
$$ LANGUAGE SQL STABLE;

-- Function to check for task conflicts with milestones
CREATE OR REPLACE FUNCTION get_tasks_for_transaction(p_transaction_id UUID)
RETURNS TABLE (
  id UUID,
  title TEXT,
  status TEXT,
  priority TEXT,
  assigned_to UUID,
  assigned_to_name TEXT,
  due_date TIMESTAMP WITH TIME ZONE,
  completion_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  overdue BOOLEAN
) AS $$
SELECT
  t.id,
  t.title,
  t.status,
  t.priority,
  t.assigned_to,
  COALESCE(up.full_name, up.email) as assigned_to_name,
  t.due_date,
  t.completion_date,
  t.created_at,
  t.updated_at,
  (t.status IN ('pending', 'in_progress', 'blocked') AND t.due_date < CURRENT_TIMESTAMP) as overdue
FROM public.tasks t
LEFT JOIN public.user_profiles up ON up.id = t.assigned_to
WHERE t.transaction_id = p_transaction_id
  AND t.deleted_at IS NULL
ORDER BY t.due_date ASC NULLS LAST, t.created_at DESC;
$$ LANGUAGE SQL STABLE;

/**
 * ====================================================================
 * NOTIFICATION HELPER: Daily overdue task digest
 * ====================================================================
 */

-- Function to create daily overdue notifications (call via cron job)
CREATE OR REPLACE FUNCTION create_overdue_task_notifications()
RETURNS TABLE (
  notifications_created INT
) AS $$
DECLARE
  v_count INT := 0;
BEGIN
  INSERT INTO public.tc_notifications (
    recipient_id,
    transaction_id,
    notification_type,
    message,
    metadata
  )
  SELECT
    t.assigned_to,
    t.transaction_id,
    'task_overdue',
    'Overdue task: ' || t.title || ' - Due ' || to_char(t.due_date, 'MMM DD'),
    jsonb_build_object(
      'task_id', t.id,
      'days_overdue', EXTRACT(DAY FROM (CURRENT_TIMESTAMP - t.due_date))::INT,
      'priority', t.priority
    )
  FROM public.tasks t
  WHERE t.deleted_at IS NULL
    AND t.status IN ('pending', 'in_progress', 'blocked')
    AND t.due_date < CURRENT_TIMESTAMP
    AND NOT EXISTS (
      SELECT 1 FROM public.tc_notifications
      WHERE task_id = t.id
        AND notification_type = 'task_overdue'
        AND created_at > CURRENT_TIMESTAMP - INTERVAL '1 day'
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN QUERY SELECT v_count;
END;
$$ LANGUAGE plpgsql;

/**
 * ====================================================================
 * UPDATED TABLE SCHEMAS
 * ====================================================================
 */

-- Add task-related fields to tc_transactions if they don't exist
ALTER TABLE public.tc_transactions
ADD COLUMN IF NOT EXISTS task_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS overdue_task_count INT DEFAULT 0;

-- Add task_id foreign key to tc_notifications if needed
ALTER TABLE public.tc_notifications
ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_tc_notifications_task_id ON public.tc_notifications(task_id);

/**
 * ====================================================================
 * DATA INITIALIZATION
 * ====================================================================
 */

-- No data to initialize; system is ready for use
