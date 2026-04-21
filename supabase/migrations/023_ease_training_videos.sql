-- ============================================================================
-- Migration 023: Add Ease Training modules and videos (Volume 4)
-- 11 HeyGen AI training videos organized by role: Broker, Admin, Agent
-- All videos hosted on Cloudflare R2 bucket: hartfelt-training
-- ============================================================================

-- Step 1: Expand volume check constraints to allow volume 4
ALTER TABLE training_modules DROP CONSTRAINT IF EXISTS training_modules_volume_check;
ALTER TABLE training_modules ADD CONSTRAINT training_modules_volume_check CHECK (volume >= 1 AND volume <= 10);

ALTER TABLE training_videos DROP CONSTRAINT IF EXISTS training_videos_volume_check;
ALTER TABLE training_videos ADD CONSTRAINT training_videos_volume_check CHECK (volume >= 1 AND volume <= 10);

-- Step 2: Insert 3 Ease Training modules (one per role)
INSERT INTO training_modules (id, volume, module_num, title_en, title_es, sort_order, created_at, updated_at)
VALUES
  ('m_v4_broker', 4, 1, 'EASE Broker Training', 'Entrenamiento EASE para Broker', 40100, NOW(), NOW()),
  ('m_v4_admin',  4, 2, 'EASE Admin Training',  'Entrenamiento EASE para Admin',  40200, NOW(), NOW()),
  ('m_v4_agent',  4, 3, 'EASE Agent Training',  'Entrenamiento EASE para Agente', 40300, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Step 3: Insert 11 Ease Training videos with R2 keys
INSERT INTO training_videos (id, module_id, volume, module_num, video_num, title_en, title_es, r2_key_en, r2_bucket, sort_order, created_at, updated_at)
VALUES
  -- Broker videos (4)
  ('v_v4_b1', 'm_v4_broker', 4, 1, '4.1', 'Command Center',           'Centro de Comando',              'training/ease_training/en/broker/broker_1_command_center.mp4',        'hartfelt-training', 40101, NOW(), NOW()),
  ('v_v4_b2', 'm_v4_broker', 4, 1, '4.2', 'Commission Payout',        'Pago de Comisiones',             'training/ease_training/en/broker/broker_2_commission_payout.mp4',     'hartfelt-training', 40102, NOW(), NOW()),
  ('v_v4_b3', 'm_v4_broker', 4, 1, '4.3', 'Recruiting & Onboarding',  'Reclutamiento e Incorporacion',  'training/ease_training/en/broker/broker_3_recruiting_onboarding.mp4', 'hartfelt-training', 40103, NOW(), NOW()),
  ('v_v4_b4', 'm_v4_broker', 4, 1, '4.4', 'Leads, Compliance & Team', 'Leads, Cumplimiento y Equipo',   'training/ease_training/en/broker/broker_4_leads_compliance_team.mp4', 'hartfelt-training', 40104, NOW(), NOW()),
  -- Admin videos (3)
  ('v_v4_a1', 'm_v4_admin', 4, 2, '4.5', 'Role & Daily Checklist',         'Rol y Lista Diaria',                    'training/ease_training/en/admin/admin_1_role_daily_checklist.mp4',        'hartfelt-training', 40201, NOW(), NOW()),
  ('v_v4_a2', 'm_v4_admin', 4, 2, '4.6', 'Compliance & Onboarding',        'Cumplimiento e Incorporacion',          'training/ease_training/en/admin/admin_2_compliance_onboarding.mp4',       'hartfelt-training', 40202, NOW(), NOW()),
  ('v_v4_a3', 'm_v4_admin', 4, 2, '4.7', 'Docs, Intakes & Communication',  'Documentos, Intakes y Comunicacion',    'training/ease_training/en/admin/admin_3_docs_intakes_communication.mp4',  'hartfelt-training', 40203, NOW(), NOW()),
  -- Agent videos (4)
  ('v_v4_g1', 'm_v4_agent', 4, 3, '4.8',  'Welcome & Your Apps',        'Bienvenida y Tus Apps',           'training/ease_training/en/agent/agent_1_welcome_your_apps.mp4',       'hartfelt-training', 40301, NOW(), NOW()),
  ('v_v4_g2', 'm_v4_agent', 4, 3, '4.9',  'Leads & Deals',             'Leads y Negocios',                'training/ease_training/en/agent/agent_2_leads_deals.mp4',             'hartfelt-training', 40302, NOW(), NOW()),
  ('v_v4_g3', 'm_v4_agent', 4, 3, '4.10', 'Commissions & Training',    'Comisiones y Entrenamiento',      'training/ease_training/en/agent/agent_3_commissions_training.mp4',    'hartfelt-training', 40303, NOW(), NOW()),
  ('v_v4_g4', 'm_v4_agent', 4, 3, '4.11', 'CMA, Compliance & Chat',    'CMA, Cumplimiento y Chat',        'training/ease_training/en/agent/agent_4_cma_compliance_chat.mp4',     'hartfelt-training', 40304, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
