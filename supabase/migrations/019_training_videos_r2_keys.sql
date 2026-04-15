-- ============================================================================
-- Migration 019: Switch HartFelt Ready training video storage to Cloudflare R2
--
-- Background
-- ----------
-- Migration 018 created `training_videos` with `youtube_id_en` / `youtube_id_es`.
-- We pivoted away from YouTube (draft-state workflow was unworkable at scale)
-- to Cloudflare R2 object storage. Videos now live in the `hartfelt-training`
-- bucket under keys of the form:
--
--     training/vol{1,2}/{en,es}/module_{NN}/v{major}.{minor}.mp4
--
-- The Next.js portal exposes `/api/training/sign-video?key=...` which returns a
-- short-lived signed URL; EASE mobile calls that endpoint and plays the stream
-- with react-native-video.
--
-- This migration is additive: we keep `youtube_id_en`/`youtube_id_es` for
-- rollback, and add `r2_key_en`/`r2_key_es` which hartfelt_r2_uploader.py +
-- sync_r2_keys.py populate from the upload manifest.
-- ============================================================================

ALTER TABLE public.training_videos
  ADD COLUMN IF NOT EXISTS r2_key_en TEXT,
  ADD COLUMN IF NOT EXISTS r2_key_es TEXT,
  ADD COLUMN IF NOT EXISTS r2_bucket TEXT DEFAULT 'hartfelt-training';

-- Deterministic key the uploader writes. Safe to backfill — uploader is the
-- source of truth and will overwrite after sync_r2_keys.py runs, but this gives
-- us usable values even before the manifest is synced.
UPDATE public.training_videos
SET
  r2_key_en = CASE
    WHEN title_en IS NOT NULL
    THEN format('training/vol%s/en/module_%s/v%s.mp4',
                volume, LPAD(module_num::text, 2, '0'), video_num)
    ELSE r2_key_en
  END,
  r2_key_es = CASE
    WHEN title_es IS NOT NULL
    THEN format('training/vol%s/es/module_%s/v%s.mp4',
                volume, LPAD(module_num::text, 2, '0'), video_num)
    ELSE r2_key_es
  END,
  updated_at = NOW()
WHERE r2_key_en IS NULL OR r2_key_es IS NULL;

CREATE INDEX IF NOT EXISTS idx_training_videos_r2_key_en ON public.training_videos(r2_key_en);
CREATE INDEX IF NOT EXISTS idx_training_videos_r2_key_es ON public.training_videos(r2_key_es);

COMMENT ON COLUMN public.training_videos.r2_key_en IS
  'Cloudflare R2 object key for the English video (bucket: hartfelt-training). Served via /api/training/sign-video.';
COMMENT ON COLUMN public.training_videos.r2_key_es IS
  'Cloudflare R2 object key for the Spanish video. Served via /api/training/sign-video.';
