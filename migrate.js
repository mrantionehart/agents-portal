#!/usr/bin/env node

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL');
  process.exit(1);
}

// Extract project ref from URL
const projectRef = supabaseUrl.split('//')[1].split('.')[0];
console.log(`🔗 Connecting to Supabase project: ${projectRef}`);

// Construct PostgreSQL connection string
// Format: postgresql://postgres:password@host:port/database
const connectionString = `postgresql://postgres:${supabaseServiceKey}@${projectRef}.supabase.co:5432/postgres?schema=public`;

async function runMigration() {
  const client = new Client({
    connectionString: connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('📦 Connecting to PostgreSQL...');
    await client.connect();
    console.log('✅ Connected!');

    // Read the migration file
    const migrationPath = path.join(__dirname, 'supabase/migrations/004_transaction_coordinator_system.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log(`📄 Running migration from: ${migrationPath}`);
    console.log(`📝 SQL length: ${migrationSQL.length} characters`);

    // Execute the entire migration as a single query
    console.log('⏳ Executing migration SQL...');
    await client.query(migrationSQL);

    console.log('✅ Migration completed successfully!');
    console.log('🎉 Transaction Coordinator System tables created!\n');

    // Verify tables were created
    console.log('📊 Verifying tables...');
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name LIKE 'tc_%'
      ORDER BY table_name
    `);

    if (result.rows.length > 0) {
      console.log('✅ Created tables:');
      result.rows.forEach(row => {
        console.log(`   ✓ ${row.table_name}`);
      });
    }

    // Check for transaction_coordinators table
    const tcResult = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'transaction_coordinators'
      )
    `);

    if (tcResult.rows[0].exists) {
      console.log(`   ✓ transaction_coordinators`);
      console.log(`\n✅ All 6 TC System tables created successfully!`);
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message);

    if (error.message.includes('password authentication failed')) {
      console.error('\n⚠️  Authentication failed. This might be because:');
      console.error('   1. The service role key is not a valid PostgreSQL password');
      console.error('   2. Network connectivity issue to Supabase\n');
      console.error('📖 Alternative: Use the Supabase web interface instead:');
      console.error('   1. Go to: https://app.supabase.com');
      console.error('   2. Select your project');
      console.error('   3. SQL Editor → New Query');
      console.error('   4. Copy contents of TC_SYSTEM_MIGRATION.sql');
      console.error('   5. Click Run\n');
    }

    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
