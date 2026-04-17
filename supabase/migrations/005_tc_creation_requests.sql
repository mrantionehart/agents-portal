-- Migration: TC Creation Requests
-- Purpose: Allow agents to request new TCs with details
-- Status: Production-ready

/**
 * ====================================================================
 * TABLE: tc_creation_requests
 * ====================================================================
 * Stores requests from agents to create new Transaction Coordinators
 */
CREATE TABLE public.tc_creation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  broker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tc_name TEXT NOT NULL,
  tc_email TEXT NOT NULL,
  commission_split NUMERIC(5,2) NOT NULL CHECK (commission_split >= 0 AND commission_split <= 100),
  status TEXT NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('pending_approval', 'approved', 'denied')),
  created_tc_id UUID REFERENCES public.transaction_coordinators(id) ON DELETE SET NULL,
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  denial_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_tc_creation_requests_agent_id ON public.tc_creation_requests(agent_id);
CREATE INDEX idx_tc_creation_requests_broker_id ON public.tc_creation_requests(broker_id);
CREATE INDEX idx_tc_creation_requests_status ON public.tc_creation_requests(status);
CREATE INDEX idx_tc_creation_requests_created_tc_id ON public.tc_creation_requests(created_tc_id);

ALTER TABLE public.tc_creation_requests ENABLE ROW LEVEL SECURITY;

-- Agents can view and create their own requests, brokers can view all their agent's requests
CREATE POLICY tc_creation_requests_select ON public.tc_creation_requests
  FOR SELECT
  USING (
    agent_id = auth.uid()
    OR (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'broker'
  );

CREATE POLICY tc_creation_requests_insert ON public.tc_creation_requests
  FOR INSERT
  WITH CHECK (agent_id = auth.uid());

-- Only brokers can update (approve/deny)
CREATE POLICY tc_creation_requests_update ON public.tc_creation_requests
  FOR UPDATE
  USING ((SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'broker');

/**
 * ====================================================================
 * AUTO-TIMESTAMP FUNCTION
 * ====================================================================
 */
CREATE OR REPLACE FUNCTION update_tc_creation_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tc_creation_requests_updated_at_trigger
BEFORE UPDATE ON public.tc_creation_requests
FOR EACH ROW
EXECUTE FUNCTION update_tc_creation_requests_updated_at();
