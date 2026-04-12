import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const VAULT_API_URL = process.env.NEXT_PUBLIC_VAULT_API_URL || 'http://192.168.6.88:3000'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || ''
    
    // Forward the request to Vault API
    const response = await fetch(`${VAULT_API_URL}/deals`, {
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Error fetching deals from Vault:', error)
    return NextResponse.json(
      { error: 'Failed to fetch deals' },
      { status: 500 }
    )
  }
}
