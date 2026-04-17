-- ============================================================================
-- Migration 016: Referral System
-- Implements referral sources, payouts, and leaderboard tracking
-- ============================================================================

-- 1. Create Referral Sources Table
CREATE TABLE IF NOT EXISTS public.referral_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id UUID NOT NULL REFERENCES public.brokers(id) ON DELETE CASCADE,

  -- Source information
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('agent', 'broker', 'past_client', 'other')),

  -- Contact information
  contact_info JSONB DEFAULT '{}'::jsonb,
  contact_person VARCHAR(255),
  contact_email VARCHAR(255),
  contact_phone VARCHAR(20),

  -- Commission configuration
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 0.00 CHECK (commission_rate >= 0 AND commission_rate <= 100),
  active BOOLEAN DEFAULT TRUE,

  -- Tracking
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_sources_broker_id ON public.referral_sources(broker_id);
CREATE INDEX IF NOT EXISTS idx_referral_sources_active ON public.referral_sources(active);
CREATE INDEX IF NOT EXISTS idx_referral_sources_type ON public.referral_sources(type);

ALTER TABLE public.referral_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY referral_sources_select ON public.referral_sources
  FOR SELECT
  USING (
    broker_id = (SELECT broker_id FROM public.user_profiles WHERE id = auth.uid())
    OR (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'broker'
  );

CREATE POLICY referral_sources_insert ON public.referral_sources
  FOR INSERT
  WITH CHECK (
    broker_id = (SELECT broker_id FROM public.user_profiles WHERE id = auth.uid())
    AND (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'broker'
  );

CREATE POLICY referral_sources_update ON public.referral_sources
  FOR UPDATE
  USING (
    broker_id = (SELECT broker_id FROM public.user_profiles WHERE id = auth.uid())
    AND (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'broker'
  );

-- 2. Create Referral Relationships Table (links transactions to referral sources)
CREATE TABLE IF NOT EXISTS public.referral_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id UUID NOT NULL REFERENCES public.brokers(id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES public.tc_transactions(id) ON DELETE CASCADE,
  referral_source_id UUID NOT NULL REFERENCES public.referral_sources(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Commission details
  referral_commission NUMERIC(15,2) NOT NULL DEFAULT 0,
  commission_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,

  -- Status tracking
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'disputed')),
  paid_date TIMESTAMP WITH TIME ZONE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_rels_transaction_id ON public.referral_relationships(transaction_id);
CREATE INDEX IF NOT EXISTS idx_referral_rels_referral_source_id ON public.referral_relationships(referral_source_id);
CREATE INDEX IF NOT EXISTS idx_referral_rels_broker_id ON public.referral_relationships(broker_id);
CREATE INDEX IF NOT EXISTS idx_referral_rels_status ON public.referral_relationships(status);
CREATE INDEX IF NOT EXISTS idx_referral_rels_paid_date ON public.referral_relationships(paid_date DESC);

ALTER TABLE public.referral_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY referral_rels_select ON public.referral_relationships
  FOR SELECT
  USING (
    broker_id = (SELECT broker_id FROM public.user_profiles WHERE id = auth.uid())
    OR (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'broker'
  );

CREATE POLICY referral_rels_insert ON public.referral_relationships
  FOR INSERT
  WITH CHECK (
    broker_id = (SELECT broker_id FROM public.user_profiles WHERE id = auth.uid())
    AND (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'broker'
  );

CREATE POLICY referral_rels_update ON public.referral_relationships
  FOR UPDATE
  USING (
    broker_id = (SELECT broker_id FROM public.user_profiles WHERE id = auth.uid())
    AND (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'broker'
  );

-- 3. Create Referral Payouts Table
CREATE TABLE IF NOT EXISTS public.referral_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id UUID NOT NULL REFERENCES public.brokers(id) ON DELETE CASCADE,
  referral_source_id UUID NOT NULL REFERENCES public.referral_sources(id) ON DELETE CASCADE,

  -- Period information
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Payout metrics
  total_referrals INTEGER DEFAULT 0,
  total_commission NUMERIC(15,2) NOT NULL DEFAULT 0,

  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid')),
  paid_date TIMESTAMP WITH TIME ZONE,

  -- Notes
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_payouts_broker_id ON public.referral_payouts(broker_id);
CREATE INDEX IF NOT EXISTS idx_referral_payouts_referral_source_id ON public.referral_payouts(referral_source_id);
CREATE INDEX IF NOT EXISTS idx_referral_payouts_period_start ON public.referral_payouts(period_start DESC);
CREATE INDEX IF NOT EXISTS idx_referral_payouts_status ON public.referral_payouts(status);

ALTER TABLE public.referral_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY referral_payouts_select ON public.referral_payouts
  FOR SELECT
  USING (
    broker_id = (SELECT broker_id FROM public.user_profiles WHERE id = auth.uid())
    OR (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'broker'
  );

CREATE POLICY referral_payouts_insert ON public.referral_payouts
  FOR INSERT
  WITH CHECK (
    broker_id = (SELECT broker_id FROM public.user_profiles WHERE id = auth.uid())
    AND (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'broker'
  );

CREATE POLICY referral_payouts_update ON public.referral_payouts
  FOR UPDATE
  USING (
    broker_id = (SELECT broker_id FROM public.user_profiles WHERE id = auth.uid())
    AND (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'broker'
  );

-- 4. Create Referral Leaderboard Snapshot Table
CREATE TABLE IF NOT EXISTS public.referral_leaderboard_snapshot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id UUID NOT NULL REFERENCES public.brokers(id) ON DELETE CASCADE,
  period VARCHAR(50) NOT NULL,
  snapshot_date DATE NOT NULL,

  -- Ranking information
  rank INTEGER NOT NULL,
  referral_source_id UUID NOT NULL REFERENCES public.referral_sources(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  commission_earned NUMERIC(15,2) NOT NULL DEFAULT 0,
  referrals_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_broker_id ON public.referral_leaderboard_snapshot(broker_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_period ON public.referral_leaderboard_snapshot(period);
CREATE INDEX IF NOT EXISTS idx_leaderboard_snapshot_date ON public.referral_leaderboard_snapshot(snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_referral_source_id ON public.referral_leaderboard_snapshot(referral_source_id);

ALTER TABLE public.referral_leaderboard_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY leaderboard_select ON public.referral_leaderboard_snapshot
  FOR SELECT
  USING (
    broker_id = (SELECT broker_id FROM public.user_profiles WHERE id = auth.uid())
    OR (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'broker'
  );

-- ============================================================================
-- FUNCTIONS FOR REFERRAL CALCULATIONS
-- ============================================================================

-- Function to calculate referral commission
CREATE OR REPLACE FUNCTION calculate_referral_commission(
  transaction_value NUMERIC,
  commission_rate NUMERIC
)
RETURNS NUMERIC AS $$
BEGIN
  RETURN ROUND((transaction_value * commission_rate) / 100, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to generate leaderboard snapshots
CREATE OR REPLACE FUNCTION generate_referral_leaderboard_snapshot(broker_id_param UUID, period_param VARCHAR)
RETURNS void AS $$
DECLARE
  snapshot_date DATE := CURRENT_DATE;
  source_record RECORD;
  rank_counter INTEGER := 1;
BEGIN
  -- Delete old snapshots for this period if they exist
  DELETE FROM public.referral_leaderboard_snapshot
  WHERE broker_id = broker_id_param AND period = period_param AND snapshot_date = snapshot_date;

  -- Generate new ranking
  FOR source_record IN
    SELECT
      rs.id,
      rs.name,
      COALESCE(SUM(rr.referral_commission), 0)::NUMERIC AS total_commission,
      COUNT(rr.id)::INTEGER AS referral_count
    FROM public.referral_sources rs
    LEFT JOIN public.referral_relationships rr ON rs.id = rr.referral_source_id
      AND rr.status IN ('approved', 'paid')
      AND EXTRACT(YEAR FROM rr.created_at) = EXTRACT(YEAR FROM NOW())
      AND (
        CASE
          WHEN period_param = 'monthly' THEN EXTRACT(MONTH FROM rr.created_at) = EXTRACT(MONTH FROM NOW())
          WHEN period_param = 'quarterly' THEN EXTRACT(QUARTER FROM rr.created_at) = EXTRACT(QUARTER FROM NOW())
          WHEN period_param = 'yearly' THEN TRUE
          ELSE FALSE
        END
      )
    WHERE rs.broker_id = broker_id_param AND rs.active = TRUE
    GROUP BY rs.id, rs.name
    ORDER BY total_commission DESC
  LOOP
    INSERT INTO public.referral_leaderboard_snapshot (
      broker_id, period, snapshot_date, rank, referral_source_id, name, commission_earned, referrals_count
    )
    VALUES (
      broker_id_param,
      period_param,
      snapshot_date,
      rank_counter,
      source_record.id,
      source_record.name,
      source_record.total_commission,
      source_record.referral_count
    );

    rank_counter := rank_counter + 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON public.referral_sources TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.referral_relationships TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.referral_payouts TO authenticated;
GRANT SELECT ON public.referral_leaderboard_snapshot TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_referral_commission TO authenticated;
GRANT EXECUTE ON FUNCTION generate_referral_leaderboard_snapshot TO authenticated;
