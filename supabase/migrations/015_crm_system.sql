-- ============================================================================
-- Migration 015: CRM System
-- Implements leads, contacts, interactions, and lead scoring
-- ============================================================================

-- 1. Create Leads Table
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  broker_id UUID NOT NULL REFERENCES public.brokers(id) ON DELETE CASCADE,

  -- Lead information
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),

  -- Property preferences
  property_type VARCHAR(50) NOT NULL CHECK (property_type IN ('buy', 'sell', 'both')),
  estimated_timeline VARCHAR(100),
  budget_price_range JSONB DEFAULT '{"min": null, "max": null}'::jsonb,

  -- Lead status and scoring
  status VARCHAR(50) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'negotiating', 'closed', 'lost')),
  source VARCHAR(100) NOT NULL,
  lead_score INTEGER DEFAULT 0 CHECK (lead_score >= 0 AND lead_score <= 100),
  temperature VARCHAR(20) NOT NULL DEFAULT 'cold' CHECK (temperature IN ('hot', 'warm', 'cold')),

  -- Notes and metadata
  notes TEXT,
  tags JSONB DEFAULT '[]'::jsonb,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_leads_agent_id ON public.leads(agent_id);
CREATE INDEX IF NOT EXISTS idx_leads_broker_id ON public.leads(broker_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_source ON public.leads(source);
CREATE INDEX IF NOT EXISTS idx_leads_temperature ON public.leads(temperature);
CREATE INDEX IF NOT EXISTS idx_leads_lead_score ON public.leads(lead_score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_deleted_at ON public.leads(deleted_at);
CREATE INDEX IF NOT EXISTS idx_leads_email ON public.leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON public.leads(phone);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Leads
CREATE POLICY leads_select ON public.leads
  FOR SELECT
  USING (
    agent_id = auth.uid()
    OR (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'broker'
  );

CREATE POLICY leads_insert ON public.leads
  FOR INSERT
  WITH CHECK (
    agent_id = auth.uid()
    AND broker_id = (SELECT broker_id FROM public.user_profiles WHERE id = auth.uid())
  );

CREATE POLICY leads_update ON public.leads
  FOR UPDATE
  USING (
    agent_id = auth.uid()
    OR (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'broker'
  );

CREATE POLICY leads_delete ON public.leads
  FOR DELETE
  USING (
    agent_id = auth.uid()
    OR (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'broker'
  );

-- 2. Create Contacts Table
CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id UUID NOT NULL REFERENCES public.brokers(id) ON DELETE CASCADE,

  -- Contact information
  type VARCHAR(50) NOT NULL DEFAULT 'other' CHECK (type IN ('buyer', 'seller', 'other')),
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),

  -- Additional information
  company VARCHAR(255),
  title VARCHAR(255),
  address VARCHAR(500),
  city VARCHAR(100),
  state VARCHAR(2),
  zip VARCHAR(10),

  -- Relationship metrics
  relationship_strength INTEGER DEFAULT 1 CHECK (relationship_strength >= 1 AND relationship_strength <= 5),
  last_contact_date TIMESTAMP WITH TIME ZONE,

  -- Contact history
  contact_history JSONB DEFAULT '[]'::jsonb,
  tags JSONB DEFAULT '[]'::jsonb,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contacts_broker_id ON public.contacts(broker_id);
CREATE INDEX IF NOT EXISTS idx_contacts_type ON public.contacts(type);
CREATE INDEX IF NOT EXISTS idx_contacts_last_contact_date ON public.contacts(last_contact_date DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON public.contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON public.contacts(phone);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY contacts_select ON public.contacts
  FOR SELECT
  USING (
    broker_id = (SELECT broker_id FROM public.user_profiles WHERE id = auth.uid())
    OR (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'broker'
  );

CREATE POLICY contacts_insert ON public.contacts
  FOR INSERT
  WITH CHECK (
    broker_id = (SELECT broker_id FROM public.user_profiles WHERE id = auth.uid())
  );

CREATE POLICY contacts_update ON public.contacts
  FOR UPDATE
  USING (
    broker_id = (SELECT broker_id FROM public.user_profiles WHERE id = auth.uid())
    OR (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'broker'
  );

-- 3. Create Lead Interactions Table
CREATE TABLE IF NOT EXISTS public.lead_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,

  -- Interaction details
  interaction_type VARCHAR(50) NOT NULL CHECK (interaction_type IN ('call', 'email', 'meeting', 'text', 'other')),
  interaction_date TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_minutes INTEGER,

  -- Interaction content
  notes TEXT,
  outcome VARCHAR(50) CHECK (outcome IN ('positive', 'neutral', 'negative')),
  next_followup_date TIMESTAMP WITH TIME ZONE,

  -- Metadata
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_interactions_lead_id ON public.lead_interactions(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_interactions_interaction_date ON public.lead_interactions(interaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_lead_interactions_created_by ON public.lead_interactions(created_by);
CREATE INDEX IF NOT EXISTS idx_lead_interactions_next_followup ON public.lead_interactions(next_followup_date);

ALTER TABLE public.lead_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY lead_interactions_select ON public.lead_interactions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.leads
      WHERE leads.id = lead_interactions.lead_id
      AND (leads.agent_id = auth.uid() OR (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'broker')
    )
  );

CREATE POLICY lead_interactions_insert ON public.lead_interactions
  FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.leads
      WHERE leads.id = lead_interactions.lead_id
      AND (leads.agent_id = auth.uid() OR (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'broker')
    )
  );

-- 4. Create Lead Pipeline Table (for analytics snapshots)
CREATE TABLE IF NOT EXISTS public.lead_pipeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pipeline_date DATE NOT NULL,

  -- Pipeline metrics
  total_leads INTEGER DEFAULT 0,
  by_status JSONB DEFAULT '{"new": 0, "contacted": 0, "qualified": 0, "negotiating": 0, "closed": 0, "lost": 0}'::jsonb,
  total_value NUMERIC(15,2) DEFAULT 0,
  average_deal_value NUMERIC(15,2) DEFAULT 0,
  conversion_rate NUMERIC(5,2) DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_pipeline_agent_id ON public.lead_pipeline(agent_id);
CREATE INDEX IF NOT EXISTS idx_lead_pipeline_date ON public.lead_pipeline(pipeline_date DESC);

ALTER TABLE public.lead_pipeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY lead_pipeline_select ON public.lead_pipeline
  FOR SELECT
  USING (
    agent_id = auth.uid()
    OR (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'broker'
  );

-- 5. Create Lead Sources Table
CREATE TABLE IF NOT EXISTS public.lead_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id UUID NOT NULL REFERENCES public.brokers(id) ON DELETE CASCADE,

  -- Source information
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100) NOT NULL,

  -- Cost metrics
  cost_per_lead NUMERIC(10,2) DEFAULT 0,
  total_cost NUMERIC(15,2) DEFAULT 0,
  leads_generated INTEGER DEFAULT 0,
  conversion_rate NUMERIC(5,2) DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_sources_broker_id ON public.lead_sources(broker_id);
CREATE INDEX IF NOT EXISTS idx_lead_sources_type ON public.lead_sources(type);

ALTER TABLE public.lead_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY lead_sources_select ON public.lead_sources
  FOR SELECT
  USING (
    broker_id = (SELECT broker_id FROM public.user_profiles WHERE id = auth.uid())
    OR (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'broker'
  );

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to update lead score based on interactions
CREATE OR REPLACE FUNCTION calculate_lead_score(lead_id UUID)
RETURNS INTEGER AS $$
DECLARE
  interaction_count INTEGER;
  positive_outcomes INTEGER;
  days_since_contact INTEGER;
  source_quality INTEGER;
  score INTEGER := 0;
BEGIN
  -- Get interaction metrics
  SELECT COUNT(*), COUNT(CASE WHEN outcome = 'positive' THEN 1 END)
  INTO interaction_count, positive_outcomes
  FROM public.lead_interactions
  WHERE lead_interactions.lead_id = calculate_lead_score.lead_id;

  -- Interaction count (max 30 points)
  score := score + LEAST(interaction_count * 5, 30);

  -- Positive outcomes (max 30 points)
  score := score + LEAST(positive_outcomes * 10, 30);

  -- Recency bonus (max 20 points)
  SELECT COALESCE(EXTRACT(DAY FROM NOW() - MAX(interaction_date))::INTEGER, 999)
  INTO days_since_contact
  FROM public.lead_interactions
  WHERE lead_interactions.lead_id = calculate_lead_score.lead_id;

  IF days_since_contact <= 7 THEN
    score := score + 20;
  ELSIF days_since_contact <= 14 THEN
    score := score + 15;
  ELSIF days_since_contact <= 30 THEN
    score := score + 10;
  END IF;

  -- Cap at 100
  RETURN LEAST(score, 100);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to determine lead temperature based on score and activity
CREATE OR REPLACE FUNCTION determine_lead_temperature(lead_id UUID)
RETURNS VARCHAR AS $$
DECLARE
  score INTEGER;
  days_since_contact INTEGER;
  temp VARCHAR;
BEGIN
  score := calculate_lead_score(lead_id);

  SELECT COALESCE(EXTRACT(DAY FROM NOW() - MAX(interaction_date))::INTEGER, 999)
  INTO days_since_contact
  FROM public.lead_interactions
  WHERE lead_interactions.lead_id = determine_lead_temperature.lead_id;

  IF score >= 70 AND days_since_contact <= 14 THEN
    temp := 'hot';
  ELSIF score >= 50 OR days_since_contact <= 30 THEN
    temp := 'warm';
  ELSE
    temp := 'cold';
  END IF;

  RETURN temp;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger to update lead score when interactions are added
CREATE OR REPLACE FUNCTION update_lead_score_on_interaction()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.leads
  SET
    lead_score = calculate_lead_score(NEW.lead_id),
    temperature = determine_lead_temperature(NEW.lead_id),
    updated_at = NOW()
  WHERE id = NEW.lead_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER lead_score_update_trigger
AFTER INSERT ON public.lead_interactions
FOR EACH ROW
EXECUTE FUNCTION update_lead_score_on_interaction();

-- Trigger to update timestamps
CREATE OR REPLACE FUNCTION update_lead_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER leads_update_timestamp
BEFORE UPDATE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION update_lead_timestamp();

CREATE TRIGGER contacts_update_timestamp
BEFORE UPDATE ON public.contacts
FOR EACH ROW
EXECUTE FUNCTION update_lead_timestamp();

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO authenticated;
GRANT SELECT, INSERT ON public.lead_interactions TO authenticated;
GRANT SELECT ON public.lead_pipeline TO authenticated;
GRANT SELECT ON public.lead_sources TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_lead_score TO authenticated;
GRANT EXECUTE ON FUNCTION determine_lead_temperature TO authenticated;
