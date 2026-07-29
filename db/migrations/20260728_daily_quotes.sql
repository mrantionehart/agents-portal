-- ============================================================================
-- From The Hart — daily_quotes table
-- Migration: 20260728_daily_quotes.sql
-- ============================================================================
-- One motivational quote per day-of-year, shared by everyone. Read-only for the
-- app. Additive columns (category, tags, featured_date, …) can be added later
-- without changing the API, which only ever returns { quote, author }.
--
-- Apply in the Supabase SQL Editor, then run the seed file
-- (db/seeds/daily_quotes_seed.sql).
-- ============================================================================

CREATE TABLE IF NOT EXISTS daily_quotes (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  quote        text NOT NULL,
  author       text NOT NULL DEFAULT 'Tony Hart',
  day_of_year  smallint NOT NULL CHECK (day_of_year BETWEEN 1 AND 366),
  active       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- The read path filters active + day_of_year; one partial index serves it.
CREATE INDEX IF NOT EXISTS idx_daily_quotes_active_day
  ON daily_quotes (day_of_year)
  WHERE active;

-- Read-only for signed-in users; no one writes through the app.
ALTER TABLE daily_quotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS daily_quotes_read ON daily_quotes;
CREATE POLICY daily_quotes_read
  ON daily_quotes FOR SELECT
  TO authenticated
  USING (active);

GRANT SELECT ON daily_quotes TO authenticated;
