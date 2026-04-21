-- ============================================================================
-- Migration 025: CloseIQ — Offer Management System
-- Phase 1 MVP: buyers, offers, risk flags, approvals, offer mode presets
-- ============================================================================

-- 1. Buyers Table
CREATE TABLE IF NOT EXISTS public.buyers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(30),
  preapproval_status VARCHAR(30) DEFAULT 'none' CHECK (preapproval_status IN ('none','pending','approved','expired')),
  preapproval_amount NUMERIC(12,2),
  proof_of_funds_uploaded BOOLEAN DEFAULT FALSE,
  id_verified BOOLEAN DEFAULT FALSE,
  earnest_money_ready BOOLEAN DEFAULT FALSE,
  contingency_preferences JSONB DEFAULT '{}',
  financing_type VARCHAR(30) DEFAULT 'conventional' CHECK (financing_type IN ('conventional','fha','va','cash','usda','other')),
  target_close_window INTEGER, -- days from offer
  readiness_score INTEGER DEFAULT 0 CHECK (readiness_score >= 0 AND readiness_score <= 100),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_buyers_agent ON public.buyers(agent_id);

-- 2. Offers Table
CREATE TABLE IF NOT EXISTS public.offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES public.buyers(id) ON DELETE CASCADE,
  property_address TEXT NOT NULL,
  property_mls_id VARCHAR(30),
  property_list_price NUMERIC(12,2),
  property_city VARCHAR(100),
  property_state VARCHAR(2),
  property_zip VARCHAR(10),
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Offer terms
  offer_mode VARCHAR(40) DEFAULT 'standard',
  offer_price NUMERIC(12,2) NOT NULL,
  financing_type VARCHAR(30) DEFAULT 'conventional',
  down_payment_pct NUMERIC(5,2),
  earnest_money_amount NUMERIC(10,2),
  inspection_days INTEGER DEFAULT 10,
  appraisal_contingency BOOLEAN DEFAULT TRUE,
  financing_contingency BOOLEAN DEFAULT TRUE,
  close_date DATE,
  occupancy_terms TEXT,
  concessions_requested NUMERIC(10,2) DEFAULT 0,
  escalation_flag BOOLEAN DEFAULT FALSE,
  escalation_max NUMERIC(12,2),

  -- AI-generated content
  risk_score INTEGER DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
  strategy_summary TEXT,
  cover_letter_text TEXT,
  cover_letter_subject TEXT,
  cover_letter_sms TEXT,

  -- Status workflow
  status VARCHAR(30) DEFAULT 'draft' CHECK (status IN (
    'draft','pending_approval','approved','submitted','countered',
    'accepted','rejected','withdrawn','expired'
  )),

  -- Metadata
  generated_terms_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_offers_agent ON public.offers(agent_id);
CREATE INDEX idx_offers_buyer ON public.offers(buyer_id);
CREATE INDEX idx_offers_status ON public.offers(status);

-- 3. Offer Documents
CREATE TABLE IF NOT EXISTS public.offer_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  doc_type VARCHAR(40) NOT NULL, -- 'preapproval','pof','purchase_agreement','addendum','disclosure','other'
  file_url TEXT NOT NULL,
  file_name VARCHAR(255),
  uploaded_by UUID REFERENCES auth.users(id),
  status VARCHAR(20) DEFAULT 'uploaded' CHECK (status IN ('uploaded','reviewed','flagged')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_offer_docs_offer ON public.offer_documents(offer_id);

-- 4. Offer Risk Flags
CREATE TABLE IF NOT EXISTS public.offer_risk_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  flag_type VARCHAR(50) NOT NULL, -- 'flood_zone','hoa_risk','missing_disclosure','appraisal_gap','permit_issue', etc.
  severity VARCHAR(10) NOT NULL CHECK (severity IN ('low','moderate','high')),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  recommended_action TEXT,
  resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_risk_flags_offer ON public.offer_risk_flags(offer_id);
CREATE INDEX idx_risk_flags_severity ON public.offer_risk_flags(severity);

-- 5. Offer Approvals (broker workflow)
CREATE TABLE IF NOT EXISTS public.offer_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  broker_id UUID NOT NULL REFERENCES auth.users(id),
  approval_status VARCHAR(20) NOT NULL CHECK (approval_status IN ('pending','approved','revision_requested','rejected','escalated')),
  notes TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_approvals_offer ON public.offer_approvals(offer_id);
CREATE INDEX idx_approvals_broker ON public.offer_approvals(broker_id);
CREATE INDEX idx_approvals_status ON public.offer_approvals(approval_status);

-- 6. Offer Mode Presets (config data)
CREATE TABLE IF NOT EXISTS public.offer_mode_presets (
  id VARCHAR(40) PRIMARY KEY,
  label VARCHAR(100) NOT NULL,
  description TEXT,
  defaults JSONB NOT NULL DEFAULT '{}',
  sort_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed offer mode presets
INSERT INTO public.offer_mode_presets (id, label, description, defaults, sort_order) VALUES
  ('strong', 'Strong Offer', 'Maximum competitiveness — high earnest, short inspection, aggressive close', '{
    "earnest_money_pct": 3, "inspection_days": 7, "financing_contingency": true,
    "appraisal_contingency": false, "concessions": 0, "close_window_days": 21,
    "cover_letter_style": "certainty"
  }', 1),
  ('clean', 'Clean Offer', 'Simple and easy for the seller — minimal contingencies, fast timeline', '{
    "earnest_money_pct": 2, "inspection_days": 10, "financing_contingency": true,
    "appraisal_contingency": true, "concessions": 0, "close_window_days": 30,
    "cover_letter_style": "professional"
  }', 2),
  ('investor', 'Investor Offer', 'Cash or hard money, fast close, as-is condition', '{
    "earnest_money_pct": 5, "inspection_days": 5, "financing_contingency": false,
    "appraisal_contingency": false, "concessions": 0, "close_window_days": 14,
    "cover_letter_style": "business"
  }', 3),
  ('first_time', 'First-Time Buyer', 'Standard protections for new buyers — full contingencies, reasonable timeline', '{
    "earnest_money_pct": 1, "inspection_days": 14, "financing_contingency": true,
    "appraisal_contingency": true, "concessions": 3, "close_window_days": 45,
    "cover_letter_style": "personal"
  }', 4),
  ('escalation', 'Multiple Offer Escalation', 'Escalation clause with cap — for competitive situations', '{
    "earnest_money_pct": 3, "inspection_days": 7, "financing_contingency": true,
    "appraisal_contingency": true, "escalation_flag": true, "concessions": 0,
    "close_window_days": 30, "cover_letter_style": "urgency"
  }', 5),
  ('seller_time', 'Seller Needs Time', 'Flexible closing and leaseback options — for sellers who need extra time', '{
    "earnest_money_pct": 2, "inspection_days": 10, "financing_contingency": true,
    "appraisal_contingency": true, "concessions": 0, "close_window_days": 60,
    "cover_letter_style": "accommodating"
  }', 6),
  ('as_is', 'As-Is Fast Close', 'No inspection, no repairs — speed is the advantage', '{
    "earnest_money_pct": 3, "inspection_days": 0, "financing_contingency": true,
    "appraisal_contingency": false, "concessions": 0, "close_window_days": 21,
    "cover_letter_style": "confidence"
  }', 7)
ON CONFLICT (id) DO NOTHING;

-- 7. RLS Policies
ALTER TABLE public.buyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_risk_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_mode_presets ENABLE ROW LEVEL SECURITY;

-- Agents see their own buyers/offers; brokers see all
CREATE POLICY buyers_agent_policy ON public.buyers
  FOR ALL USING (
    agent_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('broker','admin'))
  );

CREATE POLICY offers_agent_policy ON public.offers
  FOR ALL USING (
    agent_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('broker','admin'))
  );

CREATE POLICY offer_docs_policy ON public.offer_documents
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.offers WHERE offers.id = offer_documents.offer_id AND (
      offers.agent_id = auth.uid() OR
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('broker','admin'))
    ))
  );

CREATE POLICY risk_flags_policy ON public.offer_risk_flags
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.offers WHERE offers.id = offer_risk_flags.offer_id AND (
      offers.agent_id = auth.uid() OR
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('broker','admin'))
    ))
  );

CREATE POLICY approvals_policy ON public.offer_approvals
  FOR ALL USING (
    broker_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.offers WHERE offers.id = offer_approvals.offer_id AND offers.agent_id = auth.uid())
  );

CREATE POLICY presets_read ON public.offer_mode_presets
  FOR SELECT USING (true);

-- 8. Updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER buyers_updated_at BEFORE UPDATE ON public.buyers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER offers_updated_at BEFORE UPDATE ON public.offers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
