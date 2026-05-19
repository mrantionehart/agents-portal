-- Digital Business Card Feature Migration
-- Run this in Supabase Dashboard → SQL Editor

-- 1. Add business card columns to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS business_card_url TEXT,
ADD COLUMN IF NOT EXISTS card_slug TEXT UNIQUE;

-- 2. Create index for fast slug lookups (public card page)
CREATE INDEX IF NOT EXISTS idx_profiles_card_slug ON profiles (card_slug) WHERE card_slug IS NOT NULL;

-- 3. Generate slugs for existing agents with names
UPDATE profiles
SET card_slug = LOWER(REPLACE(REPLACE(TRIM(full_name), ' ', '-'), '''', ''))
WHERE full_name IS NOT NULL
  AND card_slug IS NULL
  AND role IN ('agent', 'broker')
  AND is_active = true
  AND full_name NOT LIKE '%Test%'
  AND full_name NOT LIKE '%QA%'
  AND full_name NOT LIKE '%HartFelt%';

-- 4. Allow public read access to card data (for the public card page)
CREATE POLICY IF NOT EXISTS "Public can read card profiles by slug"
ON profiles FOR SELECT
USING (card_slug IS NOT NULL AND card_enabled = true);

-- 5. Storage policy: allow authenticated users to upload to business-cards bucket
-- (Bucket already created as public for viewing)
INSERT INTO storage.policies (name, bucket_id, operation, definition)
SELECT 'Allow broker upload', 'business-cards', 'INSERT',
  '(auth.role() = ''authenticated'')'
WHERE NOT EXISTS (
  SELECT 1 FROM storage.policies WHERE name = 'Allow broker upload' AND bucket_id = 'business-cards'
);
