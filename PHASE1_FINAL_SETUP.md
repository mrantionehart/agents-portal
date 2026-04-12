# Phase 1: Backend Setup - Final Configuration Guide

All Phase 1 backend files have been created. This guide will help you complete the final setup steps.

## Files Created

### Library Files (Helper Functions)
- **lib/types.ts** - TypeScript interfaces for Agent, API responses, DocuSign payloads
- **lib/docusign.ts** - DocuSign API integration (token generation, envelope sending, status tracking)
- **lib/google-workspace.ts** - Google Workspace API integration (user creation, suspension, password generation)
- **lib/sendgrid.ts** - SendGrid email integration (welcome, approval, rejection emails)

### API Endpoints
- **app/api/admin/agents/route.ts** 
  - `GET` - List all agents
  - `POST` - Create new agent with full provisioning workflow

- **app/api/admin/agents/[id]/route.ts**
  - `GET` - Get single agent by ID
  - `PATCH` - Approve, reject, or deactivate agent

- **app/api/docusign/webhook/route.ts**
  - `POST` - Handle DocuSign signature completion webhooks

## Environment Variables

Create or update `.env.local` in your project root with these variables:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_APP_URL=http://localhost:3000

# DocuSign
DOCUSIGN_API_URL=https://demo.docusign.net  # or https://na3.docusign.net for production
DOCUSIGN_ACCOUNT_ID=your-docusign-account-id
DOCUSIGN_CLIENT_ID=your-docusign-client-id
DOCUSIGN_CLIENT_SECRET=your-docusign-client-secret

# SendGrid
SENDGRID_API_KEY=SG.xxxxxxxxxxxxx

# Google Workspace (Optional - currently blocked by org policy)
GOOGLE_SERVICE_ACCOUNT_EMAIL=agents-service-account@your-domain.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_CLIENT_ID=123456789-xxxxx.apps.googleusercontent.com
GOOGLE_ADMIN_EMAIL=admin@hartfeltrealestate.com
```

## Installation & Dependencies

Install required npm packages:

```bash
npm install @sendgrid/mail axios
```

These are in addition to existing dependencies (Next.js, Supabase, etc.)

## Database Setup

Run this SQL in your Supabase SQL Editor to create the `agents` table:

```sql
-- Create agents table
create table agents (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text not null unique,
  phone text,
  workspace_email text unique,
  status text default 'pending_onboarding',
  docusign_envelope_id text,
  signed_at timestamp,
  approved_at timestamp,
  docusign_signed_document_url text,
  supabase_user_id uuid,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- Create indexes for common queries
create index idx_agents_status on agents(status);
create index idx_agents_email on agents(email);
create index idx_agents_workspace_email on agents(workspace_email);
create index idx_agents_docusign_envelope_id on agents(docusign_envelope_id);
create index idx_agents_created_at on agents(created_at desc);

-- Enable RLS
alter table agents enable row level security;

-- Create policies (optional - adjust based on your auth model)
create policy "Admins can read all agents"
  on agents for select
  using (true);  -- Replace with proper admin check

create policy "Service can insert agents"
  on agents for insert
  with check (true);  -- Replace with proper auth check

create policy "Service can update agents"
  on agents for update
  using (true);  -- Replace with proper auth check
```

## Onboarding PDF Setup

The system expects an `onboarding.pdf` file at `public/onboarding.pdf`. 

For now, a minimal demo PDF is generated if the file doesn't exist. For production:
1. Create your actual onboarding document (terms, agreements, etc.)
2. Save as PDF
3. Place in `public/onboarding.pdf`

## DocuSign Webhook Configuration

After deploying to production:

1. Go to DocuSign Admin Console → Settings → Apps and Keys
2. Find your app under "Integration Keys"
3. Click "View" to edit
4. In "Webhook URL" field, enter:
   ```
   https://your-domain.com/api/docusign/webhook
   ```
5. Save

The webhook will receive signature completion events and automatically update agent status.

## Testing the API Endpoints

### 1. Create an Agent
```bash
curl -X POST http://localhost:3000/api/admin/agents \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "John",
    "last_name": "Smith",
    "email": "john.smith@example.com",
    "phone": "555-1234"
  }'
```

Expected response:
```json
{
  "success": true,
  "data": {
    "id": "uuid...",
    "first_name": "John",
    "last_name": "Smith",
    "email": "john.smith@example.com",
    "workspace_email": "john.smith@hartfeltrealestate.com",
    "status": "awaiting_signature",
    "created_at": "2026-04-08T...",
    "updated_at": "2026-04-08T..."
  }
}
```

### 2. List All Agents
```bash
curl http://localhost:3000/api/admin/agents
```

### 3. Get Single Agent
```bash
curl http://localhost:3000/api/admin/agents/{agent-id}
```

### 4. Approve Agent
```bash
curl -X PATCH http://localhost:3000/api/admin/agents/{agent-id} \
  -H "Content-Type: application/json" \
  -d '{
    "action": "approve"
  }'
```

### 5. Reject Agent
```bash
curl -X PATCH http://localhost:3000/api/admin/agents/{agent-id} \
  -H "Content-Type: application/json" \
  -d '{
    "action": "reject",
    "reason": "Background check did not pass"
  }'
```

### 6. Deactivate Agent
```bash
curl -X PATCH http://localhost:3000/api/admin/agents/{agent-id} \
  -H "Content-Type: application/json" \
  -d '{
    "action": "deactivate"
  }'
```

## Agent Status Workflow

The system tracks agents through these states:

1. **pending_onboarding** - Initial state (rarely used)
2. **awaiting_signature** - DocuSign envelope sent, waiting for signature
3. **signed** - Documents signed, awaiting admin approval
4. **approved** - Admin approved, agent is active
5. **rejected** - Admin rejected application
6. **active** - Agent is fully provisioned and active
7. **inactive** - Agent has been deactivated (Google Workspace user suspended)
8. **declined** - Agent declined DocuSign envelope
9. **voided** - DocuSign envelope was voided

## Complete Onboarding Flow

1. **Admin creates agent** → POST /api/admin/agents
   - Agent record inserted with status `awaiting_signature`
   - Supabase auth user created with temporary password
   - Welcome email sent
   - DocuSign envelope sent

2. **Agent signs documents** → DocuSign webhook → POST /api/docusign/webhook
   - Agent signs in DocuSign
   - Webhook notifies your app
   - Agent status updated to `signed`

3. **Admin reviews & approves** → PATCH /api/admin/agents/[id]
   - Admin approves agent via PATCH with action `approve`
   - Agent status updated to `approved`
   - Approval email sent to agent

4. **Agent gains access**
   - Agent logs into Portal with workspace email
   - Portal detects approved status
   - Full agent dashboard access granted

## Known Limitations

### Google Workspace Automation
- **Limitation**: Organization policy blocks JSON key creation
- **Current Status**: User creation code is in place but requires manual token generation
- **Workaround**: Create users manually in Google Workspace Admin Console or implement OAuth 2.0 flow
- **Impact**: Users still get workspace email generated, but accounts must be created separately

### Email Verification
- **Requirement**: SendGrid sender must be verified
- **Current Sender**: info@hartfeltrealestate.com (already verified)
- **If changing sender**: You'll need to verify the new email in SendGrid first

## Next Steps: Phase 2

The next phase will implement the admin UI in the Portal where non-technical brokers can:
- See a form to add new agents
- View list of all agents with status
- Approve/reject agents with one-click actions
- See signed documents
- Manage agent lifecycle

## Summary of API Responses

All API endpoints return standardized responses:

```typescript
interface AgentResponse {
  success: boolean;
  data?: Agent;
  error?: string;
}

interface Agent {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  workspace_email: string;
  status: AgentStatus;
  docusign_envelope_id?: string;
  signed_at?: string;
  approved_at?: string;
  docusign_signed_document_url?: string;
  supabase_user_id?: string;
  created_at: string;
  updated_at: string;
}
```

## Configuration Checklist

- [ ] Create `.env.local` with all required variables
- [ ] Run agents table SQL in Supabase
- [ ] Install npm packages: `npm install @sendgrid/mail axios`
- [ ] Set up Supabase authentication (if not already done)
- [ ] Configure DocuSign webhook URL (after deployment)
- [ ] Place `onboarding.pdf` in public folder (optional for demo)
- [ ] Test POST /api/admin/agents to create test agent
- [ ] Verify welcome email arrives
- [ ] Test PATCH /api/admin/agents/[id] to approve agent

---

**Phase 1 Backend Setup is now complete!** 

All API endpoints are ready. The next step is Phase 2: Building the admin UI components in the Portal so brokers can use this system without touching the API directly.
