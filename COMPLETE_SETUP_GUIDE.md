# 🚀 Complete Onboarding System Setup Guide

**Total Setup Time: 2-3 hours**

This guide walks you through setting up the entire agent onboarding workflow from scratch. By the end, your system will be fully functional and ready for live agent onboarding.

---

## Prerequisites

Before starting, make sure you have:
- ✅ Admin access to Google Workspace
- ✅ Ability to create API keys
- ✅ Portal running locally (`npm run dev`)
- ✅ Text editor for environment variables
- ✅ Email accounts to test with

---

## Phase 1: DocuSign Setup (10 minutes)

### Step 1.1: Create DocuSign Developer Account

1. Go to **https://developers.docusign.com/**
2. Click **Sign Up for Free**
3. Choose **Developer Account** (not production)
4. Fill in your details and confirm email
5. Login to DocuSign Dev Center

### Step 1.2: Create an Application

1. Go to **Settings > Apps and Keys**
2. Click **Create App** 
3. Enter App Name: **HartFelt Onboarding**
4. Check **OAuth Implicit**
5. Click **Create App**
6. **Copy and save:**
   - Client ID
   - Client Secret (you'll need this immediately)
   - Account ID (under "Account Information")

### Step 1.3: Generate RSA Key Pair

1. In your app settings, find **Signing On Behalf Of Someone** section
2. Click **Generate RSA Key Pair**
3. A private key will be displayed
4. **Copy the ENTIRE key** including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`
5. Save this in a secure location

### Step 1.4: Add Webhook URL (For Production)

1. In your app settings, find **Webhooks** section
2. Add webhook URL: `https://yourdomain.com/api/onboarding/webhook`
3. Subscribe to events: `envelope-signed`, `envelope-completed`

**For now, save your DocuSign credentials - we'll add them to .env.local later.**

---

## Phase 2: Google Workspace Setup (20 minutes)

### Step 2.1: Create Google Cloud Project

1. Go to **https://console.cloud.google.com/**
2. Click **Select a Project** > **New Project**
3. Enter Project Name: **HartFelt Onboarding**
4. Click **Create**
5. Wait 2-3 minutes for the project to initialize

### Step 2.2: Enable Admin SDK API

1. In Google Cloud Console, search for **Admin SDK API**
2. Click on it
3. Click **Enable**
4. Wait for it to enable

### Step 2.3: Create Service Account

1. Go to **Navigation Menu > APIs & Services > Credentials**
2. Click **Create Credentials > Service Account**
3. Enter Service Account Name: **HartFelt Onboarding**
4. Click **Create and Continue**
5. Skip optional steps, click **Done**

### Step 2.4: Create Service Account Key

1. In **Service Accounts** list, click the account you just created
2. Go to **Keys tab**
3. Click **Add Key > Create new key**
4. Select **JSON**
5. Click **Create**
6. A JSON file will download
7. **Open the JSON file and copy the entire contents** - we'll paste this in .env.local

**The JSON will look like:**
```json
{
  "type": "service_account",
  "project_id": "hartfelt-onboarding-12345",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "hartfelt-onboarding@...",
  "client_id": "...",
  "auth_uri": "...",
  "token_uri": "...",
  "auth_provider_x509_cert_url": "...",
  "client_x509_cert_url": "..."
}
```

### Step 2.5: Authorize Service Account in Google Workspace

1. Go to Google Workspace Admin (https://admin.google.com/)
2. Go to **Security > API Controls > Domain-wide Delegation**
3. Click **Add new**
4. Enter Client ID from your service account JSON (find `client_id` field)
5. Click **Authorize**
6. When prompted for scopes, enter: `https://www.googleapis.com/auth/admin.directory.user`
7. Click **Authorize**

This gives the service account permission to create user accounts.

---

## Phase 3: SendGrid Setup (10 minutes)

### Step 3.1: Create SendGrid Account

1. Go to **https://sendgrid.com/**
2. Click **Sign Up**
3. Fill in your details
4. Confirm your email

### Step 3.2: Create API Key

1. In SendGrid Dashboard, go to **Settings > API Keys**
2. Click **Create API Key**
3. Enter Name: **HartFelt Onboarding**
4. Select **Full Access**
5. Click **Create & Copy**
6. **Save this key** - you won't see it again!

### Step 3.3: Verify Sender Email

1. Go to **Settings > Sender Authentication**
2. Click **Verify an Address**
3. Enter:
   - Email: `noreply@hartfeltrealestate.com`
   - Name: `HartFelt Real Estate`
4. Click **Create**
5. Check the email inbox at `noreply@hartfeltrealestate.com`
6. Click the verification link in SendGrid's email

---

## Phase 4: Supabase Setup (15 minutes)

### Step 4.1: Create Onboarding Table

1. In Supabase, go to **SQL Editor**
2. Click **New Query**
3. Paste this SQL:

```sql
CREATE TABLE onboarding_invites (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  first_name VARCHAR NOT NULL,
  last_name VARCHAR NOT NULL,
  email VARCHAR NOT NULL UNIQUE,
  status VARCHAR DEFAULT 'pending_invite' CHECK (
    status IN ('pending_invite', 'signing', 'signed', 'awaiting_approval', 'approved', 'provisioned')
  ),
  docusign_envelope_id VARCHAR UNIQUE,
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

4. Click **Run**
5. ✅ Table created successfully

### Step 4.2: Get Your Credentials

1. In Supabase, go to **Settings > API**
2. Copy:
   - **Project URL** (should be in your .env.local already)
   - **Anon Key** (should be in your .env.local already as NEXT_PUBLIC_SUPABASE_ANON_KEY)
   - **Service Role Key** (copy this - you'll need it for .env.local)

---

## Phase 5: Add Environment Variables (5 minutes)

Open `.env.local` in your Portal project and add:

```env
# DocuSign
NEXT_PUBLIC_DOCUSIGN_CLIENT_ID=your_client_id_from_step_1_2
DOCUSIGN_CLIENT_SECRET=your_client_secret_from_step_1_2
DOCUSIGN_API_ACCOUNT_ID=your_account_id_from_step_1_2
DOCUSIGN_WEBHOOK_SECRET=your_webhook_secret_from_step_1_2

# Google Workspace (PASTE ENTIRE JSON)
GOOGLE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"...","private_key":"...","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}'
GOOGLE_ADMIN_EMAIL=your-admin@hartfeltrealestate.com

# SendGrid
SENDGRID_API_KEY=your_sendgrid_api_key_from_step_3_2
SENDGRID_FROM_EMAIL=noreply@hartfeltrealestate.com

# Supabase (probably already set)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_from_step_4_2
```

**⚠️ IMPORTANT:**
- The `GOOGLE_SERVICE_ACCOUNT` must be the entire JSON file as a string
- Paste it exactly as-is, but surround with single quotes
- Don't forget the trailing comma after closing brace!

Save and restart your Portal: `npm run dev`

---

## Phase 6: Test the Complete Workflow (10 minutes)

### Test 1: Access Admin Onboarding Page

```
1. Go to http://localhost:3000/dashboard
2. Login as admin/broker user
3. Scroll down to "Admin Tools" section
4. Click "Onboarding" card
   OR go directly to: http://localhost:3000/admin/onboarding
```

**✅ You should see three tabs: Documents, Invites, Approvals**

### Test 2: Upload Document

```
1. On "Documents" tab, click "Upload Document"
2. Enter Name: "HartFelt Agent Agreement"
3. Click "Upload PDF" and select any PDF from your computer
4. Click "Upload Document"
5. ✅ Document appears in Documents tab
```

### Test 3: Send Signing Invite

```
1. Click "Invites" tab
2. Click "Send New Invite" button
3. Fill in:
   - First Name: Jane
   - Last Name: Doe
   - Email: jane.test.real@gmail.com (use a real email you can access)
4. Click "Send Signing Invite"
5. ✅ Invite appears with status "Pending Invite"
6. Note: A signing link is generated (in production, agent gets email)
```

### Test 4: Simulate Document Signing

Since we're testing locally without DocuSign, we simulate the signing:

```
1. Go to Supabase > Table Editor > onboarding_invites
2. Find the Jane Doe record
3. Click to edit:
   - Change status to: "signed"
   - Set signed_at to: now() (or current timestamp)
4. Save
5. Go back to Portal onboarding page
6. Click "Approvals" tab
7. ✅ Jane Doe appears with status "Awaiting Approval"
```

### Test 5: Approve Agent

```
1. On "Approvals" tab, you see Jane Doe
2. Click "Approve & Create Email"
3. ✅ Status changes to "Approved"
4. ✅ Email account created: jane.doe@hartfeltrealestate.com
5. Verify in Google Workspace Admin:
   Go to Users > find jane.doe@hartfeltrealestate.com
   ✅ Account exists with correct name
```

### Test 6: Send Credentials

```
1. Still on "Approvals" tab
2. Click "Send Credentials to Agent"
3. ✅ Status changes to "Provisioned"
4. ✅ Jane Doe appears in "Recently Provisioned" section
5. Check jane.test.real@gmail.com inbox (check spam folder too)
6. ✅ Welcome email received with:
   - Email: jane.doe@hartfeltrealestate.com
   - Temporary password
   - Portal link
   - EASE app download link
```

### Test 7: Agent Login

```
1. Go to http://localhost:3000/login
2. Login with:
   - Email: jane.doe@hartfeltrealestate.com
   - Password: (from welcome email)
3. ✅ Successfully logged in as agent
4. ✅ Can access Portal dashboard
```

### Test 8: Verify Complete Flow

```
✅ All steps worked = Complete end-to-end workflow is functional!

You should see:
- Document uploaded successfully
- Agent invited with signing link
- Document marked as signed
- Admin approved and created email
- Agent account created in Google Workspace
- Agent account created in Supabase
- Welcome email sent
- Agent successfully logged in
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Google API not responding" | Check Google Cloud project has Admin SDK enabled |
| "DocuSign signature invalid" | Verify DOCUSIGN_WEBHOOK_SECRET is correct |
| "Email already exists" | Check if Google account already created; delete in Google Workspace first |
| "User can't login" | Verify Supabase user created with correct email in Auth table |
| "Welcome email not received" | Check spam folder; verify SENDGRID_FROM_EMAIL is verified |
| "Can't upload document" | Check browser console for errors; verify Portal is running |

---

## What's Next?

### For Production Deployment:

1. **DocuSign Webhook**: Set webhook URL to your production domain
2. **Email Verification**: Have agents sign real DocuSign envelopes
3. **Automated Alerts**: Set up Slack/email notifications to admins
4. **Custom Documents**: Upload your actual onboarding documents
5. **Training**: Train admin team on `/admin/onboarding` page

### Additional Features (Optional):

- Add multi-document signing support
- Implement automated Slack notifications
- Add document preview in Portal
- Create agent welcome checklist
- Set up compliance verification
- Add bulk agent invite

---

## Summary

You now have a **fully functional agent onboarding system** that:

✅ Accepts agent signatures via DocuSign
✅ Automatically creates Google Workspace email accounts
✅ Provisions Portal accounts in Supabase
✅ Sends welcome emails with credentials
✅ Allows agents to login with new email

**The workflow is complete and ready for live agent onboarding!**

For any questions, refer to:
- `ONBOARDING_SETUP.md` - Detailed technical setup
- `PORTAL_COMPLETE_SUMMARY.md` - System overview
- `app/admin/onboarding/page.tsx` - Admin interface code
