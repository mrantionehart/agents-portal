const { Client } = require('pg');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const dbPassword = process.env.SUPABASE_DB_PASSWORD || process.env.SUPABASE_SERVICE_ROLE_KEY;
const projectRef = supabaseUrl.split('//')[1].split('.')[0];

// Strategy: try direct 5432, then pooler variants
const candidates = [
  `postgresql://postgres:${encodeURIComponent(dbPassword)}@db.${projectRef}.supabase.co:5432/postgres`,
  `postgresql://postgres:${encodeURIComponent(dbPassword)}@${projectRef}.supabase.co:5432/postgres`,
];

(async () => {
  const sql = fs.readFileSync('supabase/migrations/019_training_videos_r2_keys.sql', 'utf8');
  for (const cs of candidates) {
    const masked = cs.replace(/:[^@]+@/, ':***@');
    console.log(`trying: ${masked}`);
    const client = new Client({ connectionString: cs, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000 });
    try {
      await client.connect();
      console.log('  connected');
      await client.query(sql);
      console.log('  ✅ migration 019 applied');
      const r = await client.query(`SELECT COUNT(*) AS n FROM public.training_videos WHERE r2_key_en IS NOT NULL`);
      console.log(`  rows with r2_key_en: ${r.rows[0].n}`);
      await client.end();
      process.exit(0);
    } catch (e) {
      console.log(`  failed: ${e.message.slice(0, 120)}`);
      try { await client.end(); } catch {}
    }
  }
  console.error('all connection attempts failed');
  process.exit(2);
})();
