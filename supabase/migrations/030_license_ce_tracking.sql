-- ============================================================================
-- 030_license_ce_tracking.sql
-- License Expiration Tracking & Continuing Education (CE) System
-- ============================================================================
-- Adds license expiration dates, state, CE hour tracking to profiles.
-- Creates a license_notifications log for audit trail.
-- Enables automated alerts at 60 / 30 / 7 day thresholds.
-- ============================================================================

-- ─── 1. Add license & CE columns to profiles ──────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS license_state         TEXT DEFAULT 'FL',
  ADD COLUMN IF NOT EXISTS license_expiration_date DATE,
  ADD COLUMN IF NOT EXISTS ce_hours_required     NUMERIC(5,1) DEFAULT 14.0,
  ADD COLUMN IF NOT EXISTS ce_hours_completed    NUMERIC(5,1) DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS ce_renewal_date       DATE,
  ADD COLUMN IF NOT EXISTS license_status        TEXT DEFAULT 'unknown'
    CHECK (license_status IN ('active','expiring_soon','expired','suspended','unknown'));

COMMENT ON COLUMN public.profiles.license_state IS 'Two-letter state code for license jurisdiction (default FL)';
COMMENT ON COLUMN public.profiles.license_expiration_date IS 'Date the agent real estate license expires';
COMMENT ON COLUMN public.profiles.ce_hours_required IS 'Total CE hours required for renewal cycle (FL default 14)';
COMMENT ON COLUMN public.profiles.ce_hours_completed IS 'CE hours agent has completed in current cycle';
COMMENT ON COLUMN public.profiles.ce_renewal_date IS 'Deadline for completing CE hours';
COMMENT ON COLUMN public.profiles.license_status IS 'Computed status: active, expiring_soon, expired, suspended, unknown';

-- ─── 2. License notification log ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.license_notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL
    CHECK (notification_type IN (
      'license_expiring_60',
      'license_expiring_30',
      'license_expiring_7',
      'license_expired',
      'ce_incomplete_60',
      'ce_incomplete_30',
      'ce_incomplete_7',
      'ce_completed',
      'license_renewed'
    )),
  title           TEXT NOT NULL,
  message         TEXT NOT NULL,
  days_remaining  INTEGER,
  email_sent      BOOLEAN DEFAULT FALSE,
  push_sent       BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_license_notifications_agent
  ON public.license_notifications(agent_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_license_notifications_type
  ON public.license_notifications(notification_type, created_at DESC);

-- ─── 3. RLS policies ─────────────────────────────────────────────────────

ALTER TABLE public.license_notifications ENABLE ROW LEVEL SECURITY;

-- Agents can read their own license notifications
CREATE POLICY license_notif_select_own ON public.license_notifications
  FOR SELECT TO authenticated
  USING (agent_id = auth.uid());

-- Brokers/admins can read all license notifications for their agents
CREATE POLICY license_notif_select_broker ON public.license_notifications
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'broker')
    )
  );

-- Service role inserts (API-driven)
CREATE POLICY license_notif_insert_service ON public.license_notifications
  FOR INSERT TO authenticated
  WITH CHECK (TRUE);

-- ─── 4. Index for fast license expiration queries ─────────────────────────

CREATE INDEX IF NOT EXISTS idx_profiles_license_expiration
  ON public.profiles(license_expiration_date)
  WHERE license_expiration_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_ce_renewal
  ON public.profiles(ce_renewal_date)
  WHERE ce_renewal_date IS NOT NULL;

-- ─── 5. Helper view: agents with expiring licenses ────────────────────────

CREATE OR REPLACE VIEW public.v_expiring_licenses AS
SELECT
  p.id AS agent_id,
  p.full_name,
  p.email,
  p.license_number,
  p.license_state,
  p.license_expiration_date,
  p.license_status,
  p.ce_hours_required,
  p.ce_hours_completed,
  p.ce_renewal_date,
  p.broker_id,
  (p.license_expiration_date - CURRENT_DATE) AS days_until_expiration,
  CASE
    WHEN p.ce_hours_required > 0
    THEN ROUND((p.ce_hours_completed / p.ce_hours_required) * 100, 1)
    ELSE 100
  END AS ce_completion_pct
FROM public.profiles p
WHERE p.role IN ('agent', 'admin')
  AND p.license_expiration_date IS NOT NULL
ORDER BY p.license_expiration_date ASC;

-- Grant access to the view
GRANT SELECT ON public.v_expiring_licenses TO authenticated;

-- ============================================================================
-- Done. Run via: psql $DATABASE_URL -f 030_license_ce_tracking.sql
-- Or apply through Supabase dashboard SQL editor.
-- ============================================================================
