-- Migration 020: Training Progress & Module Completion Tracking
-- Shared between Ease App (mobile) and Agents Portal (web)
-- Stores quiz scores, module completions, and certification data

-- ============================================================
-- 1. training_progress — per-user, per-volume progress
-- ============================================================
CREATE TABLE IF NOT EXISTS public.training_progress (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  volume        TEXT NOT NULL,                        -- 'volume-1', 'volume-2', 'volume-3'
  module        SMALLINT NOT NULL DEFAULT 0,          -- last active module number
  completed_modules INTEGER[] NOT NULL DEFAULT '{}',  -- array of completed module numbers
  test_scores   JSONB NOT NULL DEFAULT '{}',          -- { "module-1": 93, "module-2": 80, ... }
  volume_completed  BOOLEAN NOT NULL DEFAULT FALSE,
  final_exam_score  INTEGER,
  certification_date TEXT,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, volume)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_training_progress_user_id ON public.training_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_training_progress_volume  ON public.training_progress(volume);

-- ============================================================
-- 2. training_quiz_results — detailed per-quiz attempt log
-- ============================================================
CREATE TABLE IF NOT EXISTS public.training_quiz_results (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  volume        SMALLINT NOT NULL,                    -- 1, 2, or 3
  module_num    SMALLINT NOT NULL,                    -- module number within volume
  score         INTEGER NOT NULL,                     -- percentage 0-100
  passed        BOOLEAN NOT NULL DEFAULT FALSE,
  answers       JSONB,                                -- { "q1": "c", "q2": "b", ... }
  attempt_num   SMALLINT NOT NULL DEFAULT 1,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quiz_results_user    ON public.training_quiz_results(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_results_module  ON public.training_quiz_results(volume, module_num);

-- ============================================================
-- 3. Row-Level Security
-- ============================================================
ALTER TABLE public.training_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_quiz_results ENABLE ROW LEVEL SECURITY;

-- training_progress: users manage their own rows
CREATE POLICY "Users can view own training progress"
  ON public.training_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own training progress"
  ON public.training_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own training progress"
  ON public.training_progress FOR UPDATE
  USING (auth.uid() = user_id);

-- training_quiz_results: users manage their own rows
CREATE POLICY "Users can view own quiz results"
  ON public.training_quiz_results FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own quiz results"
  ON public.training_quiz_results FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admin/broker can view all progress (for reporting)
CREATE POLICY "Admins can view all training progress"
  ON public.training_progress FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'broker')
    )
  );

CREATE POLICY "Admins can view all quiz results"
  ON public.training_quiz_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'broker')
    )
  );

-- ============================================================
-- 4. Auto-update timestamp trigger
-- ============================================================
CREATE OR REPLACE FUNCTION update_training_progress_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_training_progress_updated
  BEFORE UPDATE ON public.training_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_training_progress_timestamp();
