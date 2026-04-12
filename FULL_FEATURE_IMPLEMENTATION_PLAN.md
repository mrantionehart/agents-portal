# Full Feature Implementation Plan: Portal Enhancement

## Project Scope: 9 Missing Features from EASE App

### Timeline: 4 Phases (~27 days total)

```
Phase 1 (Days 1-4):  Lead Management + AI Chat
Phase 2 (Days 5-8):  Deal Pipeline + Email Templates
Phase 3 (Days 9-12): Brokerage Tools + Calendar
Phase 4 (Days 13+):  Recruiting + Lead Distribution + Wins Tracker
```

## Phase 1: Foundation Features (Days 1-4)

### Feature 1A: Lead Management / My Leads (Days 1-3)
**Status**: Starting now
**Priority**: Critical (agents use daily)
**Impact**: Enables CRM functionality

#### Components to Build
- `app/leads/page.tsx` - Main leads list page
- `app/leads/[id]/page.tsx` - Lead detail page
- `app/components/lead-list.tsx` - Leads table/grid component
- `app/components/lead-form.tsx` - Add/edit form
- `app/components/lead-filters.tsx` - Search and filter
- `app/components/lead-card.tsx` - Compact lead display

#### Database Tables
```sql
CREATE TABLE leads (
  id UUID PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES profiles(id),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  property_address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  lead_source TEXT,
  status TEXT DEFAULT 'warm',  -- hot, warm, cold
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  INDEX(agent_id),
  INDEX(status),
  INDEX(created_at)
);

CREATE TABLE lead_activities (
  id UUID PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES profiles(id),
  activity_type TEXT NOT NULL,  -- call, email, meeting, note
  details TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX(lead_id),
  INDEX(agent_id)
);
```

#### Features
- ✅ List all leads with status badges
- ✅ Search and filter by name, status, source
- ✅ Add new lead form with validation
- ✅ Edit lead details
- ✅ Delete lead
- ✅ View lead details and activity history
- ✅ Add notes and activities to lead
- ✅ Contact lead (quick call/email actions)
- ✅ Lead source tracking
- ✅ Status management (Hot/Warm/Cold)

#### Vault API Methods (new)
```typescript
vaultAPI.leads.list(userId, filters?)
vaultAPI.leads.create(leadData, userId)
vaultAPI.leads.update(leadId, updates, userId)
vaultAPI.leads.delete(leadId, userId)
vaultAPI.leads.getActivities(leadId, userId)
vaultAPI.leads.addActivity(leadId, activity, userId)
```

---

### Feature 1B: AI Chat Assistant (Day 4)
**Status**: Starting Day 4
**Priority**: High (uses existing Vault AI)
**Impact**: Immediate productivity boost

#### Components to Build
- `app/ai-chat/page.tsx` - Main chat interface
- `app/components/chat-message.tsx` - Message display
- `app/components/chat-input.tsx` - Input area
- `app/components/chat-history.tsx` - Message history

#### Features
- ✅ Chat interface with Vault AI integration
- ✅ Real-time message exchange
- ✅ Message history display
- ✅ Clear conversation
- ✅ Quick action buttons (lead info lookup, compliance check, market analysis)
- ✅ Document analysis from chat
- ✅ Suggested follow-up questions

#### Vault API Methods (existing)
```typescript
vaultAPI.ai.chat(message, userId, role)  // Already implemented
```

---

## Phase 2: Workflow Features (Days 5-8)

### Feature 2A: Deal Pipeline / Kanban Board (Days 5-7)
**Status**: Starts Day 5
**Priority**: High (workflow management)
**Impact**: Visual deal tracking

#### Components to Build
- `app/pipeline/page.tsx` - Main pipeline page
- `app/components/kanban-board.tsx` - Kanban component
- `app/components/deal-card.tsx` - Deal card in pipeline
- `app/components/pipeline-column.tsx` - Stage column
- `app/components/deal-detail-modal.tsx` - Modal for deal editing

#### Features
- ✅ Kanban board with 4 stages (Listing, Under Contract, Closing, Sold)
- ✅ Drag-and-drop deals between stages
- ✅ Deal cards with property, price, timeline
- ✅ Stage count and total value display
- ✅ Quick actions (edit, contact, view details)
- ✅ Filter by agent/status
- ✅ Color-coded by stage
- ✅ Deal age indicator
- ✅ Commission preview on card

#### Libraries
```bash
npm install react-beautiful-dnd @types/react-beautiful-dnd
# or
npm install dnd-kit @dnd-kit/core @dnd-kit/utilities @dnd-kit/sortable
```

---

### Feature 2B: Email Templates & Composer (Days 7-8)
**Status**: Starts Day 7
**Priority**: High (marketing automation)
**Impact**: Lead nurturing, follow-ups

#### Components to Build
- `app/email-templates/page.tsx` - Templates list page
- `app/email-templates/new/page.tsx` - Create template
- `app/email-templates/[id]/edit/page.tsx` - Edit template
- `app/email-composer/page.tsx` - Send emails
- `app/components/email-editor.tsx` - Template editor
- `app/components/email-preview.tsx` - Live preview

#### Database Tables
```sql
CREATE TABLE email_templates (
  id UUID PRIMARY KEY,
  broker_id UUID NOT NULL REFERENCES profiles(id),
  name TEXT NOT NULL,
  category TEXT,  -- leads, clients, team, followup
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  variables JSONB,  -- {firstname}, {lastname}, {property}, etc
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  INDEX(broker_id),
  INDEX(category)
);

CREATE TABLE email_history (
  id UUID PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES profiles(id),
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT,  -- sent, failed, scheduled
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX(agent_id)
);
```

#### Features
- ✅ Pre-built email template library
- ✅ Template categories (leads, clients, team, etc)
- ✅ Create custom templates
- ✅ Edit templates with rich text editor
- ✅ Template variables ({first_name}, {property}, etc)
- ✅ Email preview
- ✅ Send immediate or schedule
- ✅ Track email opens (if service supports)
- ✅ Email history view
- ✅ Bulk send to leads

#### Libraries
```bash
npm install react-quill react-email-editor # or similar
```

---

## Phase 3: Admin & Productivity Features (Days 9-12)

### Feature 3A: Brokerage Management Dashboard (Days 9-11)
**Status**: Starts Day 9
**Priority**: Critical for brokers
**Impact**: Complete broker oversight

#### Components to Build
- `app/brokerage/page.tsx` - Main brokerage dashboard
- `app/brokerage/agents/page.tsx` - Agent management
- `app/brokerage/deals/page.tsx` - All deals view
- `app/brokerage/commissions/page.tsx` - Commission overview
- `app/brokerage/announcements/page.tsx` - Team announcements
- `app/brokerage/reports/page.tsx` - Performance reports
- `app/components/agent-card.tsx` - Agent overview
- `app/components/team-stats.tsx` - KPI dashboard

#### Features
- ✅ Agent list with performance metrics
- ✅ All agents' deals in pipeline view
- ✅ Commission summaries by agent
- ✅ Team total earnings
- ✅ Post team announcements
- ✅ View all documents (broker-shared)
- ✅ Agent activity timeline
- ✅ Performance reports and charts
- ✅ Lead distribution management
- ✅ Team goals and targets

#### Role Check
```typescript
if (role !== 'broker' && role !== 'admin') {
  return <AccessDenied message="This section is for brokers only" />
}
```

---

### Feature 3B: Calendar / Scheduling (Days 11-12)
**Status**: Starts Day 11
**Priority**: Medium (appointment management)
**Impact**: Schedule coordination

#### Components to Build
- `app/calendar/page.tsx` - Main calendar page
- `app/components/calendar-widget.tsx` - Calendar display
- `app/components/event-form.tsx` - Create/edit event
- `app/components/event-list.tsx` - Upcoming events

#### Features
- ✅ Monthly/weekly/daily calendar views
- ✅ Schedule showings and appointments
- ✅ Event types (showing, meeting, follow-up, etc)
- ✅ Reminders before events
- ✅ Color-coded by event type
- ✅ Quick add event from calendar
- ✅ Event details modal
- ✅ Invitations and RSVP (optional)

#### Libraries
```bash
npm install react-calendar react-big-calendar # or similar
```

---

## Phase 4: Growth & Engagement Features (Days 13+)

### Feature 4A: Recruiting / Referral Program (Days 13-16)
**Status**: Starts Day 13
**Priority**: Medium (growth focused)
**Impact**: Agent recruitment

#### Features
- ✅ Referral tracking system
- ✅ Recruit pipeline for new agents
- ✅ Referral commission tracking
- ✅ Recruit status (lead, interested, offered, hired)
- ✅ Recruiting metrics dashboard
- ✅ Recruit details and timeline

#### Database Tables
```sql
CREATE TABLE recruits (
  id UUID PRIMARY KEY,
  broker_id UUID NOT NULL REFERENCES profiles(id),
  referrer_agent_id UUID REFERENCES profiles(id),
  recruit_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  status TEXT,  -- lead, interested, offered, hired
  referral_commission DECIMAL,
  hired_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

### Feature 4B: Lead Distribution / Available Leads (Days 16-18)
**Status**: Starts Day 16
**Priority**: Medium (specific workflow)
**Impact**: Fair lead distribution

#### Features
- ✅ Available leads pool
- ✅ Claim available leads
- ✅ Lead assignment by broker
- ✅ Agent claims history
- ✅ Lead age tracking
- ✅ Fair distribution tracking

#### Database Tables
```sql
CREATE TABLE available_leads (
  id UUID PRIMARY KEY,
  broker_id UUID NOT NULL REFERENCES profiles(id),
  first_name TEXT NOT NULL,
  lead_source TEXT,
  property_address TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  claimed_by UUID REFERENCES profiles(id),
  claimed_at TIMESTAMP
);
```

---

### Feature 4C: Wins Tracker (Days 18-19)
**Status**: Starts Day 18
**Priority**: Low (engagement focused)
**Impact**: Team recognition

#### Features
- ✅ Log wins and achievements
- ✅ Wins categories (deal closed, record commission, milestone, etc)
- ✅ Win celebration view
- ✅ Wins leaderboard
- ✅ Team feed with recent wins
- ✅ Broker recognition tools

#### Database Tables
```sql
CREATE TABLE wins (
  id UUID PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES profiles(id),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,  -- deal_closed, commission, milestone, etc
  amount DECIMAL,
  win_date DATE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Development Guidelines

### Code Structure
```
app/
├── leads/                    # Lead Management
│   ├── page.tsx             # List leads
│   └── [id]/page.tsx        # Lead detail
├── ai-chat/                  # AI Chat
│   └── page.tsx
├── pipeline/                 # Deal Pipeline
│   └── page.tsx
├── email-templates/          # Email Templates
│   ├── page.tsx
│   ├── new/page.tsx
│   └── [id]/edit/page.tsx
├── brokerage/               # Brokerage Tools
│   ├── page.tsx
│   ├── agents/page.tsx
│   ├── deals/page.tsx
│   └── reports/page.tsx
├── calendar/                # Calendar
│   └── page.tsx
├── recruiting/              # Recruiting
│   └── page.tsx
├── lead-distribution/       # Lead Distribution
│   └── page.tsx
├── wins/                    # Wins Tracker
│   └── page.tsx
└── components/
    ├── lead-*.tsx
    ├── chat-*.tsx
    ├── kanban-*.tsx
    └── ...
```

### API Client Updates
```typescript
// lib/vault-client.ts additions

leads: {
  list: (userId, filters?) => vaultRequest('/api/leads', { userId }),
  create: (data, userId) => vaultRequest('/api/leads', { method: 'POST', body: data, userId }),
  update: (id, data, userId) => vaultRequest(`/api/leads/${id}`, { method: 'PUT', body: data, userId }),
  delete: (id, userId) => vaultRequest(`/api/leads/${id}`, { method: 'DELETE', userId }),
  getActivities: (id, userId) => vaultRequest(`/api/leads/${id}/activities`, { userId }),
  addActivity: (id, activity, userId) => vaultRequest(`/api/leads/${id}/activities`, { method: 'POST', body: activity, userId }),
}
```

### Styling Consistency
- Use Tailwind CSS (same as existing)
- Color scheme: Blue primary, with status-specific colors
- Responsive: Mobile-first design
- Icons: Continue using Lucide React

### Database & RLS
- Enable RLS on all new tables
- Agents can only see their own leads
- Brokers can see all leads
- Admin has full access

### Testing
For each feature:
- [ ] Unit tests for components
- [ ] Integration tests for API calls
- [ ] Role-based access verification
- [ ] Data validation
- [ ] Error handling

---

## Success Metrics

### Phase 1
- [ ] Lead Management fully functional (CRUD operations)
- [ ] AI Chat responding to user input
- [ ] Both features deployed and tested

### Phase 2
- [ ] Kanban board with drag-and-drop working
- [ ] Email templates CRUD operations
- [ ] Email sending functionality verified

### Phase 3
- [ ] Brokerage dashboard showing all agents and deals
- [ ] Calendar displaying and managing events
- [ ] Broker/admin access properly restricted

### Phase 4
- [ ] All remaining features functional
- [ ] Portal fully feature-parity with EASE app (except mobile-specific)
- [ ] All 9 features integrated and tested

---

## Deployment Checklist

Before deploying each feature:
- [ ] Code reviewed
- [ ] Tests passing
- [ ] Database migrations applied
- [ ] RLS policies configured
- [ ] Environment variables updated
- [ ] Documentation updated
- [ ] User guide created
- [ ] Tested on staging environment

---

## Total Effort Estimate

| Phase | Features | Days | Cumulative |
|-------|----------|------|-----------|
| 1 | Lead Mgmt + AI Chat | 4 | 4 |
| 2 | Pipeline + Email | 4 | 8 |
| 3 | Brokerage + Calendar | 4 | 12 |
| 4 | Recruiting + Distribution + Wins | 6 | 18 |
| **Testing & QA** | **Full integration & edge cases** | **3-5** | **21-23** |
| **Deployment & Training** | **Production rollout** | **2-3** | **23-26** |

**Total: 23-26 days (4.5-5 weeks)**

---

## Dependencies & Prerequisites

### Required Libraries (npm install)
```bash
# Already installed
npm install react lucide-react @supabase/supabase-js axios

# New libraries for this phase
npm install react-beautiful-dnd @types/react-beautiful-dnd
npm install react-quill  # or react-email-editor
npm install react-calendar react-big-calendar

# Optional
npm install recharts  # for charts/reports
npm install date-fns  # for date handling
npm install zustand  # for state management (optional)
```

### Supabase Requirements
- All tables created with proper schema
- RLS policies configured
- Indexes on frequently queried columns
- Real-time subscriptions enabled (for updates)

### Vault API Endpoints
Verify availability or request if missing:
- `/api/leads` (full CRUD)
- `/api/leads/:id/activities`
- `/api/email/send` (for email feature)

---

## Risk Mitigation

### High Risks
1. **Vault API doesn't have leads endpoints** → Build in Supabase directly as fallback
2. **Email service integration** → Use Supabase email if Vault doesn't support
3. **Kanban performance with many deals** → Implement pagination/virtualization
4. **Database growth** → Archive old leads/activities after 1 year

### Mitigation Strategies
- Start with MVP features only
- Use feature flags for gradual rollout
- Monitor performance on staging
- Have rollback plan for each deployment

---

## What's Next?

Starting immediately with **Phase 1A: Lead Management**

Building:
1. Supabase table schema
2. Vault API client methods
3. Lead components
4. Lead list and detail pages
5. Add/edit/delete functionality

Then Phase 1B: AI Chat on Day 4
