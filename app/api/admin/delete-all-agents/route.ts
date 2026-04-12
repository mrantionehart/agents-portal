import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function deleteAllAgents() {
  try {
    console.log('Fetching all agents...');

    // First fetch all agents
    const { data: agents, error: fetchError } = await supabase
      .from('agents')
      .select('id');

    if (fetchError) {
      console.error('Error fetching agents:', fetchError);
      throw new Error(fetchError.message);
    }

    if (!agents || agents.length === 0) {
      return { message: 'No agents to delete', deleted: 0 };
    }

    console.log(`Found ${agents.length} agents. Deleting...`);

    // Get all IDs and delete them
    const ids = agents.map((a) => a.id);
    const { error: deleteError } = await supabase
      .from('agents')
      .delete()
      .in('id', ids);

    if (deleteError) {
      console.error('Error deleting agents:', deleteError);
      throw new Error(deleteError.message);
    }

    console.log(`✓ Deleted ${agents.length} agents successfully`);
    return {
      message: `All ${agents.length} agents deleted successfully`,
      deleted: agents.length
    };
  } catch (err) {
    console.error('Failed to delete agents:', err);
    throw err;
  }
}

export async function GET(req: NextRequest) {
  try {
    const result = await deleteAllAgents();
    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to delete agents' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const result = await deleteAllAgents();
    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to delete agents' }, { status: 500 });
  }
}
