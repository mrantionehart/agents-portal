const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://qqkvooljievqfupgfhix.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxa3Zvb2xqaWV2cWZ1cGdmaGl4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTIyOTQxNiwiZXhwIjoyMDkwODA1NDE2fQ.vJP3gk56JOxwvo8Et2tBt3jYisMSMw-CxIAi2dtul-A';

const supabase = createClient(supabaseUrl, supabaseKey);

async function deleteAllAgents() {
  try {
    // First get all agent IDs
    const { data: agents, error: fetchError } = await supabase
      .from('agents')
      .select('id');

    if (fetchError) {
      console.error('Error fetching agents:', fetchError);
      return;
    }

    if (agents.length === 0) {
      console.log('No agents to delete');
      return;
    }

    // Delete all agents
    const { error: deleteError } = await supabase
      .from('agents')
      .delete()
      .gt('id', '');

    if (deleteError) {
      console.error('Error deleting agents:', deleteError);
    } else {
      console.log(`✓ Deleted ${agents.length} agents successfully`);
    }
  } catch (err) {
    console.error('Fatal error:', err);
  }
}

deleteAllAgents();
