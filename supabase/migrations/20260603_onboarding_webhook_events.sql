-- ============================================================================
-- Agent Portal — onboarding webhook idempotency table (Security Sprint 4 — C3)
-- ============================================================================
-- Closes audit finding C3: the onboarding DocuSign webhook validates HMAC
-- signatures correctly but, prior to this change, a previously valid
-- payload could be replayed indefinitely. Each replay re-ran the signed-
-- documents handler, which (a) re-updated the onboarding_invites row,
-- (b) inserted N duplicate rows into public.notifications (one per
-- broker/admin), (c) re-sent N push notifications via Expo, and
-- (d) re-sent N SendGrid emails. All side effects compound per replay.
--
-- This migration creates the idempotency store the webhook will check
-- between signature verification and mutation. The route inserts one
-- row per (envelope_id, event_type, event_time) tuple; PostgreSQL's
-- unique constraint catches replays and the route short-circuits to a
-- 200 OK without running any mutation handler.
--
-- DESIGN NOTES
-- ------------
-- * NULLS NOT DISTINCT is a PostgreSQL 15+ feature that treats NULL
--   values as equal for uniqueness purposes. Without it, two events
--   with envelope_id='X', event_type='Y', event_time=NULL would both
--   be insertable — defeating the replay guard for any payload where
--   DocuSign omits the timestamp. Supabase runs PG 15, so this is
--   available.
-- * received_at captures when WE saw the event (used for forensics and
--   TTL cleanup). Distinct from event_time which is when DocuSign
--   reports the event happened.
-- * payload is jsonb (nullable) so we can keep a forensic snapshot of
--   the raw event without committing to a schema for DocuSign's
--   payload shape. Disk impact is negligible (one row per legitimate
--   onboarding event).
-- * No INSERT/UPDATE/DELETE policies are defined. RLS is enabled with
--   no policies, so only the service-role key (which bypasses RLS) can
--   touch this table. There is no user-facing surface — the webhook
--   handler is the sole writer and reader.
-- * Indexes: the unique constraint creates an implicit btree index on
--   (envelope_id, event_type, event_time), which is the only access
--   path the webhook handler uses. No secondary indexes today.
--
-- IDEMPOTENCY
-- -----------
-- CREATE TABLE IF NOT EXISTS / ALTER TABLE ENABLE RLS / inline UNIQUE
-- constraint. Safe to re-apply against a database that already has the
-- table. Same pattern as 001c_new_leads, 001g_new_leads, R-9, R-8,
-- R-17, R-18, R-19 — all proven safe in production.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.onboarding_webhook_events (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  envelope_id  TEXT        NOT NULL,
  event_type   TEXT        NOT NULL,
  event_time   TIMESTAMPTZ NULL,
  received_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload      JSONB       NULL,

  -- NULLS NOT DISTINCT: treat NULL event_time as equal-for-uniqueness
  -- so replay protection still holds when DocuSign omits the timestamp.
  CONSTRAINT onboarding_webhook_events_dedup_uq
    UNIQUE NULLS NOT DISTINCT (envelope_id, event_type, event_time)
);

ALTER TABLE public.onboarding_webhook_events ENABLE ROW LEVEL SECURITY;

-- No policies. Service-role bypasses RLS; no other role can read or write.
