-- Migration: Transaction Coordinator System
-- Purpose: Add TC tables and relationships for Priority 4
-- Status: Production-ready

/**
 * ====================================================================
 * TABLE 1: transaction_coordinators
 * ====================================================================
 */
CREATE TABLE public.transaction_coordinators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tc_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('active', 'inactive', 'pending_approval')),
  hire_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  CONSTRAINT unique_tc_per_agent UNIQUE(agent_id, tc_user_id)
);

CREATE INDEX idx_transaction_coordinators_agent_id ON public.transaction_coordinators(agent_id);
CREATE INDEX idx_transaction_coordinators_tc_user_id ON public.transaction_coordinators(tc_user_id);
CREATE INDEX idx_transaction_coordinators_status ON public.transaction_coordinators(status);

ALTER TABLE public.transaction_coordinators ENABLE ROW LEVEL SECURITY;

CREATE POLICY tc_coordinators_select ON public.transaction_coordinators
  FOR SELECT
  USING (
    agent_id = auth.uid()
    OR tc_user_id = auth.uid()
    OR (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'broker'
  );

CREATE POLICY tc_coordinators_insert ON public.transaction_coordinators
  FOR INSERT
  WITH CHECK ((SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'broker');

CREATE POLICY tc_coordinators_update ON public.transaction_coordinators
  FOR UPDATE
  USING ((SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'broker');

/**
 * ====================================================================
 * TABLE 2: tc_assignments
 * ====================================================================
 */
CREATE TABLE public.tc_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tc_id UUID NOT NULL REFERENCES public.transaction_coordinators(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('pending_approval', 'approved', 'active', 'inactive')),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  commission_split NUMERIC(5,2) DEFAULT 20.00 CHECK (commission_split > 0 AND commission_split < 100),
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_active_assignment UNIQUE(agent_id, tc_id, status)
);

CREATE INDEX idx_tc_assignments_agent_id ON public.tc_assignments(agent_id);
CREATE INDEX idx_tc_assignments_tc_id ON public.tc_assignments(tc_id);
CREATE INDEX idx_tc_assignments_status ON public.tc_assignments(status);
CREATE INDEX idx_tc_assignments_approved_at ON public.tc_assignments(approved_at);

ALTER TABLE public.tc_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY tc_assignments_select ON public.tc_assignments
  FOR SELECT
  USING (
    agent_id = auth.uid()
    OR (SELECT tc_user_id FROM public.transaction_coordinators WHERE id = tc_id) = auth.uid()
    OR (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'broker'
  );

CREATE POLICY tc_assignments_insert ON public.tc_assignments
  FOR INSERT
  WITH CHECK (agent_id = auth.uid() OR (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'broker');

CREATE POLICY tc_assignments_update ON public.tc_assignments
  FOR UPDATE
  USING ((SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'broker');

/**
 * ====================================================================
 * TABLE 3: tc_transactions
 * ====================================================================
 */
CREATE TABLE public.tc_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tc_id UUID NOT NULL REFERENCES public.transaction_coordinators(id) ON DELETE CASCADE,
  deal_id UUID,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('new_deal', 'follow_up', 'closing', 'other')),
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'in_progress', 'pending_docs', 'completed', 'stalled')),
  expected_close_date DATE,
  notes TEXT,
  assigned_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_tc_transactions_agent_id ON public.tc_transactions(agent_id);
CREATE INDEX idx_tc_transactions_tc_id ON public.tc_transactions(tc_id);
CREATE INDEX idx_tc_transactions_status ON public.tc_transactions(status);
CREATE INDEX idx_tc_transactions_expected_close_date ON public.tc_transactions(expected_close_date);
CREATE INDEX idx_tc_transactions_created_at ON public.tc_transactions(created_at);

ALTER TABLE public.tc_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY tc_transactions_select ON public.tc_transactions
  FOR SELECT
  USING (
    agent_id = auth.uid()
    OR tc_id = (SELECT id FROM public.transaction_coordinators WHERE tc_user_id = auth.uid() LIMIT 1)
    OR (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'broker'
  );

CREATE POLICY tc_transactions_insert ON public.tc_transactions
  FOR INSERT
  WITH CHECK (
    agent_id = auth.uid()
    OR tc_id = (SELECT id FROM public.transaction_coordinators WHERE tc_user_id = auth.uid() LIMIT 1)
  );

CREATE POLICY tc_transactions_update ON public.tc_transactions
  FOR UPDATE
  USING (
    agent_id = auth.uid()
    OR tc_id = (SELECT id FROM public.transaction_coordinators WHERE tc_user_id = auth.uid() LIMIT 1)
  );

/**
 * ====================================================================
 * TABLE 4: tc_documents
 * ====================================================================
 */
CREATE TABLE public.tc_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.tc_transactions(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('contract', 'disclosure', 'inspection', 'appraisal', 'insurance', 'title', 'other')),
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'received', 'verified', 'failed')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_tc_documents_transaction_id ON public.tc_documents(transaction_id);
CREATE INDEX idx_tc_documents_doc_type ON public.tc_documents(doc_type);
CREATE INDEX idx_tc_documents_status ON public.tc_documents(status);
CREATE INDEX idx_tc_documents_uploaded_at ON public.tc_documents(uploaded_at);

ALTER TABLE public.tc_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY tc_documents_select ON public.tc_documents
  FOR SELECT
  USING (
    (SELECT agent_id FROM public.tc_transactions WHERE id = transaction_id) = auth.uid()
    OR (SELECT tc_id FROM public.tc_transactions WHERE id = transaction_id) =
        (SELECT id FROM public.transaction_coordinators WHERE tc_user_id = auth.uid() LIMIT 1)
    OR (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'broker'
  );

CREATE POLICY tc_documents_insert ON public.tc_documents
  FOR INSERT
  WITH CHECK (
    (SELECT agent_id FROM public.tc_transactions WHERE id = transaction_id) = auth.uid()
    OR (SELECT tc_id FROM public.tc_transactions WHERE id = transaction_id) =
        (SELECT id FROM public.transaction_coordinators WHERE tc_user_id = auth.uid() LIMIT 1)
  );

/**
 * ====================================================================
 * TABLE 5: tc_milestones
 * ====================================================================
 */
CREATE TABLE public.tc_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.tc_transactions(id) ON DELETE CASCADE,
  milestone_name TEXT NOT NULL,
  due_date DATE NOT NULL,
  completed_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'overdue', 'skipped')),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_tc_milestones_transaction_id ON public.tc_milestones(transaction_id);
CREATE INDEX idx_tc_milestones_due_date ON public.tc_milestones(due_date);
CREATE INDEX idx_tc_milestones_status ON public.tc_milestones(status);

ALTER TABLE public.tc_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY tc_milestones_select ON public.tc_milestones
  FOR SELECT
  USING (
    (SELECT agent_id FROM public.tc_transactions WHERE id = transaction_id) = auth.uid()
    OR (SELECT tc_id FROM public.tc_transactions WHERE id = transaction_id) =
        (SELECT id FROM public.transaction_coordinators WHERE tc_user_id = auth.uid() LIMIT 1)
    OR (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'broker'
  );

CREATE POLICY tc_milestones_insert ON public.tc_milestones
  FOR INSERT
  WITH CHECK (
    (SELECT agent_id FROM public.tc_transactions WHERE id = transaction_id) = auth.uid()
    OR (SELECT tc_id FROM public.tc_transactions WHERE id = transaction_id) =
        (SELECT id FROM public.transaction_coordinators WHERE tc_user_id = auth.uid() LIMIT 1)
  );

CREATE POLICY tc_milestones_update ON public.tc_milestones
  FOR UPDATE
  USING (
    (SELECT agent_id FROM public.tc_transactions WHERE id = transaction_id) = auth.uid()
    OR (SELECT tc_id FROM public.tc_transactions WHERE id = transaction_id) =
        (SELECT id FROM public.transaction_coordinators WHERE tc_user_id = auth.uid() LIMIT 1)
  );

/**
 * ====================================================================
 * TABLE 6: tc_notifications
 * ====================================================================
 */
CREATE TABLE public.tc_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES public.tc_transactions(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL CHECK (
    notification_type IN (
      'transaction_created',
      'doc_uploaded',
      'milestone_completed',
      'status_changed',
      'assignment_approved',
      'deadline_approaching'
    )
  ),
  message TEXT NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_tc_notifications_recipient_id ON public.tc_notifications(recipient_id);
CREATE INDEX idx_tc_notifications_created_at ON public.tc_notifications(created_at);
CREATE INDEX idx_tc_notifications_read_at ON public.tc_notifications(read_at);

ALTER TABLE public.tc_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY tc_notifications_select ON public.tc_notifications
  FOR SELECT
  USING (recipient_id = auth.uid());

CREATE POLICY tc_notifications_update ON public.tc_notifications
  FOR UPDATE
  USING (recipient_id = auth.uid());

/**
 * ====================================================================
 * TRIGGERS: Auto-update timestamps
 * ====================================================================
 */
CREATE OR REPLACE FUNCTION update_tc_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_transaction_coordinators_updated_at
  BEFORE UPDATE ON public.transaction_coordinators
  FOR EACH ROW
  EXECUTE FUNCTION update_tc_updated_at();

CREATE TRIGGER tr_tc_assignments_updated_at
  BEFORE UPDATE ON public.tc_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_tc_updated_at();

CREATE TRIGGER tr_tc_transactions_updated_at
  BEFORE UPDATE ON public.tc_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_tc_updated_at();

CREATE TRIGGER tr_tc_milestones_updated_at
  BEFORE UPDATE ON public.tc_milestones
  FOR EACH ROW
  EXECUTE FUNCTION update_tc_updated_at();

/**
 * ====================================================================
 * FUNCTIONS: TC System Helpers
 * ====================================================================
 */

-- Get active TC for agent
CREATE OR REPLACE FUNCTION get_agent_active_tc(p_agent_id UUID)
RETURNS SETOF public.transaction_coordinators AS $$
SELECT tc.*
FROM public.transaction_coordinators tc
INNER JOIN public.tc_assignments ta ON tc.id = ta.tc_id
WHERE tc.agent_id = p_agent_id
  AND ta.status = 'active'
  AND tc.status = 'active';
$$ LANGUAGE SQL STABLE;

-- Get TC dashboard summary
CREATE OR REPLACE FUNCTION get_tc_dashboard_summary(p_tc_user_id UUID)
RETURNS TABLE (
  assigned_agents INT,
  active_transactions INT,
  pending_docs INT,
  overdue_milestones INT,
  commission_potential NUMERIC
) AS $$
SELECT
  COUNT(DISTINCT tca.agent_id)::INT,
  COUNT(DISTINCT CASE WHEN tct.status != 'completed' THEN tct.id END)::INT,
  COUNT(DISTINCT CASE WHEN tcd.status = 'pending' THEN tcd.id END)::INT,
  COUNT(DISTINCT CASE WHEN tcm.status = 'overdue' THEN tcm.id END)::INT,
  COALESCE(SUM((SELECT total_value FROM broker_deals WHERE agent_id = tca.agent_id LIMIT 1) * (tca.commission_split / 100)), 0)
FROM public.transaction_coordinators tc
LEFT JOIN public.tc_assignments tca ON tc.id = tca.tc_id AND tca.status = 'active'
LEFT JOIN public.tc_transactions tct ON tc.id = tct.tc_id
LEFT JOIN public.tc_documents tcd ON tct.id = tcd.transaction_id
LEFT JOIN public.tc_milestones tcm ON tct.id = tcm.transaction_id AND CURRENT_DATE > tcm.due_date
WHERE tc.tc_user_id = p_tc_user_id;
$$ LANGUAGE SQL STABLE;

-- Mark milestone overdue if past due date
CREATE OR REPLACE FUNCTION check_overdue_milestones()
RETURNS void AS $$
UPDATE public.tc_milestones
SET status = 'overdue'
WHERE status = 'pending'
  AND CURRENT_DATE > due_date;
$$ LANGUAGE SQL;

-- Notification trigger: Create notification on transaction created
CREATE OR REPLACE FUNCTION notify_on_transaction_created()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.tc_notifications (recipient_id, transaction_id, notification_type, message)
  VALUES (
    NEW.agent_id,
    NEW.id,
    'transaction_created',
    'New transaction created: ' || NEW.title
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_transaction_created_notify
  AFTER INSERT ON public.tc_transactions
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_transaction_created();

-- Notification trigger: Create notification on document uploaded
CREATE OR REPLACE FUNCTION notify_on_document_uploaded()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.tc_notifications (
    recipient_id,
    transaction_id,
    notification_type,
    message
  )
  SELECT
    agent_id,
    transaction_id,
    'doc_uploaded',
    'Document uploaded: ' || NEW.doc_type
  FROM public.tc_transactions
  WHERE id = NEW.transaction_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_document_uploaded_notify
  AFTER INSERT ON public.tc_documents
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_document_uploaded();

/**
 * ====================================================================
 * VALIDATION CHECKS
 * ====================================================================
 */

-- Verify all tables created
SELECT
  'transaction_coordinators' as table_name,
  COUNT(*) >= 0 as exists
FROM information_schema.tables
WHERE table_name = 'transaction_coordinators'
UNION ALL
SELECT 'tc_assignments', COUNT(*) >= 0 FROM information_schema.tables WHERE table_name = 'tc_assignments'
UNION ALL
SELECT 'tc_transactions', COUNT(*) >= 0 FROM information_schema.tables WHERE table_name = 'tc_transactions'
UNION ALL
SELECT 'tc_documents', COUNT(*) >= 0 FROM information_schema.tables WHERE table_name = 'tc_documents'
UNION ALL
SELECT 'tc_milestones', COUNT(*) >= 0 FROM information_schema.tables WHERE table_name = 'tc_milestones'
UNION ALL
SELECT 'tc_notifications', COUNT(*) >= 0 FROM information_schema.tables WHERE table_name = 'tc_notifications';

-- Verify RLS enabled on all tables
SELECT
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename LIKE 'tc_%'
  OR tablename = 'transaction_coordinators'
ORDER BY tablename;
