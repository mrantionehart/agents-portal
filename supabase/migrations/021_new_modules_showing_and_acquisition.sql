-- ============================================================
-- Migration 021: Add Showing Playbook (Vol 1 M5) and
-- Client Acquisition (Vol 2 M14), renumber Vol 1 M5-7 → M6-8
-- ============================================================

-- STEP 1: Renumber existing Vol 1 modules 5→6, 6→7, 7→8
-- We go in reverse order to avoid unique constraint conflicts
-- on (volume, module_num) if one exists.

-- Renumber module 7 → 8
UPDATE training_modules
SET module_num = 8, sort_order = sort_order + 1
WHERE volume = 1 AND module_num = 7;

UPDATE training_videos
SET module_num = 8
WHERE volume = 1 AND module_num = 7;

-- Renumber module 6 → 7
UPDATE training_modules
SET module_num = 7, sort_order = sort_order + 1
WHERE volume = 1 AND module_num = 6;

UPDATE training_videos
SET module_num = 7
WHERE volume = 1 AND module_num = 6;

-- Renumber module 5 → 6
UPDATE training_modules
SET module_num = 6, sort_order = sort_order + 1
WHERE volume = 1 AND module_num = 5;

UPDATE training_videos
SET module_num = 6
WHERE volume = 1 AND module_num = 5;

-- STEP 2: Insert new Module 5 — HartFelt Showing Playbook (Vol 1)
INSERT INTO training_modules (volume, module_num, title, description, sort_order)
VALUES (
  1, 5,
  'HartFelt Showing Playbook',
  'The HART Method — master the showing experience from preparation through close. Covers buyer types, safety protocol, activation, objection handling, and the 48-hour follow-up system.',
  5
);

-- STEP 3: Insert Showing Playbook videos (5 videos)
INSERT INTO training_videos (volume, module_num, video_num, title, description, duration_seconds, sort_order) VALUES
(1, 5, 1, 'Introduction: The HART Method', 'Overview of the HART Method — Hear, Activate, Read & Respond, Transition to Close. The system behind every HartFelt showing.', 240, 1),
(1, 5, 2, 'H: Hear the Client & Safety Protocol', 'Pre-showing preparation, understanding buyer types (Emotional, Analytical, Skeptical), and the non-negotiable HartFelt Safety Protocol.', 300, 2),
(1, 5, 3, 'A: Activate the Experience', 'Creating the first impression, controlling the energy, and the power of asking "What is your first impression?"', 240, 3),
(1, 5, 4, 'R: Read & Respond', 'Strategic questions to uncover real interest, surfacing objections intentionally, the Objection Micro-Script, and creating ownership.', 270, 4),
(1, 5, 5, 'T: Transition to Close & Follow-Up', 'The 1-10 rating system, Deal Control Rule, 48-Hour Control System, and Soft Close vs Strong Close scripts.', 300, 5);

-- STEP 4: Insert new Module 14 — Client Acquisition (Vol 2)
INSERT INTO training_modules (volume, module_num, title, description, sort_order)
VALUES (
  2, 14,
  'Client Acquisition: Access Over Leads',
  'The HartFelt Law of Access — stop chasing leads and start positioning yourself in the right rooms. Covers the 5 Access Levers, the ACCESS System, 4 Access Levels, and real scripts.',
  14
);

-- STEP 5: Insert Client Acquisition videos (5 videos)
INSERT INTO training_videos (volume, module_num, video_num, title, description, duration_seconds, sort_order) VALUES
(2, 14, 1, 'The Shift: From Leads to Access', 'The biggest lie in real estate exposed. The HartFelt Law: proximity creates power, power creates opportunity, opportunity creates income.', 240, 1),
(2, 14, 2, 'The 5 Access Levers', 'Inventory Access, Proximity to Power, Information Advantage, Usefulness Over Ego, and Consistency in the Room.', 300, 2),
(2, 14, 3, 'The ACCESS System & Weekly Execution', 'The A.C.C.E.S.S. framework (Attach, Contribute, Commit, Educate, Stay Visible, Scale), weekly scorecard, and execution block.', 270, 3),
(2, 14, 4, 'Access Levels & Real Scripts', 'The four levels (Observer, Contributor, Operator, Authority) and exact scripts for getting in rooms, following up, and positioning.', 270, 4),
(2, 14, 5, 'Real-World Application & Final Message', 'Luxury listing, development, and new agent scenarios. The four blockers. The final HartFelt message on access.', 270, 5);

-- STEP 6: Also renumber any existing training_progress completed_modules
-- for Volume 1 users who had modules 5, 6, or 7 completed.
-- We need to shift those numbers up by 1.
-- This uses a PostgreSQL function to update the JSONB array.

DO $$
DECLARE
  rec RECORD;
  old_modules int[];
  new_modules int[];
  m int;
BEGIN
  FOR rec IN
    SELECT id, completed_modules
    FROM training_progress
    WHERE volume = 'volume-1'
      AND completed_modules IS NOT NULL
  LOOP
    old_modules := ARRAY(SELECT jsonb_array_elements_text(rec.completed_modules::jsonb)::int);
    new_modules := '{}';
    FOREACH m IN ARRAY old_modules
    LOOP
      IF m >= 5 THEN
        new_modules := array_append(new_modules, m + 1);
      ELSE
        new_modules := array_append(new_modules, m);
      END IF;
    END LOOP;
    UPDATE training_progress
    SET completed_modules = to_jsonb(new_modules)
    WHERE id = rec.id;
  END LOOP;
END $$;

-- Also renumber test_scores keys (m5→m6, m6→m7, m7→m8) for volume-1
DO $$
DECLARE
  rec RECORD;
  old_scores jsonb;
  new_scores jsonb;
  k text;
  v numeric;
BEGIN
  FOR rec IN
    SELECT id, test_scores
    FROM training_progress
    WHERE volume = 'volume-1'
      AND test_scores IS NOT NULL
  LOOP
    old_scores := rec.test_scores::jsonb;
    new_scores := '{}'::jsonb;
    FOR k, v IN SELECT * FROM jsonb_each_text(old_scores)
    LOOP
      IF k = 'm7' THEN
        new_scores := new_scores || jsonb_build_object('m8', v::numeric);
      ELSIF k = 'm6' THEN
        new_scores := new_scores || jsonb_build_object('m7', v::numeric);
      ELSIF k = 'm5' THEN
        new_scores := new_scores || jsonb_build_object('m6', v::numeric);
      ELSE
        new_scores := new_scores || jsonb_build_object(k, v::numeric);
      END IF;
    END LOOP;
    UPDATE training_progress
    SET test_scores = new_scores
    WHERE id = rec.id;
  END LOOP;
END $$;

-- Renumber quiz results for volume 1 modules 5, 6, 7 → 6, 7, 8
UPDATE training_quiz_results SET module_num = 8 WHERE volume = 1 AND module_num = 7;
UPDATE training_quiz_results SET module_num = 7 WHERE volume = 1 AND module_num = 6;
UPDATE training_quiz_results SET module_num = 6 WHERE volume = 1 AND module_num = 5;

-- Reset volume_completed for volume-1 since there's now a new module required
UPDATE training_progress
SET volume_completed = false
WHERE volume = 'volume-1' AND volume_completed = true;
