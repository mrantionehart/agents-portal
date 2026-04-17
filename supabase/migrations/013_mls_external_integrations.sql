-- ============================================================================
-- Migration 013: MLS & External System Integration
-- Implements complete MLS listing management and third-party service integration
-- ============================================================================

-- 1. Create MLS Listings Table
CREATE TABLE IF NOT EXISTS public.mls_listings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    mls_number VARCHAR(50) UNIQUE NOT NULL,
    address VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(2) NOT NULL,
    zip VARCHAR(10) NOT NULL,

    -- Property classification
    listing_type VARCHAR(50) NOT NULL CHECK (listing_type IN ('residential', 'commercial', 'land', 'multi-family')),
    status VARCHAR(50) NOT NULL CHECK (status IN ('active', 'pending', 'sold', 'withdrawn', 'expired')),

    -- Pricing information
    list_price NUMERIC(12,2),
    sold_price NUMERIC(12,2),
    price_per_sqft NUMERIC(10,2),

    -- Dates
    list_date TIMESTAMP,
    sold_date TIMESTAMP,
    days_on_market INTEGER,

    -- Property details as JSONB for flexibility
    property_details JSONB DEFAULT '{}'::jsonb, -- beds, baths, sqft, lot_size, year_built, features, photos_count

    -- Agent information
    listing_agent_info JSONB DEFAULT '{}'::jsonb, -- name, phone, email, brokerage, mls_id
    buyer_agent_info JSONB DEFAULT NULL, -- name, phone, email, brokerage, mls_id

    -- Raw MLS data for archiving
    mls_data_raw JSONB DEFAULT '{}'::jsonb,

    -- Metadata
    last_updated TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),

    -- Indexes for common queries
    created_at DESC
);

CREATE INDEX idx_mls_number ON public.mls_listings(mls_number);
CREATE INDEX idx_mls_address ON public.mls_listings(address, city, state, zip);
CREATE INDEX idx_mls_status ON public.mls_listings(status);
CREATE INDEX idx_mls_list_date ON public.mls_listings(list_date DESC);
CREATE INDEX idx_mls_sold_date ON public.mls_listings(sold_date DESC);
CREATE INDEX idx_mls_list_price ON public.mls_listings(list_price);

-- 2. Create Transaction-MLS Link Table
CREATE TABLE IF NOT EXISTS public.transaction_mls_link (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
    mls_number VARCHAR(50) NOT NULL REFERENCES public.mls_listings(mls_number) ON DELETE CASCADE,

    -- Tracking information
    linked_by uuid NOT NULL REFERENCES public.profiles(id),
    link_date TIMESTAMP DEFAULT NOW(),

    -- Link status
    status VARCHAR(50) NOT NULL DEFAULT 'linked' CHECK (status IN ('linked', 'unlinked', 'auto_matched')),

    -- Which fields were auto-populated from MLS
    auto_populated_fields JSONB DEFAULT '[]'::jsonb,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(transaction_id, mls_number)
);

CREATE INDEX idx_transaction_mls_link_trans ON public.transaction_mls_link(transaction_id);
CREATE INDEX idx_transaction_mls_link_mls ON public.transaction_mls_link(mls_number);
CREATE INDEX idx_transaction_mls_link_status ON public.transaction_mls_link(status);

-- 3. Create Third Party Service Accounts Table
CREATE TABLE IF NOT EXISTS public.third_party_service_accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    broker_id uuid NOT NULL REFERENCES public.brokers(id) ON DELETE CASCADE,

    -- Service type and configuration
    service_type VARCHAR(50) NOT NULL CHECK (service_type IN ('title_company', 'lender', 'inspector', 'appraisal', 'docusign')),
    service_name VARCHAR(255) NOT NULL,

    -- Account information
    account_id VARCHAR(255) NOT NULL,
    api_key TEXT, -- Will be encrypted at rest in Supabase
    endpoint_url VARCHAR(500),

    -- Authentication method
    auth_method VARCHAR(50) DEFAULT 'api_key' CHECK (auth_method IN ('api_key', 'oauth2', 'basic', 'custom')),

    -- Contact information
    contact_person VARCHAR(255),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(20),

    -- Status
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'testing', 'error')),
    last_test_at TIMESTAMP,
    last_error_message TEXT,

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(broker_id, service_type, service_name)
);

CREATE INDEX idx_service_account_broker ON public.third_party_service_accounts(broker_id);
CREATE INDEX idx_service_account_type ON public.third_party_service_accounts(service_type);
CREATE INDEX idx_service_account_status ON public.third_party_service_accounts(status);

-- 4. Create External Service Requests Table
CREATE TABLE IF NOT EXISTS public.external_service_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
    service_account_id uuid NOT NULL REFERENCES public.third_party_service_accounts(id),

    -- Request classification
    service_type VARCHAR(50) NOT NULL,
    request_type VARCHAR(100) NOT NULL, -- title_search, appraisal_order, inspection_schedule, loan_application, etc.

    -- Status tracking
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'in_progress', 'completed', 'failed', 'cancelled')),

    -- External reference
    external_id VARCHAR(255), -- ID in the external system

    -- Request/Response data
    request_data JSONB DEFAULT '{}'::jsonb,
    response_data JSONB DEFAULT NULL,

    -- Important dates
    submitted_date TIMESTAMP,
    completed_date TIMESTAMP,
    due_date TIMESTAMP,

    -- Retry information
    retry_count INTEGER DEFAULT 0,
    last_retry_at TIMESTAMP,

    -- Error handling
    error_message TEXT,

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(transaction_id, service_type, request_type, external_id)
);

CREATE INDEX idx_external_req_trans ON public.external_service_requests(transaction_id);
CREATE INDEX idx_external_req_service ON public.external_service_requests(service_account_id);
CREATE INDEX idx_external_req_status ON public.external_service_requests(status);
CREATE INDEX idx_external_req_submitted ON public.external_service_requests(submitted_date DESC);
CREATE INDEX idx_external_req_due ON public.external_service_requests(due_date);

-- 5. Create Property Valuations Table
CREATE TABLE IF NOT EXISTS public.property_valuations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,

    -- Valuation source
    valuation_type VARCHAR(50) NOT NULL CHECK (valuation_type IN ('appraised_value', 'tax_assessment', 'zillow_estimate', 'comparable_sales', 'manual')),

    -- Valuation details
    valuation_date TIMESTAMP NOT NULL,
    value_amount NUMERIC(12,2) NOT NULL,
    source VARCHAR(255),
    confidence_score NUMERIC(3,2) DEFAULT 0.00, -- 0-1.00 score

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_valuation_trans ON public.property_valuations(transaction_id);
CREATE INDEX idx_valuation_type ON public.property_valuations(valuation_type);
CREATE INDEX idx_valuation_date ON public.property_valuations(valuation_date DESC);

-- 6. Create Comparable Sales Table
CREATE TABLE IF NOT EXISTS public.comparable_sales (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    market_area VARCHAR(255) NOT NULL,

    -- Property information
    property_details JSONB DEFAULT '{}'::jsonb, -- address, beds, baths, sqft, year_built, etc.

    -- Sale information
    sale_date TIMESTAMP,
    sale_price NUMERIC(12,2),
    days_on_market INTEGER,
    price_per_sqft NUMERIC(10,2),

    -- Source
    source VARCHAR(50) NOT NULL CHECK (source IN ('mls_data', 'public_records', 'zillow', 'redfin')),
    source_id VARCHAR(255),

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(source, source_id)
);

CREATE INDEX idx_comparable_market ON public.comparable_sales(market_area);
CREATE INDEX idx_comparable_sale_date ON public.comparable_sales(sale_date DESC);
CREATE INDEX idx_comparable_price ON public.comparable_sales(sale_price);

-- 7. Create Market Data Snapshot Table
CREATE TABLE IF NOT EXISTS public.market_data_snapshot (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    market_area VARCHAR(255) NOT NULL,
    snapshot_date TIMESTAMP NOT NULL,

    -- Market metrics
    market_metrics JSONB DEFAULT '{}'::jsonb, -- avg_days_on_market, median_price, price_per_sqft, inventory_count, price_trend, etc.

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(market_area, snapshot_date)
);

CREATE INDEX idx_market_snapshot_area ON public.market_data_snapshot(market_area);
CREATE INDEX idx_market_snapshot_date ON public.market_data_snapshot(snapshot_date DESC);

-- 8. Create Integration Logs Table
CREATE TABLE IF NOT EXISTS public.integration_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- What was being processed
    service_type VARCHAR(50) NOT NULL,
    action VARCHAR(100) NOT NULL, -- sync, submit, retrieve, test, etc.

    -- Status
    status VARCHAR(50) NOT NULL CHECK (status IN ('success', 'failed', 'retry', 'partial')),

    -- Request and response
    request JSONB DEFAULT NULL,
    response JSONB DEFAULT NULL,

    -- Error information
    error_message TEXT,

    -- Retry information
    retry_count INTEGER DEFAULT 0,
    next_retry_at TIMESTAMP,

    -- Reference to related record
    transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
    service_account_id uuid REFERENCES public.third_party_service_accounts(id) ON DELETE SET NULL,

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_integration_log_service ON public.integration_logs(service_type);
CREATE INDEX idx_integration_log_status ON public.integration_logs(status);
CREATE INDEX idx_integration_log_created ON public.integration_logs(created_at DESC);
CREATE INDEX idx_integration_log_trans ON public.integration_logs(transaction_id);

-- ============================================================================
-- RLS Policies
-- ============================================================================

-- Enable RLS
ALTER TABLE public.mls_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_mls_link ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.third_party_service_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_valuations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comparable_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_data_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_logs ENABLE ROW LEVEL SECURITY;

-- MLS Listings: Agents can view, brokers can manage
CREATE POLICY "agents_view_mls_listings" ON public.mls_listings
    FOR SELECT TO authenticated
    USING (true); -- Public market data

CREATE POLICY "brokers_manage_mls_listings" ON public.mls_listings
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('broker', 'admin')
        )
    );

-- Transaction MLS Link: Visible to transaction participants
CREATE POLICY "view_transaction_mls_link" ON public.transaction_mls_link
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.transactions
            WHERE transactions.id = transaction_mls_link.transaction_id
            AND (transactions.agent_id = auth.uid() OR transactions.broker_id = auth.uid())
        )
    );

-- Third Party Service Accounts: Brokers only
CREATE POLICY "brokers_manage_service_accounts" ON public.third_party_service_accounts
    FOR ALL TO authenticated
    USING (
        broker_id IN (
            SELECT brokers.id FROM public.brokers
            WHERE brokers.admin_id = auth.uid()
        )
    );

-- External Service Requests: Visible to transaction participants and service providers
CREATE POLICY "view_external_requests" ON public.external_service_requests
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.transactions
            WHERE transactions.id = external_service_requests.transaction_id
            AND (transactions.agent_id = auth.uid() OR transactions.broker_id = auth.uid())
        )
    );

-- Property Valuations: Visible to transaction participants
CREATE POLICY "view_property_valuations" ON public.property_valuations
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.transactions
            WHERE transactions.id = property_valuations.transaction_id
            AND (transactions.agent_id = auth.uid() OR transactions.broker_id = auth.uid())
        )
    );

-- Market Data: Public read access
CREATE POLICY "public_view_market_data" ON public.market_data_snapshot
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "public_view_comparables" ON public.comparable_sales
    FOR SELECT TO authenticated
    USING (true);

-- Integration Logs: Admins only
CREATE POLICY "admins_view_integration_logs" ON public.integration_logs
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- ============================================================================
-- Triggers for Automatic Updates
-- ============================================================================

-- Auto-update transaction fields when MLS is linked
CREATE OR REPLACE FUNCTION auto_populate_from_mls()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'linked' THEN
        UPDATE public.transactions
        SET
            address = (SELECT address FROM public.mls_listings WHERE mls_number = NEW.mls_number),
            updated_at = NOW()
        WHERE id = NEW.transaction_id;

        -- Track which fields were auto-populated
        NEW.auto_populated_fields = '["address", "property_details"]'::jsonb;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_populate_mls
BEFORE INSERT OR UPDATE ON public.transaction_mls_link
FOR EACH ROW
EXECUTE FUNCTION auto_populate_from_mls();

-- Update MLS listing status and last_updated
CREATE OR REPLACE FUNCTION update_mls_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_mls_timestamp
BEFORE UPDATE ON public.mls_listings
FOR EACH ROW
EXECUTE FUNCTION update_mls_timestamp();

-- Create activity log entries for service requests
CREATE OR REPLACE FUNCTION log_service_request_activity()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.activity_logs (
        transaction_id,
        action_type,
        action_description,
        performed_by,
        metadata
    )
    VALUES (
        NEW.transaction_id,
        'service_request_' || NEW.status,
        'Service request (' || NEW.service_type || ') ' || NEW.status,
        auth.uid(),
        jsonb_build_object('service_type', NEW.service_type, 'external_id', NEW.external_id)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_service_request_activity
AFTER INSERT OR UPDATE ON public.external_service_requests
FOR EACH ROW
EXECUTE FUNCTION log_service_request_activity();

-- ============================================================================
-- Utility Functions
-- ============================================================================

-- Get market analysis for an area
CREATE OR REPLACE FUNCTION get_market_analysis(p_market_area VARCHAR)
RETURNS TABLE (
    median_price NUMERIC,
    avg_days_on_market INTEGER,
    inventory_count INTEGER,
    price_trend VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        (market_metrics->>'median_price')::NUMERIC as median_price,
        (market_metrics->>'avg_days_on_market')::INTEGER as avg_days_on_market,
        (market_metrics->>'inventory_count')::INTEGER as inventory_count,
        market_metrics->>'price_trend' as price_trend
    FROM public.market_data_snapshot
    WHERE market_area = p_market_area
    ORDER BY snapshot_date DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Find comparable sales
CREATE OR REPLACE FUNCTION find_comparable_sales(
    p_market_area VARCHAR,
    p_beds INTEGER DEFAULT NULL,
    p_baths INTEGER DEFAULT NULL,
    p_sqft INTEGER DEFAULT NULL,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    comparable_id uuid,
    address VARCHAR,
    sale_price NUMERIC,
    sale_date TIMESTAMP,
    beds INTEGER,
    baths INTEGER,
    sqft INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        cs.id,
        cs.property_details->>'address',
        cs.sale_price,
        cs.sale_date,
        (cs.property_details->>'beds')::INTEGER,
        (cs.property_details->>'baths')::INTEGER,
        (cs.property_details->>'sqft')::INTEGER
    FROM public.comparable_sales cs
    WHERE cs.market_area = p_market_area
    AND (p_beds IS NULL OR (cs.property_details->>'beds')::INTEGER = p_beds)
    AND (p_baths IS NULL OR (cs.property_details->>'baths')::INTEGER = p_baths)
    AND (p_sqft IS NULL OR
         (cs.property_details->>'sqft')::INTEGER BETWEEN (p_sqft * 0.9)::INTEGER AND (p_sqft * 1.1)::INTEGER)
    ORDER BY cs.sale_date DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Auto-retry failed integration requests
CREATE OR REPLACE FUNCTION retry_failed_integrations()
RETURNS TABLE (
    request_id uuid,
    transaction_id uuid,
    service_type VARCHAR,
    retry_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    UPDATE public.external_service_requests
    SET
        status = 'pending',
        retry_count = retry_count + 1,
        last_retry_at = NOW(),
        next_retry_at = NOW() + interval '5 minutes'
    WHERE status = 'failed'
    AND retry_count < 3
    AND (next_retry_at IS NULL OR next_retry_at <= NOW())
    RETURNING id, transaction_id, service_type, retry_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Grant permissions
-- ============================================================================

GRANT SELECT ON public.mls_listings TO anon, authenticated;
GRANT SELECT ON public.comparable_sales TO anon, authenticated;
GRANT SELECT ON public.market_data_snapshot TO anon, authenticated;
GRANT SELECT ON public.transaction_mls_link TO authenticated;
GRANT SELECT ON public.property_valuations TO authenticated;
GRANT SELECT ON public.external_service_requests TO authenticated;
GRANT SELECT ON public.third_party_service_accounts TO authenticated;
GRANT SELECT ON public.integration_logs TO authenticated;

-- Service role has full access
GRANT ALL ON public.mls_listings TO service_role;
GRANT ALL ON public.transaction_mls_link TO service_role;
GRANT ALL ON public.third_party_service_accounts TO service_role;
GRANT ALL ON public.external_service_requests TO service_role;
GRANT ALL ON public.property_valuations TO service_role;
GRANT ALL ON public.comparable_sales TO service_role;
GRANT ALL ON public.market_data_snapshot TO service_role;
GRANT ALL ON public.integration_logs TO service_role;
