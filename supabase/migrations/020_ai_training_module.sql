-- ============================================================================
-- Migration 020: HartFelt AI Training — 8-Module Bonus Course
--
-- Adds volume 3 (AI Training) with 8 modules and 16 videos (8 EN + 8 ES).
-- Videos are already uploaded to R2 under training/ai_training/{en,es}/module_XX/
-- ============================================================================

-- 1. Expand volume check to allow volume 3
ALTER TABLE public.training_modules DROP CONSTRAINT IF EXISTS training_modules_volume_check;
ALTER TABLE public.training_modules ADD CONSTRAINT training_modules_volume_check CHECK (volume IN (1, 2, 3));

ALTER TABLE public.training_videos DROP CONSTRAINT IF EXISTS training_videos_volume_check;
ALTER TABLE public.training_videos ADD CONSTRAINT training_videos_volume_check CHECK (volume IN (1, 2, 3));

-- 2. Insert the 8 AI Training modules
INSERT INTO public.training_modules (id, volume, module_num, title_en, title_es, sort_order)
VALUES
  ('m_v3_01', 3, 1, 'AI Mindset', 'Mentalidad de IA', 30100),
  ('m_v3_02', 3, 2, 'ChatGPT vs Claude', 'ChatGPT vs Claude', 30200),
  ('m_v3_03', 3, 3, 'Prompting Like a Pro', 'Prompting Como un Profesional', 30300),
  ('m_v3_04', 3, 4, 'Real Estate Use Cases', 'Casos de Uso en Bienes Raíces', 30400),
  ('m_v3_05', 3, 5, 'Daily AI Workflow', 'Flujo de Trabajo Diario con IA', 30500),
  ('m_v3_06', 3, 6, 'AI Roleplay', 'Juego de Roles con IA', 30600),
  ('m_v3_07', 3, 7, 'What Not to Do', 'Qué No Hacer', 30700),
  ('m_v3_08', 3, 8, 'Making Money with AI', 'Ganar Dinero con IA', 30800)
ON CONFLICT (id) DO UPDATE SET
  title_en = EXCLUDED.title_en,
  title_es = EXCLUDED.title_es,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

-- 3. Insert the 8 AI Training videos (one video per module, EN+ES in same row)
INSERT INTO public.training_videos (
  id, module_id, volume, module_num, video_num,
  title_en, title_es,
  youtube_id_en, youtube_id_es,
  duration_en_sec, duration_es_sec,
  r2_key_en, r2_key_es, r2_bucket,
  sort_order
) VALUES
  ('v_v3_1_1', 'm_v3_01', 3, 1, 'ai1.1',
   'AI Mindset — Getting Your Head Right About AI',
   'Mentalidad de IA — Preparando Tu Mente Para la IA',
   NULL, NULL, 17, 33,
   'training/ai_training/en/module_01/ai_module_1.en.mp4',
   'training/ai_training/es/module_01/ai_module_1.es.mp4',
   'hartfelt-training', 30100),
  ('v_v3_2_1', 'm_v3_02', 3, 2, 'ai2.1',
   'ChatGPT vs Claude — Choosing the Right AI Tool',
   'ChatGPT vs Claude — Eligiendo la Herramienta de IA Correcta',
   NULL, NULL, 23, 37,
   'training/ai_training/en/module_02/ai_module_2.en.mp4',
   'training/ai_training/es/module_02/ai_module_2.es.mp4',
   'hartfelt-training', 30200),
  ('v_v3_3_1', 'm_v3_03', 3, 3, 'ai3.1',
   'Prompting Like a Pro — Getting Better Answers from AI',
   'Prompting Como un Profesional — Obteniendo Mejores Respuestas de la IA',
   NULL, NULL, 24, 34,
   'training/ai_training/en/module_03/ai_module_3.en.mp4',
   'training/ai_training/es/module_03/ai_module_3.es.mp4',
   'hartfelt-training', 30300),
  ('v_v3_4_1', 'm_v3_04', 3, 4, 'ai4.1',
   'Real Estate Use Cases — AI in Your Daily Business',
   'Casos de Uso en Bienes Raíces — IA en Tu Negocio Diario',
   NULL, NULL, 37, 55,
   'training/ai_training/en/module_04/ai_module_4.en.mp4',
   'training/ai_training/es/module_04/ai_module_4.es.mp4',
   'hartfelt-training', 30400),
  ('v_v3_5_1', 'm_v3_05', 3, 5, 'ai5.1',
   'Daily AI Workflow — Building AI Into Your Routine',
   'Flujo de Trabajo Diario con IA — Integrando la IA en Tu Rutina',
   NULL, NULL, 14, 23,
   'training/ai_training/en/module_05/ai_module_5.en.mp4',
   'training/ai_training/es/module_05/ai_module_5.es.mp4',
   'hartfelt-training', 30500),
  ('v_v3_6_1', 'm_v3_06', 3, 6, 'ai6.1',
   'AI Roleplay — Practice Makes Perfect',
   'Juego de Roles con IA — La Práctica Hace al Maestro',
   NULL, NULL, 15, 22,
   'training/ai_training/en/module_06/ai_module_6.en.mp4',
   'training/ai_training/es/module_06/ai_module_6.es.mp4',
   'hartfelt-training', 30600),
  ('v_v3_7_1', 'm_v3_07', 3, 7, 'ai7.1',
   'What Not to Do — Avoiding AI Pitfalls',
   'Qué No Hacer — Evitando Errores con la IA',
   NULL, NULL, 11, 15,
   'training/ai_training/en/module_07/ai_module_7.en.mp4',
   'training/ai_training/es/module_07/ai_module_7.es.mp4',
   'hartfelt-training', 30700),
  ('v_v3_8_1', 'm_v3_08', 3, 8, 'ai8.1',
   'Making Money with AI — Monetizing Your AI Skills',
   'Ganar Dinero con IA — Monetizando Tus Habilidades de IA',
   NULL, NULL, 13, 19,
   'training/ai_training/en/module_08/ai_module_8.en.mp4',
   'training/ai_training/es/module_08/ai_module_8.es.mp4',
   'hartfelt-training', 30800)
ON CONFLICT (id) DO UPDATE SET
  title_en = EXCLUDED.title_en,
  title_es = EXCLUDED.title_es,
  duration_en_sec = EXCLUDED.duration_en_sec,
  duration_es_sec = EXCLUDED.duration_es_sec,
  r2_key_en = EXCLUDED.r2_key_en,
  r2_key_es = EXCLUDED.r2_key_es,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();
