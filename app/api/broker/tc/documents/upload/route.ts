import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const userId = req.headers.get('X-User-ID')
    const userRole = req.headers.get('X-User-Role')

    if (!userId || !userRole) {
      return NextResponse.json(
        { success: false, error: 'Missing authentication headers' },
        { status: 401 }
      )
    }

    // Only agents and TCs can upload documents
    if (!['agent', 'tc'].includes(userRole)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized to upload documents' },
        { status: 403 }
      )
    }

    const formData = await req.formData()
    const file = formData.get('file') as File
    const docType = formData.get('doc_type') as string
    const transactionId = formData.get('transaction_id') as string

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'File is required' },
        { status: 400 }
      )
    }

    if (!docType) {
      return NextResponse.json(
        { success: false, error: 'Document type is required' },
        { status: 400 }
      )
    }

    if (!transactionId) {
      return NextResponse.json(
        { success: false, error: 'Transaction ID is required' },
        { status: 400 }
      )
    }

    // Verify transaction exists and user has access to it
    const { data: transaction, error: txnError } = await supabase
      .from('tc_transactions')
      .select('id, agent_id, tc_id')
      .eq('id', transactionId)
      .single()

    if (txnError || !transaction) {
      return NextResponse.json(
        { success: false, error: 'Transaction not found' },
        { status: 404 }
      )
    }

    // Check user has access to this transaction
    const hasAccess =
      userRole === 'agent'
        ? transaction.agent_id === userId
        : userRole === 'tc'
          ? transaction.tc_id === userId
          : false

    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized to upload to this transaction' },
        { status: 403 }
      )
    }

    // Upload file to Supabase Storage
    const fileBuffer = await file.arrayBuffer()
    const fileName = `${transactionId}/${Date.now()}-${file.name}`
    const bucketName = 'tc-documents'

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(fileName, fileBuffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('Error uploading file:', uploadError)
      return NextResponse.json(
        { success: false, error: 'Failed to upload file' },
        { status: 400 }
      )
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(fileName)
    const fileUrl = urlData.publicUrl

    // Create document record in database
    const { data: document, error: docError } = await supabase
      .from('tc_documents')
      .insert({
        transaction_id: transactionId,
        doc_type: docType,
        file_url: fileUrl,
        file_name: file.name,
        uploaded_by: userId,
        status: 'pending',
      })
      .select()
      .single()

    if (docError) {
      console.error('Error creating document record:', docError)
      // Try to delete the uploaded file if database insert fails
      await supabase.storage.from(bucketName).remove([fileName]).catch(() => {})
      return NextResponse.json(
        { success: false, error: 'Failed to create document record' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Document uploaded successfully',
        data: document,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error in document upload endpoint:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
