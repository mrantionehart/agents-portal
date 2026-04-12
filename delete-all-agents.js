require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function deleteAllAgents() {
  try {
    console.log('Fetching all agents...');

    // First, get all agents
    const { data: agents, error: fetchError } = await supabase
      .from('agents')
      .select('id');

    if (fetchError) {
      console.error('Error fetching agents:', fetchError);
      process.exit(1);
    }

    if (agents.length === 0) {
      console.log('No agents to delete');
      process.exit(0);
    }

    console.log(`Found ${agents.length} agents. Deleting...`);

    // Delete all agents
    const { error: deleteError } = await supabase
      .from('agents')
      .delete()
      .gt('id', '');

    if (deleteError) {
      console.error('Error deleting agents:', deleteError);
      process.exit(1);
    }

    console.log('✓ All agents deleted successfully');
    process.exit(0);
  } catch (err) {
    console.error('Failed:', err);
    process.exit(1);
  }
}

deleteAllAgents();
