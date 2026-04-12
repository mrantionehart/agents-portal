# Agent Onboarding System - Complete Setup Guide

## Overview

The complete agent onboarding workflow has been implemented with these steps:

1. **Admin uploads** onboarding documents (PDF templates)
2. **Admin sends** signing invitation to new agent
3. **Agent signs** documents in DocuSign
4. **Webhook** automatically detects signed documents → marks as "Signed"
5. **Admin reviews** in Portal and clicks "Approve"
6. **Email account** created automatically at `firstname.lastname@hartfeltrealestate.com`
7. **Portal user** created in Supabase with brokerage email
8. **Welcome email** sent with credentials
9. **Agent logs in** to Portal and EASE app

## Files Created

| File | Purpose |
|------|---------|
| `app/admin/onboarding/page.tsx` | Main onboarding admin dashboard |
| `app/api/onboarding/webhook/route.ts` | DocuSign webhook handler |
| `app/api/onboarding/provision/route.ts` | Email + user account provisioning |
| `lib/vault-client.ts` | Updated with onboarding API methods |

## Environment Variables Required

Add these to your `.env.local`:

```env
# DocuSign Configuration
NEXT_PUBLIC_DOCUSIGN_CLIENT_ID=YOUR_DOCUSIGN_CLIENT_ID
DOCUSIGN_CLIENT_SECRET=YOUR_DOCUSIGN_SECRET
DOCUSIGN_API_ACCOUNT_ID=YOUR_ACCOUNT_ID
DOCUSIGN_WEBHOOK_SECRET=YOUR_WEBHOOK_SECRET

# Google Workspace (Directory API)
GOOGLE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"...","private_key":"...","client_email":"...","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token"}'
GOOGLE_ADMIN_EMAIL=admin@hartfeltrealestate.com

# Email Service (SendGrid)
SENDGRID_API_KEY=YOUR_SENDGRID_KEY
SENDGRID_FROM_EMAIL=noreply@hartfeltrealestate.com

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Database Schema

Create this table in Supabase:

```sql
CREATE TABLE onboarding_invites (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  first_name VARCHAR NOT NULL,
  last_name VARCHAR NOT NULL,
  email VARCHAR NOT NULL UNIQUE,
  status VARCHAR DEFAULT 'pending_invite' CHECK (
    status IN ('pending_invite', 'signing', 'signed', 'awaiting_approval', 'approved', 'provisioned')
  ),
  docusign_envelope_id VARCHAR,
  provisioned_email VARCHAR UNIQUE,
  supabase_user_id UUID REFERENCES auth.users(id),
  signed_at TIMESTAMP,
  approved_at TIMESTAMP,
  provisioned_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_onboarding_email ON onboarding_invites(email);
CREATE INDEX idx_onboarding_status ON onboarding_invites(status);
CREATE INDEX idx_onboarding_docusign ON onboarding_invites(docusign_envelope_id);
```

## Setup Steps

### 1. DocuSign Integration

1. Go to https://developers.docusign.com/
2. Create app in "Settings" → "Apps and Keys"
3. Generate RSA key pair
4. Get your Client ID, Secret, and Account ID
5. Set up webhook URL: `https://yourdomain.com/api/onboarding/webhook`
6. Add to `.env.local`

### 2. Google Workspace Setup

1. Go to Google Cloud Console
2. Enable Directory API
3. Create Service Account
4. Download JSON key file
5. Copy the entire JSON to `GOOGLE_SERVICE_ACCOUNT` env variable
6. In Google Workspace Admin:
   - Grant service account admin role
   - Authorize the API scope for user creation
7. Set `GOOGLE_ADMIN_EMAIL` to your admin email

### 3. SendGrid Setup

1. Go to sendgrid.com
2. Create API key with "Mail Send" permission
3. Add to `.env.local` as `SENDGRID_API_KEY`
4. Verify sender email: `noreply@hartfeltrealestate.com`

### 4. Supabase Setup

1. Create the `onboarding_invites` table (SQL above)
2. Enable auth in Supabase
3. Get your service role key from Settings → API

## How It Works - Step by Step

### Admin Dashboard (`/admin/onboarding`)

**Documents Tab:**
- Upload PDF templates that agents will sign
- Stored in Portal (placeholder for production)

**Invites Tab:**
- Enter agent: First Name, Last Name, Email
- System generates DocuSign envelope with all documents
- Sends agent a signing link
- Status updates: `pending_invite` → `signing` → `signed`

**Approvals Tab:**
- Shows all agents with signed documents
- Admin clicks "Approve & Create Email"
- Status: `signed` → `approved`
- Email account created via Google Workspace API
- Status: `approved` → `provisioned`
- Credentials sent to agent

### DocuSign Webhook

When agent signs documents:
```
DocuSign → POST /api/onboarding/webhook
  ↓
Extract envelope ID, agent email, signing time
  ↓
Update onboarding_invites status to "signed"
  ↓
Send notification to brokers (TODO: add Slack/email alerts)
```

### Provisioning Flow

When admin clicks "Send Credentials":
```
POST /api/onboarding/provision
  ↓
1. Create Google Workspace account
   - Email: firstname.lastname@hartfeltrealestate.com
   - Generate temp password
  ↓
2. Create Supabase user
   - Email: firstname.lastname@hartfeltrealestate.com
   - Temp password (user will reset on first login)
  ↓
3. Update onboarding_invites
   - Status: "provisioned"
   - Store supabase_user_id
  ↓
4. Send welcome email
   - To: agent's personal email
   - Credentials for Portal and EASE app
   - Links to download EASE
```

## Status Flow

```
pending_invite
    ↓
Admin sends signing link
    ↓
signing (agent receives email)
    ↓
Agent signs in DocuSign
    ↓
signed (webhook detected)
    ↓
awaiting_approval (admin notified)
    ↓
Admin clicks "Approve"
    ↓
approved (email account created)
    ↓
Admin clicks "Send Credentials"
    ↓
provisioned (both systems ready)
    ↓
Agent logs in with firstname.lastname@hartfeltrealestate.com
```

## Security Considerations

1. **Webhook Verification**: Webhook secret signed by DocuSign
2. **Temporary Passwords**: Auto-generated, 16 characters, must change on first login
3. **Service Account**: Limited to user creation only (not admin access)
4. **Email Verification**: Both Supabase and Google require email confirmation
5. **Audit Trail**: All onboarding events logged with timestamps

## Alerts & Notifications

The system includes notifications for:
- Document signed (admin alert)
- Agent provisioned (admin confirmation)
- Agent ready (agent welcome email)

TODO: Integrate with:
- Slack notifications for brokers
- ComplianceNotifications component for in-app alerts
- Email alerts to backup admin address

## Testing the Flow

1. Go to `/admin/onboarding`
2. Upload a test document
3. Send invite to test email
4. Copy signing link
5. Visit signing link (in production, DocuSign handles)
6. Mark as approved
7. Send credentials
8. Verify email created in Google Workspace
9. Verify user created in Supabase auth
10. Test login with new credentials

## Common Issues & Troubleshooting

| Issue | Solution |
|-------|----------|
| "Google API not responding" | Check service account has Directory API enabled |
| "DocuSign signature invalid" | Verify webhook secret matches |
| "Email already exists" | Check if Google account already created manually |
| "User can't login" | Verify Supabase user created with correct email |

## Next Steps

1. Get DocuSign, Google Workspace, and SendGrid credentials
2. Add environment variables to `.env.local`
3. Run database migration to create `onboarding_invites` table
4. Test the complete flow
5. Deploy to production
6. Train admin on `/admin/onboarding` page

## Integration with Vault API

In production, update endpoints to use Vault API:

```typescript
// Current (local implementation)
POST /api/onboarding/provision

// Production (Vault)
POST /vault/api/onboarding/provision
```

Update `lib/vault-client.ts` to point to Vault endpoints when ready.

## Questions?

For implementation details on any step, refer to:
- DocuSign: https://developers.docusign.com/
- Google Admin API: https://developers.google.com/admin-sdk
- SendGrid: https://docs.sendgrid.com/
