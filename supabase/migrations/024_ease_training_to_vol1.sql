-- ============================================================================
-- Migration 024: Move EASE Training from Volume 4 → Volume 1 (modules 11-13)
-- Role-based filtering: each user only sees the EASE module for their role
-- ============================================================================

-- Step 1: Add required_role column to training_modules
-- NULL = visible to all roles; 'broker'/'admin'/'agent' = role-specific
ALTER TABLE training_modules ADD COLUMN IF NOT EXISTS required_role TEXT DEFAULT NULL;

-- Step 2: Move the 3 EASE modules from volume 4 → volume 1
UPDATE training_modules SET volume = 1, module_num = 11, sort_order = 11100, required_role = 'broker',
  title_en = 'EASE Training — Broker', title_es = 'Entrenamiento EASE — Broker'
WHERE id = 'm_v4_broker';

UPDATE training_modules SET volume = 1, module_num = 12, sort_order = 11200, required_role = 'admin',
  title_en = 'EASE Training — Admin', title_es = 'Entrenamiento EASE — Admin'
WHERE id = 'm_v4_admin';

UPDATE training_modules SET volume = 1, module_num = 13, sort_order = 11300, required_role = 'agent',
  title_en = 'EASE Training — Agent', title_es = 'Entrenamiento EASE — Agente'
WHERE id = 'm_v4_agent';

-- Step 3: Move all 11 EASE videos from volume 4 → volume 1, renumber video_num
-- Broker videos (module 11)
UPDATE training_videos SET volume = 1, module_num = 11, video_num = '11.1', sort_order = 11101 WHERE id = 'v_v4_b1';
UPDATE training_videos SET volume = 1, module_num = 11, video_num = '11.2', sort_order = 11102 WHERE id = 'v_v4_b2';
UPDATE training_videos SET volume = 1, module_num = 11, video_num = '11.3', sort_order = 11103 WHERE id = 'v_v4_b3';
UPDATE training_videos SET volume = 1, module_num = 11, video_num = '11.4', sort_order = 11104 WHERE id = 'v_v4_b4';

-- Admin videos (module 12)
UPDATE training_videos SET volume = 1, module_num = 12, video_num = '12.1', sort_order = 11201 WHERE id = 'v_v4_a1';
UPDATE training_videos SET volume = 1, module_num = 12, video_num = '12.2', sort_order = 11202 WHERE id = 'v_v4_a2';
UPDATE training_videos SET volume = 1, module_num = 12, video_num = '12.3', sort_order = 11203 WHERE id = 'v_v4_a3';

-- Agent videos (module 13)
UPDATE training_videos SET volume = 1, module_num = 13, video_num = '13.1', sort_order = 11301 WHERE id = 'v_v4_g1';
UPDATE training_videos SET volume = 1, module_num = 13, video_num = '13.2', sort_order = 11302 WHERE id = 'v_v4_g2';
UPDATE training_videos SET volume = 1, module_num = 13, video_num = '13.3', sort_order = 11303 WHERE id = 'v_v4_g3';
UPDATE training_videos SET volume = 1, module_num = 13, video_num = '13.4', sort_order = 11304 WHERE id = 'v_v4_g4';
