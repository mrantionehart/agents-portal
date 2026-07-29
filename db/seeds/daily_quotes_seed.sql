-- ============================================================================
-- From The Hart — seed 365 daily quotes
-- ============================================================================
-- Run AFTER db/migrations/20260728_daily_quotes.sql. Fills every day_of_year
-- (1–365) with an active quote by cycling a set of placeholder lines, then pins
-- a few specific days. Placeholder copy is intentional and easy to replace later
-- (UPDATE daily_quotes SET quote = '…' WHERE day_of_year = N).
--
-- Idempotent: clears and re-seeds.
-- ============================================================================

TRUNCATE daily_quotes RESTART IDENTITY;

INSERT INTO daily_quotes (quote, author, day_of_year, active)
SELECT
  (ARRAY[
    'The agent who follows up wins.',
    'Every choice you make for a client compounds.',
    'Serve first. The commission follows.',
    'Return the call before lunch.',
    'A prepared agent is a calm agent.',
    'Know the building better than anyone in the room.',
    'Small promises kept build big reputations.',
    'The best listing is the client you never lost touch with.',
    'Clarity closes. Confusion stalls.',
    'Do the boring follow-up. That is the whole job.',
    'Your calendar tells your clients what you value.',
    'Be the reason someone trusts real estate again.',
    'Ask one more question before you assume.',
    'Consistency beats intensity every single week.'
  ])[1 + (gs % 14)],
  'Tony Hart',
  gs,
  true
FROM generate_series(1, 365) AS gs;

-- Pinned days (real copy overrides the cycled placeholder above).
UPDATE daily_quotes SET quote = 'The agent who follows up wins.'                         WHERE day_of_year = 209; -- Jul 28
UPDATE daily_quotes SET quote = 'A new year is 365 new chances to be someone''s advocate.' WHERE day_of_year = 1;   -- Jan 1

-- Sanity check (should return 365):
-- SELECT count(*) FROM daily_quotes;
