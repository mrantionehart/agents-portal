import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Agent Provisioning Endpoint
// Creates email account, Portal user, and sends welcome email

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const GOOGLE_SERVICE_ACCOUNT = process.env.GOOGLE_SERVICE_ACCOUNT // JSON string
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY

export async function POST(request: NextRequest) {
  try {
    const { inviteId, firstName, lastName, email } = await request.json()

    if (!inviteId || !firstName || !lastName || !email) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Step 1: Create Google Workspace email account
    const brokerageEmail = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@hartfeltrealestate.com`
    const tempPassword = generateTemporaryPassword()

    const googleSuccess = await createGoogleWorkspaceAccount({
      firstName,
      lastName,
      email: brokerageEmail,
      password: tempPassword,
    })

    if (!googleSuccess) {
      return NextResponse.json(
        { error: 'Failed to create Google Workspace account' },
        { status: 500 }
      )
    }

    // Step 2: Create Portal user in Supabase
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!)

    const { data: user, error: createUserError } = await supabase.auth.admin.createUser({
      email: brokerageEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: `${firstName} ${lastName}`,
        first_name: firstName,
        last_name: lastName,
      },
    })

    if (createUserError || !user) {
      console.error('Error creating Supabase user:', createUserError)
      return NextResponse.json(
        { error: 'Failed to create Portal account' },
        { status: 500 }
      )
    }

    // Step 3: Update onboarding record
    const { error: updateError } = await supabase
      .from('onboarding_invites')
      .update({
        status: 'provisioned',
        provisioned_email: brokerageEmail,
        provisioned_at: new Date().toISOString(),
        supabase_user_id: (user as any).id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', inviteId)

    if (updateError) {
      console.error('Error updating onboarding record:', updateError)
      return NextResponse.json(
        { error: 'Failed to update onboarding status' },
        { status: 500 }
      )
    }

    // Step 4: Send welcome email with credentials
    const emailSent = await sendWelcomeEmail({
      firstName,
      lastName,
      email: brokerageEmail,
      personalEmail: email,
      tempPassword,
    })

    if (!emailSent) {
      console.error('Warning: Email failed to send, but account was created')
    }

    return NextResponse.json({
      success: true,
      message: 'Agent provisioned successfully',
      brokerageEmail,
      userId: (user as any).id,
    })
  } catch (error) {
    console.error('Provisioning error:', error)
    return NextResponse.json(
      { error: 'Provisioning failed' },
      { status: 500 }
    )
  }
}

async function createGoogleWorkspaceAccount(params: {
  firstName: string
  lastName: string
  email: string
  password: string
}): Promise<boolean> {
  try {
    // Parse the service account JSON
    const serviceAccount = JSON.parse(GOOGLE_SERVICE_ACCOUNT || '{}')

    // TODO: Use Google Admin API to create user
    // This requires:
    // 1. Service account with Admin API access
    // 2. OAuth2 authentication flow
    // 3. Call to googleapis/admin:directory_v1.users.create()

    // For now, this is a placeholder
    console.log(`Creating Google Workspace account: ${params.email}`)

    // In production, you would:
    // const adminSdk = require('googleapis').google.admin('directory_v1')
    // const auth = new google.auth.JWT({...serviceAccount})
    // await adminSdk.users.create({
    //   auth,
    //   requestBody: {
    //     primaryEmail: params.email,
    //     password: params.password,
    //     givenName: params.firstName,
    //     familyName: params.lastName,
    //     hashFunction: 'SHA-1',
    //   },
    // })

    return true
  } catch (error) {
    console.error('Google Workspace creation error:', error)
    return false
  }
}

async function sendWelcomeEmail(params: {
  firstName: string
  lastName: string
  email: string
  personalEmail: string
  tempPassword: string
}): Promise<boolean> {
  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: params.personalEmail }],
            subject: `Welcome to HartFelt! Your Portal Access`,
          },
        ],
        from: {
          email: 'noreply@hartfeltrealestate.com',
          name: 'HartFelt Real Estate',
        },
        content: [
          {
            type: 'text/html',
            value: `
              <h2>Welcome to HartFelt, ${params.firstName}! 🎉</h2>
              <p>Your brokerage account has been created and you're ready to get started.</p>

              <h3>Your Portal Credentials</h3>
              <p>
                <strong>Email:</strong> ${params.email}<br>
                <strong>Temporary Password:</strong> ${params.tempPassword}
              </p>

              <h3>Get Started</h3>
              <p>
                <strong>Portal:</strong> <a href="https://portal.hartfelt.com">portal.hartfelt.com</a><br>
                <strong>EASE App:</strong> Download from your device's app store
              </p>

              <p>
                <strong>Important:</strong> Please change your password on first login for security.
              </p>

              <p>
                Questions? Contact our support team at support@hartfeltrealestate.com
              </p>
            `,
          },
        ],
      }),
    })

    if (!response.ok) {
      console.error('SendGrid error:', await response.text())
      return false
    }

    return true
  } catch (error) {
    console.error('Email sending error:', error)
    return false
  }
}

function generateTemporaryPassword(): string {
  // Generate a secure temporary password
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
  let password = ''
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}
