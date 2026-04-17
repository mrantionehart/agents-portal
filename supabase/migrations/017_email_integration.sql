-- ============================================================================
-- Migration 017: Email Integration System
-- Implements email accounts, messages, templates, and tracking
-- ============================================================================

-- 1. Create Email Accounts Table
CREATE TABLE IF NOT EXISTS public.email_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id UUID NOT NULL REFERENCES public.brokers(id) ON DELETE CASCADE,

  -- Account information
  email_address VARCHAR(255) NOT NULL,
  provider VARCHAR(50) NOT NULL CHECK (provider IN ('gmail', 'outlook', 'imap', 'sendgrid')),

  -- Authentication
  auth_token TEXT, -- Will be encrypted at rest in Supabase
  refresh_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,

  -- Sync configuration
  sync_status VARCHAR(50) DEFAULT 'idle' CHECK (sync_status IN ('idle', 'syncing', 'error')),
  last_sync_date TIMESTAMP WITH TIME ZONE,
  sync_error_message TEXT,

  -- Settings
  auto_sync_enabled BOOLEAN DEFAULT TRUE,
  sync_interval_minutes INTEGER DEFAULT 15,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_accounts_broker_id ON public.email_accounts(broker_id);
CREATE INDEX IF NOT EXISTS idx_email_accounts_email_address ON public.email_accounts(email_address);
CREATE INDEX IF NOT EXISTS idx_email_accounts_last_sync ON public.email_accounts(last_sync_date DESC);

ALTER TABLE public.email_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY email_accounts_select ON public.email_accounts
  FOR SELECT
  USING (
    broker_id = (SELECT broker_id FROM public.user_profiles WHERE id = auth.uid())
    AND (SELECT role FROM public.user_profiles WHERE id = auth.uid()) IN ('broker', 'admin')
  );

CREATE POLICY email_accounts_insert ON public.email_accounts
  FOR INSERT
  WITH CHECK (
    broker_id = (SELECT broker_id FROM public.user_profiles WHERE id = auth.uid())
    AND (SELECT role FROM public.user_profiles WHERE id = auth.uid()) IN ('broker', 'admin')
  );

CREATE POLICY email_accounts_update ON public.email_accounts
  FOR UPDATE
  USING (
    broker_id = (SELECT broker_id FROM public.user_profiles WHERE id = auth.uid())
    AND (SELECT role FROM public.user_profiles WHERE id = auth.uid()) IN ('broker', 'admin')
  );

-- 2. Create Email Messages Table
CREATE TABLE IF NOT EXISTS public.email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_account_id UUID NOT NULL REFERENCES public.email_accounts(id) ON DELETE CASCADE,

  -- Provider information
  message_id VARCHAR(500) UNIQUE, -- Provider's message ID
  thread_id VARCHAR(500),

  -- Email content (encrypted)
  from_email VARCHAR(255) NOT NULL,
  to_email VARCHAR(255) NOT NULL,
  cc_emails VARCHAR(2000),
  subject VARCHAR(500),
  body TEXT, -- Encrypted in production
  html_body TEXT,

  -- Message metadata
  read BOOLEAN DEFAULT FALSE,
  archived BOOLEAN DEFAULT FALSE,
  starred BOOLEAN DEFAULT FALSE,

  -- Links to transactions (optional)
  transaction_id UUID REFERENCES public.tc_transactions(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,

  -- Message state
  direction VARCHAR(20) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  received_date TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_messages_account_id ON public.email_messages(email_account_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_thread_id ON public.email_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_from ON public.email_messages(from_email);
CREATE INDEX IF NOT EXISTS idx_email_messages_to ON public.email_messages(to_email);
CREATE INDEX IF NOT EXISTS idx_email_messages_received_date ON public.email_messages(received_date DESC);
CREATE INDEX IF NOT EXISTS idx_email_messages_transaction_id ON public.email_messages(transaction_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_lead_id ON public.email_messages(lead_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_read ON public.email_messages(read);

ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY email_messages_select ON public.email_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.email_accounts
      WHERE email_accounts.id = email_messages.email_account_id
      AND broker_id = (SELECT broker_id FROM public.user_profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY email_messages_insert ON public.email_messages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.email_accounts
      WHERE email_accounts.id = email_messages.email_account_id
      AND broker_id = (SELECT broker_id FROM public.user_profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY email_messages_update ON public.email_messages
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.email_accounts
      WHERE email_accounts.id = email_messages.email_account_id
      AND broker_id = (SELECT broker_id FROM public.user_profiles WHERE id = auth.uid())
    )
  );

-- 3. Create Email Templates Table
CREATE TABLE IF NOT EXISTS public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id UUID NOT NULL REFERENCES public.brokers(id) ON DELETE CASCADE,

  -- Template information
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL CHECK (category IN ('follow_up', 'listing', 'offer', 'closing', 'inquiry', 'general')),
  description TEXT,

  -- Template content with {{variable}} placeholders
  subject VARCHAR(500) NOT NULL,
  body TEXT NOT NULL,

  -- Settings
  is_active BOOLEAN DEFAULT TRUE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_templates_broker_id ON public.email_templates(broker_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_category ON public.email_templates(category);
CREATE INDEX IF NOT EXISTS idx_email_templates_is_active ON public.email_templates(is_active);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY email_templates_select ON public.email_templates
  FOR SELECT
  USING (
    broker_id = (SELECT broker_id FROM public.user_profiles WHERE id = auth.uid())
    OR (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'broker'
  );

CREATE POLICY email_templates_insert ON public.email_templates
  FOR INSERT
  WITH CHECK (
    broker_id = (SELECT broker_id FROM public.user_profiles WHERE id = auth.uid())
    AND (SELECT role FROM public.user_profiles WHERE id = auth.uid()) IN ('broker', 'admin')
  );

CREATE POLICY email_templates_update ON public.email_templates
  FOR UPDATE
  USING (
    broker_id = (SELECT broker_id FROM public.user_profiles WHERE id = auth.uid())
    AND (SELECT role FROM public.user_profiles WHERE id = auth.uid()) IN ('broker', 'admin')
  );

-- 4. Create Email Tracking Table
CREATE TABLE IF NOT EXISTS public.email_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.email_messages(id) ON DELETE CASCADE,
  recipient_email VARCHAR(255) NOT NULL,

  -- Tracking data
  opened BOOLEAN DEFAULT FALSE,
  first_opened_date TIMESTAMP WITH TIME ZONE,
  last_opened_date TIMESTAMP WITH TIME ZONE,
  open_count INTEGER DEFAULT 0,

  -- Link tracking
  click_count INTEGER DEFAULT 0,
  links_clicked JSONB DEFAULT '[]'::jsonb,
  last_click_date TIMESTAMP WITH TIME ZONE,

  -- Status
  sent_date TIMESTAMP WITH TIME ZONE NOT NULL,
  bounced BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_tracking_message_id ON public.email_tracking(message_id);
CREATE INDEX IF NOT EXISTS idx_email_tracking_recipient_email ON public.email_tracking(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_tracking_opened ON public.email_tracking(opened);
CREATE INDEX IF NOT EXISTS idx_email_tracking_sent_date ON public.email_tracking(sent_date DESC);

ALTER TABLE public.email_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY email_tracking_select ON public.email_tracking
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.email_messages em
      JOIN public.email_accounts ea ON em.email_account_id = ea.id
      WHERE em.id = email_tracking.message_id
      AND ea.broker_id = (SELECT broker_id FROM public.user_profiles WHERE id = auth.uid())
    )
  );

-- 5. Create Email Attachments Table
CREATE TABLE IF NOT EXISTS public.email_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.email_messages(id) ON DELETE CASCADE,

  -- File information
  file_name VARCHAR(500) NOT NULL,
  file_size INTEGER,
  file_path VARCHAR(1000),
  mime_type VARCHAR(100),

  -- Storage reference
  storage_bucket VARCHAR(255),
  storage_key VARCHAR(1000),

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_attachments_message_id ON public.email_attachments(message_id);

ALTER TABLE public.email_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY email_attachments_select ON public.email_attachments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.email_messages em
      JOIN public.email_accounts ea ON em.email_account_id = ea.id
      WHERE em.id = email_attachments.message_id
      AND ea.broker_id = (SELECT broker_id FROM public.user_profiles WHERE id = auth.uid())
    )
  );

-- ============================================================================
-- FUNCTIONS FOR EMAIL OPERATIONS
-- ============================================================================

-- Function to substitute template variables
CREATE OR REPLACE FUNCTION substitute_template_variables(
  template_text TEXT,
  variables JSONB
)
RETURNS TEXT AS $$
DECLARE
  result TEXT := template_text;
  key TEXT;
  value TEXT;
BEGIN
  FOR key, value IN
    SELECT k, v ->> 0
    FROM jsonb_each_text(variables) AS t(k, v)
  LOOP
    result := REPLACE(result, '{{' || key || '}}', COALESCE(value, ''));
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to record email open
CREATE OR REPLACE FUNCTION record_email_open(tracking_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.email_tracking
  SET
    opened = TRUE,
    first_opened_date = COALESCE(first_opened_date, NOW()),
    last_opened_date = NOW(),
    open_count = open_count + 1,
    updated_at = NOW()
  WHERE id = tracking_id;
END;
$$ LANGUAGE plpgsql;

-- Function to record email click
CREATE OR REPLACE FUNCTION record_email_click(tracking_id UUID, link_url TEXT)
RETURNS void AS $$
BEGIN
  UPDATE public.email_tracking
  SET
    click_count = click_count + 1,
    last_click_date = NOW(),
    links_clicked = jsonb_insert(
      COALESCE(links_clicked, '[]'::jsonb),
      '{' || jsonb_array_length(COALESCE(links_clicked, '[]'::jsonb)) || '}',
      jsonb_build_object('url', link_url, 'clicked_at', to_jsonb(NOW()))
    ),
    updated_at = NOW()
  WHERE id = tracking_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update email message timestamps
CREATE OR REPLACE FUNCTION update_email_message_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER email_messages_update_timestamp
BEFORE UPDATE ON public.email_messages
FOR EACH ROW
EXECUTE FUNCTION update_email_message_timestamp();

CREATE TRIGGER email_templates_update_timestamp
BEFORE UPDATE ON public.email_templates
FOR EACH ROW
EXECUTE FUNCTION update_email_message_timestamp();

CREATE TRIGGER email_accounts_update_timestamp
BEFORE UPDATE ON public.email_accounts
FOR EACH ROW
EXECUTE FUNCTION update_email_message_timestamp();

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON public.email_accounts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.email_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.email_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.email_tracking TO authenticated;
GRANT SELECT, INSERT ON public.email_attachments TO authenticated;
GRANT EXECUTE ON FUNCTION substitute_template_variables TO authenticated;
GRANT EXECUTE ON FUNCTION record_email_open TO authenticated;
GRANT EXECUTE ON FUNCTION record_email_click TO authenticated;
