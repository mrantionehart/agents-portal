// API Route: Link MLS Listing to Transaction
// POST: Link an MLS listing to a transaction and auto-populate fields
// GET: Get linked MLS listing for transaction
// DELETE: Unlink MLS listing from transaction

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { LinkTransactionRequest, TransactionMLSLink } from '@/types/integrations'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = request.headers.get('X-User-ID')
    if (!userId) {
      return NextResponse.json(
        { error: 'Missing authentication' },
        { status: 401 }
      )
    }

    const transaction_id = params.id

    // Verify user has access to this transaction
    const { data: transaction } = await supabase
      .from('transactions')
      .select('id, agent_id, broker_id')
      .eq('id', transaction_id)
      .single()

    if (!transaction || (transaction.agent_id !== userId && transaction.broker_id !== userId)) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // Get the MLS link
    const { data: link, error } = await supabase
      .from('transaction_mls_link')
      .select('*')
      .eq('transaction_id', transaction_id)
      .single()

    if (error && error.code !== 'PGRST116') {
      return NextResponse.json(
        { error: 'Failed to fetch MLS link' },
        { status: 500 }
      )
    }

    if (!link) {
      return NextResponse.json(
        { data: null, message: 'No MLS listing linked' },
        { status: 200 }
      )
    }

    // Get full MLS listing details
    const { data: mls_listing } = await supabase
      .from('mls_listings')
      .select('*')
      .eq('mls_number', link.mls_number)
      .single()

    return NextResponse.json({
      data: {
        link,
        listing: mls_listing,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Get MLS link error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = request.headers.get('X-User-ID')
    if (!userId) {
      return NextResponse.json(
        { error: 'Missing authentication' },
        { status: 401 }
      )
    }

    const transaction_id = params.id
    const body: LinkTransactionRequest = await request.json()

    if (!body.mls_number) {
      return NextResponse.json(
        { error: 'MLS number is required' },
        { status: 400 }
      )
    }

    // Verify user has access to this transaction
    const { data: transaction } = await supabase
      .from('transactions')
      .select('id, agent_id, broker_id')
      .eq('id', transaction_id)
      .single()

    if (!transaction || (transaction.agent_id !== userId && transaction.broker_id !== userId)) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // Verify MLS listing exists
    const { data: mls_listing, error: mlsError } = await supabase
      .from('mls_listings')
      .select('*')
      .eq('mls_number', body.mls_number)
      .single()

    if (mlsError || !mls_listing) {
      return NextResponse.json(
        { error: 'MLS listing not found' },
        { status: 404 }
      )
    }

    // Check if already linked
    const { data: existingLink } = await supabase
      .from('transaction_mls_link')
      .select('id')
      .eq('transaction_id', transaction_id)
      .eq('mls_number', body.mls_number)
      .single()

    if (existingLink) {
      return NextResponse.json(
        { error: 'This MLS listing is already linked to the transaction' },
        { status: 409 }
      )
    }

    // Unlink any previous MLS listings for this transaction
    await supabase
      .from('transaction_mls_link')
      .delete()
      .eq('transaction_id', transaction_id)

    // Create the link
    const { data: link, error: linkError } = await supabase
      .from('transaction_mls_link')
      .insert({
        transaction_id,
        mls_number: body.mls_number,
        linked_by: userId,
        status: 'linked',
        auto_populated_fields: ['address', 'property_details', 'listing_agent_info'],
      })
      .select()
      .single()

    if (linkError) {
      return NextResponse.json(
        { error: 'Failed to create MLS link', details: linkError.message },
        { status: 500 }
      )
    }

    // Update transaction with MLS data
    const { error: updateError } = await supabase
      .from('transactions')
      .update({
        address: mls_listing.address,
        city: mls_listing.city,
        state: mls_listing.state,
        zip: mls_listing.zip,
        updated_at: new Date().toISOString(),
      })
      .eq('id', transaction_id)

    if (updateError) {
      console.error('Failed to update transaction with MLS data:', updateError)
    }

    // Log the activity
    await supabase.from('activity_logs').insert({
      transaction_id,
      action_type: 'mls_linked',
      action_description: `Linked MLS listing ${body.mls_number}`,
      performed_by: userId,
      metadata: { mls_number: body.mls_number },
    })

    return NextResponse.json({
      data: {
        link,
        listing: mls_listing,
      },
      message: 'MLS listing linked successfully',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Link MLS to transaction error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = request.headers.get('X-User-ID')
    if (!userId) {
      return NextResponse.json(
        { error: 'Missing authentication' },
        { status: 401 }
      )
    }

    const transaction_id = params.id

    // Verify user has access
    const { data: transaction } = await supabase
      .from('transactions')
      .select('id, agent_id, broker_id')
      .eq('id', transaction_id)
      .single()

    if (!transaction || (transaction.agent_id !== userId && transaction.broker_id !== userId)) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // Delete the link
    const { error } = await supabase
      .from('transaction_mls_link')
      .delete()
      .eq('transaction_id', transaction_id)

    if (error) {
      return NextResponse.json(
        { error: 'Failed to unlink MLS listing' },
        { status: 500 }
      )
    }

    // Log the activity
    await supabase.from('activity_logs').insert({
      transaction_id,
      action_type: 'mls_unlinked',
      action_description: 'Unlinked MLS listing',
      performed_by: userId,
    })

    return NextResponse.json({
      message: 'MLS listing unlinked successfully',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Unlink MLS error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
