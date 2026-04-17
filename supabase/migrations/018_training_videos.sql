-- ============================================================================
-- Migration 018: HartFelt Ready Training Videos
-- Two tables + seed data for the 13-module / 80-video training library.
-- YouTube IDs are NULL on first apply and populated by scripts/sync_youtube_ids.py
-- ============================================================================

-- 1. training_modules — the 13 modules across Vol 1 (Foundations) + Vol 2 (Elite)
CREATE TABLE IF NOT EXISTS public.training_modules (
  id TEXT PRIMARY KEY,
  volume SMALLINT NOT NULL CHECK (volume IN (1, 2)),
  module_num SMALLINT NOT NULL,
  title_en TEXT NOT NULL,
  title_es TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (volume, module_num)
);

CREATE INDEX IF NOT EXISTS idx_training_modules_volume ON public.training_modules(volume);
CREATE INDEX IF NOT EXISTS idx_training_modules_sort ON public.training_modules(sort_order);

ALTER TABLE public.training_modules ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read modules
CREATE POLICY training_modules_select ON public.training_modules
  FOR SELECT TO authenticated USING (true);

-- 2. training_videos — each row is a video with EN and ES YouTube IDs
CREATE TABLE IF NOT EXISTS public.training_videos (
  id TEXT PRIMARY KEY,
  module_id TEXT NOT NULL REFERENCES public.training_modules(id) ON DELETE CASCADE,
  volume SMALLINT NOT NULL CHECK (volume IN (1, 2)),
  module_num SMALLINT NOT NULL,
  video_num TEXT NOT NULL,               -- e.g. "1.1", "2.8", "11.5a"
  title_en TEXT,
  title_es TEXT,
  youtube_id_en TEXT,                    -- populated after Tony uploads + sync runs
  youtube_id_es TEXT,
  duration_en_sec INTEGER,
  duration_es_sec INTEGER,
  sort_order INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (volume, video_num)
);

CREATE INDEX IF NOT EXISTS idx_training_videos_module_id ON public.training_videos(module_id);
CREATE INDEX IF NOT EXISTS idx_training_videos_volume ON public.training_videos(volume);
CREATE INDEX IF NOT EXISTS idx_training_videos_sort ON public.training_videos(sort_order);

ALTER TABLE public.training_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY training_videos_select ON public.training_videos
  FOR SELECT TO authenticated USING (true);

-- 3. training_video_progress — per-agent watch progress (optional, used by portal + EASE)
CREATE TABLE IF NOT EXISTS public.training_video_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL REFERENCES public.training_videos(id) ON DELETE CASCADE,
  watched_seconds INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  last_watched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, video_id)
);

CREATE INDEX IF NOT EXISTS idx_tvp_user_id ON public.training_video_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_tvp_video_id ON public.training_video_progress(video_id);

ALTER TABLE public.training_video_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY tvp_select_own ON public.training_video_progress
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY tvp_insert_own ON public.training_video_progress
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY tvp_update_own ON public.training_video_progress
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- ============================================================================
-- Seed: 13 modules
-- ============================================================================
INSERT INTO public.training_modules (id, volume, module_num, title_en, title_es, sort_order) VALUES
  ('m_v1_01', 1, 1, 'HartFelt Ready Foundations', 'Fundamentos de HartFelt Ready', 101),
  ('m_v1_02', 1, 2, 'Lead Generation & Conversion', 'Generación y Conversión de Leads', 102),
  ('m_v1_03', 1, 3, 'Listings Mastery', 'Maestría en Propiedades Listadas', 103),
  ('m_v1_04', 1, 4, 'The Buyer''s Journey', 'El Recorrido del Comprador', 104),
  ('m_v1_05', 1, 5, 'The Transaction Process', 'El Proceso de Transacción', 105),
  ('m_v1_06', 1, 6, 'Marketing & Branding', 'Marketing y Branding', 106),
  ('m_v1_07', 1, 7, 'Growth, Mindset & Mastery', 'Crecimiento, Mentalidad y Maestría', 107),
  ('m_v2_08', 2, 8, 'Vol 2 Elite: The Investor Mindset', 'Vol 2 Elite: Mentalidad del Inversor', 208),
  ('m_v2_09', 2, 9, 'Wholesaling & Assignments', 'Mayoreo y Asignaciones', 209),
  ('m_v2_10', 2, 10, 'Zoning, Development & Land', 'Zonificación, Desarrollo y Terrenos', 210),
  ('m_v2_11', 2, 11, 'The Luxury Market', 'El Mercado de Lujo', 211),
  ('m_v2_12', 2, 12, 'Capital, Finance & Deal Structure', 'Capital, Finanzas y Estructura', 212),
  ('m_v2_13', 2, 13, 'Elite Mastery & Legacy', 'Maestría Elite y Legado', 213)
ON CONFLICT (id) DO UPDATE SET
  title_en = EXCLUDED.title_en,
  title_es = EXCLUDED.title_es,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

-- ============================================================================
-- Seed: 80 videos (YouTube IDs populated by scripts/sync_youtube_ids.py)
-- ============================================================================
INSERT INTO public.training_videos
  (id, module_id, volume, module_num, video_num, title_en, title_es, youtube_id_en, youtube_id_es, duration_en_sec, duration_es_sec, sort_order) VALUES
  ('v_v1_1_1', 'm_v1_01', 1, 1, '1.1', 'Welcome to HartFelt Ready Core Values and the Standard of Excellence', 'Bienvenida a HartFelt Ready Valores Fundamentales y el Estándar de Excelencia', NULL, NULL, 125, 185, 10100),
  ('v_v1_1_2', 'm_v1_01', 1, 1, '1.2', 'Professional Communication Standards Email Text and Calls', 'Estándares de Comunicación Profesional Correo Mensajes de Texto y Llamadas', NULL, NULL, 133, 220, 10101),
  ('v_v1_1_3', 'm_v1_01', 1, 1, '1.3', 'Market Knowledge Zillow Comps Daily Workflow and the Foundations Challenge', 'Conocimiento del Mercado Comparables de Zillow Rutina Diaria y el Desafío de Fundamentos', NULL, NULL, 183, 319, 10102),
  ('v_v1_2_1', 'm_v1_02', 1, 2, '2.1', 'Module 2 Introduction The HartFelt Lead Philosophy', 'Introduccin al Mdulo 2 La Filosofa HartFelt de Prospectos', NULL, NULL, 140, 220, 10200),
  ('v_v1_2_2', 'm_v1_02', 1, 2, '2.2', 'Understanding Lead Sources and Classification', 'Entendiendo las Fuentes de Prospectos y su Clasificacin', NULL, NULL, 187, 317, 10201),
  ('v_v1_2_3', 'm_v1_02', 1, 2, '2.3', 'The HartFelt Lead Tracker and CRM Workflow', 'El HartFelt Lead Tracker y el Flujo de Trabajo del CRM', NULL, NULL, 118, 199, 10202),
  ('v_v1_2_4', 'm_v1_02', 1, 2, '2.4', 'Scripts and Dialogue Frameworks', 'Guiones y Marcos de Dilogo', NULL, NULL, 158, 251, 10203),
  ('v_v1_2_5', 'm_v1_02', 1, 2, '2.5', 'The 7-Day Conversion Challenge and Speed to Lead', 'El 7-Day Conversion Challenge y Speed to Lead', NULL, NULL, 177, 300, 10204),
  ('v_v1_2_6', 'm_v1_02', 1, 2, '2.6', 'Social Proof and Personal Branding The 3-Post Rule', 'Prueba Social y Marca Personal The 3-Post Rule', NULL, NULL, 151, 247, 10205),
  ('v_v1_2_7', 'm_v1_02', 1, 2, '2.7', 'The HartFelt Follow-Up Cadence and Conversion Mindset', 'La Cadencia de Seguimiento HartFelt y la Mentalidad de Conversin', NULL, NULL, 150, 249, 10206),
  ('v_v1_2_8', 'm_v1_02', 1, 2, '2.8', 'HartFelt Ready Challenge and Module 2 Completion', 'HartFelt Ready Challenge y Finalizacin del Mdulo 2', NULL, NULL, 114, 191, 10207),
  ('v_v1_3_1', 'm_v1_03', 1, 3, '3.1', 'Module 3 Introduction The HartFelt Listing Mindset', 'Introduccin al Mdulo 3 La Mentalidad HartFelt del Listado', NULL, NULL, 136, 218, 10300),
  ('v_v1_3_2', 'm_v1_03', 1, 3, '3.2', 'The Pre-Listing Process', 'El Proceso de Pre-Listado', NULL, NULL, 136, 231, 10301),
  ('v_v1_3_3', 'm_v1_03', 1, 3, '3.3', 'The Listing Presentation Framework', 'El Marco de la Presentacin de Listado', NULL, NULL, 143, 234, 10302),
  ('v_v1_3_4', 'm_v1_03', 1, 3, '3.4', 'Pricing Strategy Framework', 'Marco de Estrategia de Precio', NULL, NULL, 123, 216, 10303),
  ('v_v1_3_5', 'm_v1_03', 1, 3, '3.5', 'The HartFelt Marketing Plan and Listing Agreements', 'El HartFelt Marketing Plan y los Acuerdos de Listado', NULL, NULL, 147, 236, 10304),
  ('v_v1_3_6', 'm_v1_03', 1, 3, '3.6', 'Handling Pricing Objections', 'Manejo de Objeciones de Precio', NULL, NULL, 126, 219, 10305),
  ('v_v1_3_7', 'm_v1_03', 1, 3, '3.7', 'Listing Launch Timeline and the Seller Experience', 'Cronograma de Lanzamiento del Listado y la Experiencia del Vendedor', NULL, NULL, 136, 208, 10306),
  ('v_v1_3_8', 'm_v1_03', 1, 3, '3.8', 'HartFelt Ready Challenge and Module 3 Completion', 'HartFelt Ready Challenge y Finalizacin del Mdulo 3', NULL, NULL, 111, 170, 10307),
  ('v_v1_4_1', 'm_v1_04', 1, 4, '4.1', 'Module 4 Introduction The HartFelt Buyer Philosophy', 'Introduccin al Mdulo 4 La Filosofa HartFelt del Comprador', NULL, NULL, 102, 155, 10400),
  ('v_v1_4_2', 'm_v1_04', 1, 4, '4.2', 'The Buyer Consultation Framework', 'El Marco de la Buyer Consultation', NULL, NULL, 134, 207, 10401),
  ('v_v1_4_3', 'm_v1_04', 1, 4, '4.3', 'Pre-Qualification Partnering and The Showing Flow', 'Pre-Calificacin Alianzas y el Showing Flow', NULL, NULL, 118, 196, 10402),
  ('v_v1_4_4', 'm_v1_04', 1, 4, '4.4', 'Live Framing Tour Sheets and Writing Winning Offers', 'Enmarcado en Vivo Tour Sheets y Ofertas Ganadoras', NULL, NULL, 193, 336, 10403),
  ('v_v1_4_5', 'm_v1_04', 1, 4, '4.5', 'Managing Buyer Emotions Appraisals and Inspections', 'Manejando Emociones Avalos e Inspecciones', NULL, NULL, 148, 239, 10404),
  ('v_v1_4_6', 'm_v1_04', 1, 4, '4.6', 'Buyer Update Protocol and Post-Closing Follow-Up', 'Protocolo de Actualizacin del Comprador y Seguimiento Post-Cierre', NULL, NULL, 146, 238, 10405),
  ('v_v1_4_7', 'm_v1_04', 1, 4, '4.7', 'HartFelt Ready Challenge and Module 4 Completion', 'HartFelt Ready Challenge y Finalizacin del Mdulo 4', NULL, NULL, 102, 157, 10406),
  ('v_v1_5_1', 'm_v1_05', 1, 5, '5.1', 'Module 5 Introduction The Transaction Philosophy', 'Introduccin al Mdulo 5 La Filosofa de la Transaccin', NULL, NULL, 101, 163, 10500),
  ('v_v1_5_2', 'm_v1_05', 1, 5, '5.2', 'Contract-to-Close Overview and Transaction Timeline', 'Resumen del Contract-to-Close y Cronograma de Transaccin', NULL, NULL, 148, 242, 10501),
  ('v_v1_5_3', 'm_v1_05', 1, 5, '5.3', 'The HartFelt Transaction Checklist', 'La HartFelt Transaction Checklist', NULL, NULL, 132, 215, 10502),
  ('v_v1_5_4', 'm_v1_05', 1, 5, '5.4', 'Communication Standards and Common Pitfalls', 'Estndares de Comunicacin y Trampas Comunes', NULL, NULL, 148, 256, 10503),
  ('v_v1_5_5', 'm_v1_05', 1, 5, '5.5', 'Transaction Negotiation Influence Without Pressure', 'Negociacin de la Transaccin Influencia Sin Presin', NULL, NULL, 137, 238, 10504),
  ('v_v1_5_6', 'm_v1_05', 1, 5, '5.6', 'The Pre-Closing Huddle Final Walkthrough and Closing Day Standards', 'El Pre-Closing Huddle Recorrido Final y Estndares del Da de Cierre', NULL, NULL, 146, 239, 10505),
  ('v_v1_5_7', 'm_v1_05', 1, 5, '5.7', 'Post-Closing Care and Module 5 Completion', 'Cuidado Post-Cierre y Finalizacin del Mdulo 5', NULL, NULL, 132, 217, 10506),
  ('v_v1_6_1', 'm_v1_06', 1, 6, '6.1', 'Module 6 Introduction The HartFelt Marketing Mindset', 'Introduccin al Mdulo 6 La Mentalidad HartFelt de Marketing', NULL, NULL, 109, 178, 10600),
  ('v_v1_6_2', 'm_v1_06', 1, 6, '6.2', 'The Three Pillars of Brand and the HartFelt Visual Identity', 'Los Tres Pilares de Marca y la HartFelt Visual Identity', NULL, NULL, 137, 234, 10601),
  ('v_v1_6_3', 'm_v1_06', 1, 6, '6.3', 'Typography and Tone of Voice', 'Tipografa y Tono de Voz', NULL, NULL, 109, 185, 10602),
  ('v_v1_6_4', 'm_v1_06', 1, 6, '6.4', 'The 3-Post Rule Weekly Content Framework', 'The 3-Post Rule Marco Semanal de Contenido', NULL, NULL, 135, 212, 10603),
  ('v_v1_6_5', 'm_v1_06', 1, 6, '6.5', 'Canva Templates and Social Media Best Practices', 'Plantillas de Canva y Mejores Prcticas de Redes Sociales', NULL, NULL, 136, 219, 10604),
  ('v_v1_6_6', 'm_v1_06', 1, 6, '6.6', 'Email Lifestyle Storytelling and Community Presence', 'Email Lifestyle Storytelling y Presencia Comunitaria', NULL, NULL, 146, 252, 10605),
  ('v_v1_6_7', 'm_v1_06', 1, 6, '6.7', 'Social Media Code of Conduct and Module 6 Completion', 'Cdigo de Conducta de Redes Sociales y Finalizacin del Mdulo 6', NULL, NULL, 137, 220, 10606),
  ('v_v1_7_1', 'm_v1_07', 1, 7, '7.1', 'Module 7 Introduction The HartFelt Growth Philosophy', 'Introduccin al Mdulo 7 La Filosofa HartFelt de Crecimiento', NULL, NULL, 95, 157, 10700),
  ('v_v1_7_2', 'm_v1_07', 1, 7, '7.2', 'The Four Pillars of Sustainable Growth and the KPI Dashboard', 'Los Cuatro Pilares del Crecimiento y el KPI Dashboard', NULL, NULL, 163, 273, 10701),
  ('v_v1_7_3', 'm_v1_07', 1, 7, '7.3', 'Business Planning Framework and Client Retention', 'Marco de Planificacin de Negocios y Retencin de Clientes', NULL, NULL, 140, 247, 10702),
  ('v_v1_7_4', 'm_v1_07', 1, 7, '7.4', 'Referral and Review Strategy', 'Estrategia de Referencias y Reseas', NULL, NULL, 114, 194, 10703),
  ('v_v1_7_5', 'm_v1_07', 1, 7, '7.5', 'Long-Term Partnerships and Scaling Your Brand', 'Alianzas a Largo Plazo y Escalando Su Marca', NULL, NULL, 136, 213, 10704),
  ('v_v1_7_6', 'm_v1_07', 1, 7, '7.6', 'Mindset Momentum Module 7 Challenge and Volume I Completion', 'Mentalidad Impulso Desafo del Mdulo 7 y Finalizacin del Volumen I', NULL, NULL, 254, 433, 10705),
  ('v_v2_8_1', 'm_v2_08', 2, 8, '8.1', 'Module 8 Introduction and The HartFelt Investor Philosophy', 'Introduccin al Mdulo 8 y la HartFelt Investor Philosophy', NULL, NULL, 154, 250, 20800),
  ('v_v2_8_2', 'm_v2_08', 2, 8, '8.2', 'Off-Market Sourcing and Cash Versus Leveraged Buyers', 'Off-Market Sourcing y Cash vs. Leveraged Buyers', NULL, NULL, 163, 275, 20801),
  ('v_v2_8_3', 'm_v2_08', 2, 8, '8.3', 'Assignments Versus Double Closes and Talking Returns Without Advice', 'Assignments vs. Double Closes y Hablar de Retornos Sin Dar Consejo', NULL, NULL, 143, 235, 20802),
  ('v_v2_8_4', 'm_v2_08', 2, 8, '8.4', 'Legal Reputation Protection and the Investor Communication Standard', 'Proteccin Legal Reputacional y el Investor Communication Standard', NULL, NULL, 141, 240, 20803),
  ('v_v2_8_5', 'm_v2_08', 2, 8, '8.5', 'HartFelt Ready Elite Challenge and Module 8 Completion', 'HartFelt Ready Elite Challenge y Cierre del Mdulo 8', NULL, NULL, 111, 170, 20804),
  ('v_v2_9_1', 'm_v2_09', 2, 9, '9.1', 'Module 9 Introduction and Assignment Etiquette', 'Introduccin al Mdulo 9 y Assignment Etiquette', NULL, NULL, 141, 234, 20900),
  ('v_v2_9_2', 'm_v2_09', 2, 9, '9.2', 'Title Control and Managing Multiple Parties', 'Control de Title y Manejo de Mltiples Partes', NULL, NULL, 152, 247, 20901),
  ('v_v2_9_3', 'm_v2_09', 2, 9, '9.3', 'Keeping Leverage Without Aggression and Knowing When to Walk Away', 'Mantener Apalancamiento Sin Agresin y Saber Cundo Retirarse', NULL, NULL, 155, 258, 20902),
  ('v_v2_9_4', 'm_v2_09', 2, 9, '9.4', 'Protecting Assignment Fees and Reputation as Currency', 'Proteger los Assignment Fees y la Reputacin Como Moneda', NULL, NULL, 145, 235, 20903),
  ('v_v2_9_5', 'm_v2_09', 2, 9, '9.5', 'HartFelt Ready Elite Challenge and Module 9 Completion', 'HartFelt Ready Elite Challenge y Cierre del Mdulo 9', NULL, NULL, 122, 186, 20904),
  ('v_v2_10_1', 'm_v2_10', 2, 10, '10.1', 'Module 10 Introduction and Zoning Fundamentals', 'Introduccin al Mdulo 10 y Fundamentos de Zoning', NULL, NULL, 147, 238, 21000),
  ('v_v2_10_2', 'm_v2_10', 2, 10, '10.2', 'Density Math and Reading Site Plans', 'Matemticas de Densidad y Lectura de Site Plans', NULL, NULL, 164, 276, 21001),
  ('v_v2_10_3', 'm_v2_10', 2, 10, '10.3', 'How Developers Think and Talking Feasibility Without Advice', 'Cmo Piensan los Desarrolladores y Hablar de Feasibility Sin Dar Consejo', NULL, NULL, 162, 259, 21002),
  ('v_v2_10_4', 'm_v2_10', 2, 10, '10.4', 'Positioning as a Strategic Advisor and When to Bring in Professionals', 'Posicionarse como Asesor Estratgico y Cundo Traer a los Profesionales', NULL, NULL, 130, 202, 21003),
  ('v_v2_10_5', 'm_v2_10', 2, 10, '10.5', 'HartFelt Ready Elite Challenge and Module 10 Completion', 'HartFelt Ready Elite Challenge y Cierre del Mdulo 10', NULL, NULL, 115, 187, 21004),
  ('v_v2_11_1', 'm_v2_11', 2, 11, '11.1', 'Module 11 Introduction and Understanding the Luxury Mindset', 'Introduccin al Mdulo 11 y Entendiendo la Mentalidad del Lujo', NULL, NULL, 131, 210, 21100),
  ('v_v2_11_2', 'm_v2_11', 2, 11, '11.2', 'Authority Without Flash and Privacy as Respect', 'Autoridad Sin Ostentacin y Privacidad Como Respeto', NULL, NULL, 149, 257, 21101),
  ('v_v2_11_3', 'm_v2_11', 2, 11, '11.3', 'Managing Expectations and How Luxury Clients Decide', 'Manejo de Expectativas y Cmo Deciden los Clientes de Lujo', NULL, NULL, 146, 236, 21102),
  ('v_v2_11_4', 'm_v2_11', 2, 11, '11.4', 'Communication Cadence Handling Power and Ego and the Use of Silence', 'Cadencia de Comunicacin Manejo del Poder y el Ego y el Uso del Silencio', NULL, NULL, 172, 289, 21103),
  ('v_v2_11_5', 'm_v2_11', 2, 11, '11.5', 'HartFelt Ready Elite Challenge and Module 11 Completion', 'HartFelt Ready Elite Challenge y Cierre del Mdulo 11', NULL, NULL, 111, 175, 21104),
  ('v_v2_11_5b', 'm_v2_11', 2, 11, '11.5b', NULL, 'Hart to Heart y Cierre del Mdulo 11', NULL, NULL, NULL, 61, 21105),
  ('v_v2_12_1', 'm_v2_12', 2, 12, '12.1', 'Module 12 Introduction and How Capital Thinks', 'Introduccin al Mdulo 12 y Cmo Piensa el Capital', NULL, NULL, 116, 183, 21200),
  ('v_v2_12_1a', 'm_v2_12', 2, 12, '12.1a', NULL, 'Introduccin al Mdulo 12 y Posicionamiento', NULL, NULL, NULL, 76, 21201),
  ('v_v2_12_2', 'm_v2_12', 2, 12, '12.2', 'Information Versus Advice and Speaking in Metrics', 'Informacin vs. Consejo y Hablar en Mtricas', NULL, NULL, 151, 238, 21202),
  ('v_v2_12_3', 'm_v2_12', 2, 12, '12.3', 'Cash Versus Leveraged Buyers and Framing Risk Without Killing Momentum', 'Cash vs. Leveraged Buyers y Enmarcar el Riesgo Sin Matar el Momentum', NULL, NULL, 160, 254, 21203),
  ('v_v2_12_4', 'm_v2_12', 2, 12, '12.4', 'Building Investor Confidence and the Capital Conversation Framework', 'Construir Confianza del Inversionista y el Capital Conversation Framework', NULL, NULL, 147, 238, 21204),
  ('v_v2_12_5', 'm_v2_12', 2, 12, '12.5', 'Knowing When to Pause Challenge and Module 12 Completion', 'Saber Cundo Pausar Challenge y Cierre del Mdulo 12', NULL, NULL, 165, 263, 21205),
  ('v_v2_13_1', 'm_v2_13', 2, 13, '13.1', 'Module 13 Introduction and Risk Is Not the Enemy Surprise Is', 'Introduccin al Mdulo 13 y el Riesgo No Es el Enemigo la Sorpresa Lo Es', NULL, NULL, 140, 241, 21300),
  ('v_v2_13_2', 'm_v2_13', 2, 13, '13.2', 'Reputation as the Real Asset and Ethics Under Pressure', 'La Reputacin Como el Activo Real y la tica Bajo Presin', NULL, NULL, 152, 243, 21301),
  ('v_v2_13_3', 'm_v2_13', 2, 13, '13.3', 'Documentation as Protection and Knowing When to Walk Away', 'La Documentacin Como Proteccin y Saber Cundo Retirarse', NULL, NULL, 151, 245, 21302),
  ('v_v2_13_4', 'm_v2_13', 2, 13, '13.4', 'Playing the Long Game and How Professionals Exit Deals Cleanly', 'Jugando el Long Game y Cmo los Profesionales Salen de los Deals Limpiamente', NULL, NULL, 144, 231, 21303),
  ('v_v2_13_5', 'm_v2_13', 2, 13, '13.5', NULL, 'El HartFelt Professional Standard Mastery Challenge y Cierre del Volumen 2', NULL, NULL, NULL, 346, 21304),
  ('v_v2_13_5a', 'm_v2_13', 2, 13, '13.5a', 'The HartFelt Professional Standard and Mastery Challenge', NULL, NULL, NULL, 125, NULL, 21305),
  ('v_v2_13_5b', 'm_v2_13', 2, 13, '13.5b', 'Volume 2 Graduation and HartFelt Ready Elite Completion', NULL, NULL, NULL, 90, NULL, 21306)
ON CONFLICT (id) DO UPDATE SET
  title_en = EXCLUDED.title_en,
  title_es = EXCLUDED.title_es,
  duration_en_sec = EXCLUDED.duration_en_sec,
  duration_es_sec = EXCLUDED.duration_es_sec,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();
