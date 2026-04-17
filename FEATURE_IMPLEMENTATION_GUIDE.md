# HartFelt CRM, Referral & Email Integration Implementation Guide

## Overview

This document describes the complete implementation of three interconnected features for the HartFelt brokerage platform:

1. **CRM System** - Lead and contact management with scoring and analytics
2. **Referral System** - Commission tracking and leaderboard management
3. **Email Integration** - Email account sync, templates, and tracking

## Database Migrations

### Migration 015: CRM System
**Location**: `supabase/migrations/015_crm_system.sql`

Creates the following tables:
- `leads` - Lead records with scoring and temperature tracking
- `contacts` - Contact information management
- `lead_interactions` - Call/email/meeting logs
- `lead_pipeline` - Daily pipeline snapshots
- `lead_sources` - Lead source tracking and ROI

**Key Functions**:
- `calculate_lead_score()` - Computes lead score based on interactions
- `determine_lead_temperature()` - Sets hot/warm/cold based on score and activity

**RLS Policies**:
- Agents can view/manage their own leads
- Brokers can view all leads

### Migration 016: Referral System
**Location**: `supabase/migrations/016_referral_system.sql`

Creates the following tables:
- `referral_sources` - Registered referral partners
- `referral_relationships` - Links transactions to referral sources
- `referral_payouts` - Commission payout tracking
- `referral_leaderboard_snapshot` - Ranking snapshots

**Key Functions**:
- `calculate_referral_commission()` - Calculates commission amounts
- `generate_referral_leaderboard_snapshot()` - Creates monthly/quarterly/yearly rankings

### Migration 017: Email Integration
**Location**: `supabase/migrations/017_email_integration.sql`

Creates the following tables:
- `email_accounts` - Connected email accounts
- `email_messages` - Synced email messages
- `email_templates` - Reusable email templates
- `email_tracking` - Open/click tracking
- `email_attachments` - File attachments

**Key Functions**:
- `substitute_template_variables()` - Replaces {{variable}} in templates
- `record_email_open()` - Records email opens
- `record_email_click()` - Records link clicks

## API Endpoints

### CRM Endpoints

#### Leads Management
```
GET    /api/broker/leads
POST   /api/broker/leads
GET    /api/broker/leads/:id
PATCH  /api/broker/leads/:id
DELETE /api/broker/leads/:id
```

**Query Parameters**:
- `status` - Filter by status
- `source` - Filter by source
- `temperature` - Filter by temperature
- `agent_id` - Filter by agent
- `search` - Search by name/email/phone
- `page` - Pagination page (default: 1)
- `limit` - Results per page (default: 20)

#### Lead Interactions
```
GET    /api/broker/leads/:id/interactions
POST   /api/broker/leads/:id/interactions
```

#### Contacts
```
GET    /api/broker/contacts
POST   /api/broker/contacts
PATCH  /api/broker/contacts/:id
```

#### Analytics
```
GET    /api/broker/leads/analytics?type=pipeline
GET    /api/broker/leads/analytics?type=sources
GET    /api/broker/leads/analytics?type=conversion
```

### Referral Endpoints

```
GET    /api/broker/referrals/sources
POST   /api/broker/referrals/sources
PATCH  /api/broker/referrals/sources/:id
GET    /api/broker/referrals/leaderboard
GET    /api/broker/referrals/payouts
POST   /api/broker/referrals/payouts/approve
```

### Email Endpoints

```
GET    /api/broker/email/accounts
POST   /api/broker/email/accounts
GET    /api/broker/email/inbox
GET    /api/broker/email/messages/:id
POST   /api/broker/email/messages/:id/archive
GET    /api/broker/email/templates
POST   /api/broker/email/templates
POST   /api/broker/email/send
GET    /api/broker/email/tracking/:message_id
```

## React Components

### CRM Components

#### LeadDashboard.tsx
Main dashboard showing:
- Total leads count
- Hot/warm/cold distribution
- Pipeline by status
- Average lead score

**Props**: None (fetches data internally)

#### LeadsListScreen.tsx
Searchable lead list with:
- Status filtering
- Temperature filtering
- Quick actions
- Integration with LeadDetailModal

**Props**: None

#### LeadDetailModal.tsx
Full lead profile showing:
- Contact information
- Lead metrics
- Interaction history
- Add interaction form

**Props**:
- `lead` - Lead object
- `onClose` - Callback function

### Referral Components

#### ReferralLeaderboard.tsx
Rankings showing:
- Top referral sources
- Commission earned
- Number of referrals
- Period selection (monthly/quarterly/yearly)

**Props**: None

#### ReferralSourceManager.tsx
CRUD operations for referral sources with:
- Registration form
- Commission rate configuration
- Status management

**Props**: None

#### ReferralPayoutDashboard.tsx
Payout management showing:
- Pending payouts
- Commission totals
- Approval workflow

**Props**: None

### Email Components

#### EmailInboxScreen.tsx
Full email client with:
- Thread grouping
- Unread filtering
- Message detail view
- Reply composition

**Props**: None

#### EmailTemplateManager.tsx
Template management with:
- Category filtering
- Variable substitution
- CRUD operations
- Active/inactive toggle

**Props**: None

#### EmailComposeScreen.tsx
Email composition with:
- Template selection
- Variable substitution
- Lead/transaction linking
- Tracking opt-in

**Props**: None

## Type Definitions

All types are defined in `src/types/`:

### crm.ts
- `Lead`
- `LeadInteraction`
- `Contact`
- `PipelineAnalytics`
- Request/Response types

### email.ts
- `EmailAccount`
- `EmailMessage`
- `EmailTemplate`
- `EmailTracking`
- Request/Response types

### referral.ts
- `ReferralSource`
- `ReferralRelationship`
- `ReferralPayout`
- `ReferralLeaderboard`
- Request/Response types

## Lead Scoring Algorithm

The lead score is calculated automatically when interactions are created:

1. **Interaction Count** (max 30 points)
   - 5 points per interaction
   - Maximum 30 points

2. **Positive Outcomes** (max 30 points)
   - 10 points per positive interaction
   - Maximum 30 points

3. **Recency Bonus** (max 20 points)
   - 20 points if contacted within 7 days
   - 15 points if contacted within 14 days
   - 10 points if contacted within 30 days

**Temperature Determination**:
- **Hot**: Score >= 70 AND contacted within 14 days
- **Warm**: Score >= 50 OR contacted within 30 days
- **Cold**: All others

## Email Integration

### Supported Providers
- Gmail (OAuth 2.0)
- Outlook (OAuth 2.0)
- IMAP (Basic Auth)
- SendGrid (API Key)

### Sync Process
1. Connect email account via OAuth
2. Initial sync fetches last 30 days of emails
3. Continuous background sync (configurable interval)
4. Auto-linking to leads/transactions

### Template Variables
Templates support variable substitution:
- `{{first_name}}` - Lead/contact first name
- `{{last_name}}` - Lead/contact last name
- `{{email}}` - Email address
- `{{phone}}` - Phone number
- `{{property_address}}` - Property address
- `{{list_price}}` - Listing price

## Referral Commission Calculation

Commission is calculated as:
```
commission = transaction_value * (commission_rate / 100)
```

### Payout Periods
- Monthly: Current calendar month
- Quarterly: Current calendar quarter
- Yearly: Current calendar year

### Leaderboard Generation
Snapshots are generated daily and include:
- Rank among all sources
- Total commission earned
- Number of referrals
- Period-specific metrics

## Row Level Security (RLS)

### Leads
- Agents: View/manage own leads only
- Brokers: View all leads in broker
- Admin: Full access

### Contacts
- Brokers: View/manage own broker's contacts
- Admin: Full access

### Email Accounts
- Brokers/Admins: View/manage own broker's accounts
- No agent access

### Referral Sources
- Brokers/Admins: Full management

## Performance Considerations

### Indexes
All major tables have indexes on:
- Foreign keys (agent_id, broker_id, etc.)
- Frequently filtered fields (status, source, temperature)
- Date fields (created_at, updated_at)
- Search fields (email, phone)

### Query Optimization
- Use pagination for list queries
- Filter by broker_id to limit scope
- Leverage RLS for automatic filtering
- Cache analytics for 1 hour

### Audit Trail
All changes are tracked via:
- `created_at` timestamps
- `updated_at` timestamps
- `deleted_at` for soft deletes
- Trigger functions for automatic updates

## Deployment Checklist

- [ ] Run migrations in order (015, 016, 017)
- [ ] Verify RLS policies are applied
- [ ] Test lead scoring with sample interactions
- [ ] Test email sync with test account
- [ ] Configure email provider credentials in .env
- [ ] Set up referral sources
- [ ] Test leaderboard snapshot generation
- [ ] Verify analytics calculations
- [ ] Load test with production data
- [ ] Set up backup/restore procedures

## Error Handling

### Common Errors
- **400 Bad Request**: Missing required fields
- **401 Unauthorized**: User not authenticated
- **403 Forbidden**: User lacks permission
- **404 Not Found**: Resource not found
- **500 Internal Error**: Database or server error

### Validation
- Email validation on account connection
- Phone number format validation
- Commission rate bounds (0-100)
- Status enum validation

## Future Enhancements

1. **AI-Powered Lead Scoring**
   - Machine learning model for prediction
   - Lead likelihood to close

2. **Advanced Email Integration**
   - Automatic lead capture from emails
   - Smart reply suggestions
   - Conversation threading

3. **Referral Automation**
   - Automatic commission calculation
   - Payment integration
   - Tax reporting

4. **Analytics Expansion**
   - Forecasting models
   - Win rate analysis
   - Agent performance comparison

## Support & Troubleshooting

### Database Connection Issues
- Verify Supabase credentials in .env
- Check RLS policies are enabled
- Review security rules

### Email Sync Issues
- Verify OAuth token is valid
- Check refresh token flow
- Review sync logs

### Performance Issues
- Check query execution plans
- Review index usage
- Monitor connection pool

## File Structure

```
agents-portal/
├── supabase/migrations/
│   ├── 015_crm_system.sql
│   ├── 016_referral_system.sql
│   └── 017_email_integration.sql
├── src/
│   ├── app/api/broker/
│   │   ├── leads/
│   │   ├── contacts/
│   │   ├── referrals/
│   │   └── email/
│   ├── components/
│   │   ├── LeadDashboard.tsx
│   │   ├── LeadsListScreen.tsx
│   │   ├── LeadDetailModal.tsx
│   │   ├── ReferralLeaderboard.tsx
│   │   ├── EmailInboxScreen.tsx
│   │   └── EmailTemplateManager.tsx
│   └── types/
│       ├── crm.ts
│       ├── email.ts
│       └── referral.ts
└── FEATURE_IMPLEMENTATION_GUIDE.md
```

## Summary

This implementation provides a production-ready CRM, referral, and email integration system for HartFelt. All features are fully typed, documented, and include comprehensive error handling and data validation. The system is scalable and maintains strong security through RLS policies and user authentication.
