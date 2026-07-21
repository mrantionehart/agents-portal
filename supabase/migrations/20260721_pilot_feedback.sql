-- ============================================================
-- Migration: pilot_feedback (PILOT-FEEDBACK-001)
-- ============================================================
-- Stores open-ended qualitative feedback from the first Platform
-- Certification pilot cohort. Non-leading questionnaire; per-submission
-- row; user_id nullable in case a session expires between the page load
-- and the submit (the feedback still lands, we just lose attribution).
--
-- Read model: brokers/admins read all rows to review pilot findings.
-- Write model: any authenticated user can insert their own row.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pilot_feedback (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  q1_first_action        TEXT,  -- Without any help, what did you think you were supposed to do first?
  q2_confusing           TEXT,  -- Was anything confusing or unclear?
  q3_stuck               TEXT,  -- Did you get stuck anywhere? If yes, where?
  q4_improve             TEXT,  -- If you could improve one thing, what would it be?
  q5_experience_rating   SMALLINT CHECK (q5_experience_rating BETWEEN 1 AND 10),
  q6_anything_else       TEXT,
  submitted_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pilot_feedback_user_id      ON public.pilot_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_pilot_feedback_submitted_at ON public.pilot_feedback(submitted_at DESC);

-- Row-Level Security
ALTER TABLE public.pilot_feedback ENABLE ROW LEVEL SECURITY;

-- Every authenticated user can insert exactly one thing: a row where
-- user_id = their own auth.uid(). No cross-user writes.
CREATE POLICY pilot_feedback_insert_own
  ON public.pilot_feedback
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Learners can see their own submissions (useful for confirmation UX).
CREATE POLICY pilot_feedback_select_own
  ON public.pilot_feedback
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Brokers + admins see everything (pilot findings review).
CREATE POLICY pilot_feedback_select_broker_admin
  ON public.pilot_feedback
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('broker','admin')
    )
  );

-- Grant the minimum privileges (RLS still enforces per-row access).
GRANT SELECT, INSERT ON public.pilot_feedback TO authenticated;
