# HartFelt Portal & EASE App - System Architecture

## System Overview

The HartFelt Portal is a Next.js web application that serves as the online portal for the EASE app. It provides agents with a centralized platform for:
- Training and certification (interactive modules)
- Compliance document management with AI analysis
- Commission tracking and approval
- Access to resources and tools
- Real-time notifications

## Technology Stack

### Frontend
- **Framework**: Next.js 14 with TypeScript
- **UI Library**: React with Tailwind CSS
- **Icons**: Lucide React
- **Client Components**: All pages use 'use client' directive

### Backend & Services
- **Authentication**: Supabase Auth (Postgres-based)
- **Database**: Supabase (PostgreSQL)
- **API Integration**: Vault API (192.168.6.88:3000)
- **Real-Time**: Supabase Real-Time subscriptions (PostgreSQL LISTEN/NOTIFY)
- **File Storage**: Vault API (documents endpoint)

### Deployment
- **Client**: Vercel (Next.js deployment)
- **Backend**: Supabase Cloud (Postgres + Auth)
- **Vault API**: Self-hosted (192.168.6.88:3000)

## Data Flow Architecture

```
┌─────────────────┐
│  Portal Agent   │
└────────┬────────┘
         │
         ├─→ [Upload Document]
         │   └─→ Vault API /documents → AI Analysis
         │       └─→ Response: { compliance_score, issues }
         │       └─→ Store in Supabase compliance_submissions
         │
         ├─→ [View Notifications]
         │   └─→ Supabase compliance_notifications table
         │       └─→ Real-time subscription via channel
         │
         └─→ [View Deals & Commissions]
             └─→ Vault API /deals, /commissions/get

┌─────────────────┐
│ Portal Broker   │
└────────┬────────┘
         │
         ├─→ [Review Submissions]
         │   └─→ Load from Supabase compliance_submissions
         │       └─→ Display AI analysis from ai_analysis field
         │
         ├─→ [Approve/Reject/Request Revision]
         │   └─→ Update status in compliance_submissions
         │   └─→ Create notification in compliance_notifications
         │       └─→ Real-time push to agent via subscription
         │
         └─→ [View All Commissions]
             └─→ Vault API /commissions/get (broker role)

┌──────────────────┐
│   EASE App       │
│  (React Native)  │
└────────┬─────────┘
         │
         ├─→ [Compliance Upload]
         │   └─→ VaultService.analyzeDocument()
         │   └─→ VaultService.uploadDocument()
         │       └─→ Same Supabase tables as Portal
         │
         └─→ [Notifications]
             └─→ Same Supabase tables as Portal
                 └─→ Real-time sync between apps
```

## Key Components

### Pages (Portal)

**Authentication**
- `/login` - Supabase Auth with email/password
- Middleware redirects unauthenticated users

**Dashboard**
- `/dashboard` - Main hub for agents and brokers
- Displays deals, commissions, quick access to tools
- Policy acceptance modal (first login only)
- ComplianceNotifications component in header

**Training**
- `/training-interactive` - Interactive modules with embedded tests
- 7 modules across 3 volumes
- Volume 2 & 3 password protected (HartFelt2024)
- Certificate generation at 80%+ pass rate
- Final exam (25 questions) at 85%+ pass required

**Compliance**
- `/compliance` - Agent document upload page
- Deal selection → Stage selection → Document upload
- AI analysis with compliance score and issues
- Notifications to brokers on submission

**Compliance Review**
- `/compliance-review` - Broker/admin review page
- Two-column layout: submission list + review panel
- AI analysis display with score and issues
- Approve/Reject/Request Revision actions
- Notifications sent to agents

**Resources & Documents**
- `/documents` - Links to contract forms
- `/resources` - Training modules, broker manual, templates
- `/opportunities` - Password-protected private deals
- `/commission-calculator` - Commission calculation tool

**Admin**
- `/admin-settings` - Password management for brokers/admins
- Display Volume 2/3 passwords and Private Opportunities password
- Show/hide toggle with copy to clipboard

### Components

**ComplianceNotifications** (`app/components/compliance-notifications.tsx`)
- Real-time notification center
- Bell icon with unread count badge
- Dropdown with last 10 notifications
- Notification types: approval, rejection, revision_needed, review_pending, submission
- Mark as read functionality
- Integrated into dashboard and compliance page headers

**PolicyAcceptanceModal** (`app/policy-acceptance/modal.tsx`)
- Mandatory first-login acceptance
- Blocks dashboard access until accepted
- Records in Supabase policy_acceptances table

### Database Schema

#### compliance_submissions
```sql
CREATE TABLE compliance_submissions (
  id UUID PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES profiles(id),
  agent_name TEXT NOT NULL,
  deal_id TEXT NOT NULL,
  deal_name TEXT NOT NULL,
  stage TEXT NOT NULL,  -- 'Listing', 'Under Contract', 'Closing'
  document_name TEXT NOT NULL,
  status TEXT NOT NULL,  -- 'pending', 'approved', 'rejected', 'revision_needed'
  submitted_at TIMESTAMP NOT NULL,
  reviewed_at TIMESTAMP,
  rejection_reason TEXT,
  ai_analysis JSONB,  -- { issues: [], compliance_score: number, success: boolean }
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### compliance_notifications
```sql
CREATE TABLE compliance_notifications (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id),
  type TEXT NOT NULL,  -- 'submission', 'approval', 'rejection', 'revision_needed', 'review_pending'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  document_id TEXT,
  deal_id TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### policy_acceptances
```sql
CREATE TABLE policy_acceptances (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id),
  policy_type TEXT NOT NULL,  -- 'brokerage_manual'
  accepted_at TIMESTAMP NOT NULL,
  user_name TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### API Integration

**Vault API Client** (`lib/vault-client.ts`)

```typescript
vaultAPI.deals.list(userId, role)
  → GET /api/deals
  → Returns: { deals: Deal[] }

vaultAPI.documents.upload(file, dealId, userId, stage, role)
  → POST /api/documents
  → FormData: { file, dealId, stage }
  → Returns: { id, status, ... }

vaultAPI.ai.analyzeDocument(file, userId, role)
  → POST /api/ai/analyze-document
  → FormData: { file }
  → Returns: { 
      compliance_score: number (0-100),
      issues: string[],
      success: boolean
    }

vaultAPI.commissions.list(userId, role)
  → GET /api/commissions/get
  → Returns: { commissions: Commission[] }
```

## Real-Time Subscriptions

All real-time updates use Supabase PostgreSQL subscriptions:

```typescript
// Notifications subscription (in compliance-notifications.tsx)
client
  .channel(`compliance-notifications-${userId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'compliance_notifications',
    filter: `user_id=eq.${userId}`
  }, (payload) => {
    // Update UI immediately with new notification
  })
  .subscribe()
```

## Authentication & Authorization

### Role-Based Access Control (RBAC)

**Agent Role**
- Can view own deals and commissions
- Can upload compliance documents
- Can view own notifications
- Cannot access compliance review
- Cannot access admin settings

**Broker/Admin Role**
- Can view all agents' deals and commissions
- Can access compliance review
- Can approve/reject documents
- Can access admin settings
- Can view and manage passwords

**Roles enforced at**:
- Page level: Redirect unauthenticated or unauthorized users
- API level: Vault API uses X-User-ID and X-User-Role headers
- Database level: Supabase RLS (Row Level Security) policies

## Compliance Workflow

### 1. Agent Upload Phase
```
Agent navigates to /compliance
  ↓
Selects a deal
  ↓
Selects a transaction stage (Listing/Under Contract/Closing)
  ↓
Selects document(s) to upload
  ↓
Clicks "Analyze & Upload Documents"
  ↓
AI Analysis via Vault API returns:
  - Compliance Score (0-100%)
  - List of issues (if any)
  - Success boolean
  ↓
UI displays compliance analysis with:
  - Green banner: "✅ Document is Compliant" (if score >= 80%)
  - Yellow banner: "⚠️ Compliance Issues Found" (if issues exist)
  - Compliance Score percentage with visual progress bar
  - Specific issues list
  ↓
Document stored in Supabase compliance_submissions
  ↓
Notifications sent:
  - To agent: "Compliance Documents Submitted"
  - To all brokers: "New Compliance Document from [Agent Name]"
```

### 2. Broker Review Phase
```
Broker navigates to /compliance-review
  ↓
Views all pending submissions in list
  ↓
Clicks on a submission to open review panel
  ↓
Review panel shows:
  - Agent & deal details
  - Document name and stage
  - AI analysis with compliance score and issues
  ↓
Broker chooses action:
  A) Click "✅ Approve"
      → Status updates to "approved"
      → Agent notified: "Compliance Document Approved ✅"
  B) Click "🔄 Request Revision" (requires notes)
      → Status updates to "revision_needed"
      → Agent notified with revision reason
  C) Click "❌ Reject" (requires reason)
      → Status updates to "rejected"
      → Agent notified with rejection reason
  ↓
Real-time updates:
  - Submission list updates immediately
  - Agent receives notification within 1-2 seconds
```

### 3. Follow-Up Phase
```
Agent receives notification
  ↓
Agent clicks notification or navigates to /compliance
  ↓
Agent reviews broker's decision and notes
  ↓
If revision needed: Agent uploads corrected documents
If approved: Moves to commission approval workflow
If rejected: Agent contacts broker or resubmits corrected version
```

## Training System Architecture

### Module Structure
```
Volume 1 (Public - Free)
  ├─ Module 1: Foundations
  ├─ Module 2: Lead Mastery
  ├─ Module 3: Listing Systems
  ├─ Module 4: Buyer Experience
  ├─ Module 5: Transaction to Close
  ├─ Module 6: Marketing & Social Branding
  ├─ Module 7: Growth & Retention
  └─ Final Exam (25 questions, 85% pass required)

Volume 2 (Password Protected)
  └─ Access Code: HartFelt2024

Volume 3 (Password Protected)
  └─ Access Code: HartFelt2024
```

### Certificate Generation
- Agent passes module test (80%+ required)
- Agent completes final exam (85%+ required)
- Certificate generated with:
  - Agent name
  - Completion date
  - Final score
  - HartFelt Ready logo
  - Displayed on screen and downloadable

## Security Considerations

### Authentication
- Supabase Auth with email/password
- JWT tokens in HTTP-only cookies
- Session management via Supabase
- Automatic logout on token expiration

### Authorization
- Role-based access control (RBAC)
- Supabase Row Level Security (RLS)
- API header validation (X-User-ID, X-User-Role)
- Server-side validation of all actions

### Data Protection
- All API requests over HTTPS
- Sensitive data (passwords) only in admin settings
- Database encryption at rest (Supabase)
- No PII logged in production

### File Uploads
- File type validation (PDF, DOC, DOCX, PNG, JPG)
- Size limits enforced
- Virus scanning (via Vault API)
- Storage isolated per agent/deal

## Performance Optimizations

### Frontend
- Next.js Image optimization
- Code splitting by page
- Client-side caching with React state
- Lazy loading of components

### Database
- Indexed queries on user_id, status, created_at
- Pagination for large lists (compliance submissions)
- Real-time subscriptions limit to specific user records

### API
- Request batching where possible
- Rate limiting on file uploads
- Caching of deals/commissions lists

## Monitoring & Debugging

### Logging
- Console logs for development
- Error tracking in Sentry (optional)
- Network logs in DevTools Network tab

### Real-Time Debugging
```javascript
// Check active subscriptions
console.log('Supabase subscriptions:', supabase.getChannels())

// Monitor network requests
// Open DevTools → Network tab → Filter by "api"
```

### Common Issues & Solutions
| Issue | Cause | Solution |
|-------|-------|----------|
| Notifications not appearing | Subscription not active | Check Supabase connection |
| Documents not uploading | Vault API unreachable | Verify 192.168.6.88:3000 is accessible |
| AI analysis not showing | API returns error | Check response format in DevTools |
| Status not updating | Cache not invalidating | Clear browser cache or reload page |
| Role-based access not working | RLS policies incorrect | Verify Supabase RLS in console |

## Deployment Checklist

Before production deployment:
- [ ] Verify Vault API is stable and accessible
- [ ] Create all Supabase tables with correct schema
- [ ] Enable Supabase RLS policies
- [ ] Test all workflows with real data
- [ ] Verify email notifications (if configured)
- [ ] Set environment variables correctly
- [ ] Run performance tests
- [ ] Document any custom configurations
- [ ] Train broker/admin users on system usage
- [ ] Set up monitoring and alerting

## Future Enhancements

1. **Email Notifications** - Send email on submission/approval/rejection
2. **Batch Operations** - Approve multiple submissions at once
3. **Reporting** - Compliance metrics and trends dashboard
4. **Webhooks** - Integrate with external compliance systems
5. **Mobile App** - Dedicated mobile compliance app
6. **Audit Trail** - Detailed history of all submissions and reviews
7. **Templates** - Pre-filled submission templates by stage
8. **Automation** - Auto-approve based on AI confidence threshold
9. **Integration** - Slack/Teams notifications
10. **Analytics** - Agent compliance rates and trends

## Support & Troubleshooting

For issues or questions:
1. Check this architecture document
2. Review COMPLIANCE_TESTING_CHECKLIST.md
3. Check browser DevTools Console for errors
4. Verify Vault API connectivity
5. Check Supabase dashboard for data
6. Contact development team with logs
