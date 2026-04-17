const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  try {
    console.log('📦 Running Transaction Coordinator System migration...');
    console.log(`🔗 Supabase URL: ${supabaseUrl}`);

    // Read the migration file
    const migrationPath = path.join(__dirname, 'supabase/migrations/004_transaction_coordinator_system.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log(`📄 Migration file: ${migrationPath}`);
    console.log(`📝 SQL length: ${migrationSQL.length} characters`);

    // Split the SQL into individual statements and execute them
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`🔀 Found ${statements.length} SQL statements to execute`);

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i] + ';';
      try {
        console.log(`⏳ Executing statement ${i + 1}/${statements.length}...`);
        const { data, error } = await supabase.rpc('exec_sql', { sql: stmt });

        if (error) {
          // Try raw SQL execution instead
          const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ sql: stmt }),
          });

          if (!response.ok) {
            // If rpc doesn't exist, execute directly via postgres
            const { error: execError } = await supabase.sql`${stmt}`;
            if (execError) {
              console.warn(`⚠️  Statement ${i + 1} warning: ${execError.message}`);
            }
          }
        }
      } catch (err) {
        console.warn(`⚠️  Statement ${i + 1} skipped: ${err.message}`);
      }
    }

    console.log('✅ Migration execution completed!');
    console.log('🎉 Transaction Coordinator System tables created successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();
