# Role-Based Access Control (RBAC) Guide

**Phase 4 Feature**: Complete role-based architecture for Agent Portal

---

## Overview

The Agent Portal now implements comprehensive role-based access control (RBAC) that separates the experience and data access for:
- **Agents** - View and manage only their own deals, documents, and commissions
- **Brokers/Admins** - View and manage all agents' data, approve commissions, review compliance

---

## How It Works

### 1. Authentication & Role Assignment

When a user logs in:
```
User → Supabase Auth → Session Created
Session has user.id → Profiles table → role ('agent' or 'broker'/'admin')
```

Roles are stored in Supabase `profiles` table:
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY,
  email TEXT,
  role TEXT, -- 'agent', 'broker', or 'admin'
  created_at TIMESTAMP
);
```

### 2. API Authorization

Every API call to Vault includes two headers:
```
X-User-ID: user_id  (who is making the request)
X-User-Role: role   (what level of access they have)
```

**Example**:
```typescript
// Agent making a request
vaultAPI.deals.list(userId, 'agent')
// Headers: X-User-ID: abc123, X-User-Role: agent
// Vault returns: only deals for user abc123

// Broker making the same request
vaultAPI.deals.list(brokerId, 'broker')
// Headers: X-User-ID: broker123, X-User-Role: broker
// Vault returns: all deals from all agents
```

### 3. Portal Routing

Users are automatically routed to the correct dashboard:

```
User Logs In
    ↓
Check Role
    ↓
    ├─→ role === 'agent' → /dashboard (agent view)
    │
    └─→ role === 'broker' or 'admin' → /admin/dashboard (admin view)
```

### 4. Data Filtering

All data endpoints are role-aware:

| Endpoint | Agent Role | Admin/Broker Role |
|----------|-----------|------------------|
| `/api/deals` | User's own deals | All agents' deals |
| `/api/commissions` | User's commissions | All agents' commissions |
| `/api/documents` | User's documents | All agents' documents |
| `/api/transactions` | User's transactions | All agents' transactions |

---

## Agent Dashboard Experience

**Route**: `/dashboard`  
**Who sees it**: Users with role = 'agent'  
**What they see**:
- Their own deals (filtered by X-User-ID)
- Their own commissions
- Their own documents
- Compliance documents to submit
- Training modules (shared with all users)

**What they CAN'T see**:
- Other agents' data
- Admin controls
- Broker settings
- Commission approval workflows

---

## Broker/Admin Dashboard Experience

**Route**: `/admin/dashboard`  
**Who sees it**: Users with role = 'broker' or 'admin'  
**What they see**:
- All agents' deals
- All agents' commissions
- All agents' documents
- Compliance submissions to review
- Agent management tools
- Commission approval workflows
- Broker settings

**Pages Available**:
- `/admin/dashboard` - Overview of all activity
- `/admin/agents` - Manage agents
- `/admin/deals` - View all deals
- `/admin/commissions` - Approve commissions
- `/admin/compliance` - Review compliance docs
- `/admin/settings` - Configure broker rules

---

## Implementation Details

### Updated Files

**API Service Layer** (`/lib/vault-client.ts`):
- All vaultAPI methods now accept optional `userRole` parameter
- Role is passed as X-User-Role header to Vault API

**Updated Pages**:
```
✅ /app/dashboard/page.tsx → passes role to vaultAPI
✅ /app/commission-calculator/page.tsx → passes role
✅ /app/compliance/page.tsx → passes role
✅ /app/documents/page.tsx → passes role
✅ /app/training/page.tsx → uses shared data (no filtering)
```

**New Admin Pages**:
```
✅ /app/admin/layout.tsx → Admin navigation sidebar
✅ /app/admin/dashboard/page.tsx → Admin overview
✅ /app/admin/agents/page.tsx → Agent management
✅ /app/admin/deals/page.tsx → All deals
✅ /app/admin/commissions/page.tsx → Commission approvals
✅ /app/admin/compliance/page.tsx → Compliance review
✅ /app/admin/settings/page.tsx → Broker configuration
```

**Home Page Router** (`/app/page.tsx`):
```typescript
if (role === 'admin' || role === 'broker') {
  router.push('/admin/dashboard')
} else {
  router.push('/dashboard')
}
```

### Auth Provider

The existing auth context in `/app/providers.tsx` already:
- Fetches user role from profiles table
- Provides role through useAuth hook
- Maintains role across page navigation

---

## Usage Examples

### Agent Using the Portal

```typescript
import { useAuth } from '@/app/providers'
import { vaultAPI } from '@/lib/vault-client'

function MyDeals() {
  const { user, role } = useAuth()

  // Agent's own deals
  const deals = await vaultAPI.deals.list(user.id, role)
  // Vault returns: only deals where agent_id = user.id
}
```

### Broker Using the Admin Portal

```typescript
import { useAuth } from '@/app/providers'
import { vaultAPI } from '@/lib/vault-client'

function AllAgentDeals() {
  const { user, role } = useAuth()

  // All agents' deals
  const deals = await vaultAPI.deals.list(user.id, role)
  // Vault returns: all deals from all agents (because role = 'broker')
}
```

---

## Security Model

### Data Access Control

1. **X-User-ID Header** - Identifies the requesting user
2. **X-User-Role Header** - Determines access level
3. **Vault Backend Validation** - Server-side filtering ensures no data leakage

### Frontend Enforcement

1. **Routing** - Wrong paths redirect to correct dashboard
2. **Component Visibility** - Admin features hidden from agents
3. **API Filtering** - Role passed to all API calls

### Backend Enforcement (Vault)

1. **Role Validation** - Server validates role on each request
2. **Data Filtering** - Returns only appropriate data for role
3. **Audit Logging** - Tracks all access (in Vault backend)

---

## Adding New Features

### For Agent Features

1. Add page at `/app/[feature]/page.tsx`
2. Use `useAuth()` to get user and role
3. Call vaultAPI with role: `await vaultAPI.method(user.id, role)`
4. Vault automatically filters to agent's own data

### For Broker Features

1. Add page at `/app/admin/[feature]/page.tsx`
2. Redirect non-admins: `if (role !== 'admin' && role !== 'broker') redirect('/dashboard')`
3. Call vaultAPI with role: `await vaultAPI.method(user.id, role)`
4. Vault automatically returns all agents' data

---

## Testing RBAC

### Test Agent Access

1. Login with agent account
2. Verify at `/dashboard` (not `/admin/dashboard`)
3. Verify commission calculations use agent commission rules
4. Verify only own deals are shown
5. Verify compliance documents can be submitted

### Test Admin Access

1. Login with admin account
2. Verify at `/admin/dashboard` (not `/dashboard`)
3. Verify all agents' deals are visible
4. Verify commission approval features available
5. Verify compliance review interface visible

### Test Data Filtering

1. Login as Agent A
2. Call `/api/deals` - should show only Agent A's deals
3. Logout, login as Admin
4. Call `/api/deals` - should show all agents' deals
5. Call `/api/deals` - Agent A's deals should be included

---

## Role Configuration

### Setting User Roles

In Supabase:

```sql
-- Set user as agent
UPDATE profiles 
SET role = 'agent' 
WHERE id = 'user_id'

-- Set user as broker/admin
UPDATE profiles 
SET role = 'broker' 
WHERE id = 'broker_user_id'
```

### Role Options

- `'agent'` - Regular agent (default)
- `'broker'` - Broker with full admin access
- `'admin'` - Admin user with full access

---

## Common Issues & Solutions

### Issue: User sees wrong dashboard
**Solution**: Check role in Supabase profiles table
```sql
SELECT id, role FROM profiles WHERE email = 'user@example.com'
```

### Issue: Data not filtering correctly
**Solution**: Verify X-User-Role header is being sent
- Check browser DevTools → Network tab
- Look for X-User-Role header in API requests
- Vault must be receiving the role header

### Issue: Can't access admin features
**Solution**: 
- Verify role is 'broker' or 'admin' (not 'agent')
- Refresh page after role change
- Check browser cache (may need to clear)

---

## Future Enhancements

- [ ] Role management UI in admin settings
- [ ] Custom role creation
- [ ] Granular permission settings
- [ ] Audit log view for compliance
- [ ] Role-based feature flags
- [ ] API key management for integrations

---

## Architecture Summary

```
User Authentication
        ↓
   Role Assignment
        ↓
    Router Logic
        ↓
   Correct Dashboard
        ↓
    vaultAPI Calls
        ↓
Pass X-User-Role Header
        ↓
   Vault Backend
        ↓
  Filter by Role
        ↓
  Return Appropriate Data
```

---

**Status**: Phase 4 - Role-Based Access Complete ✅  
**Last Updated**: April 7, 2026  
**Ready for**: Testing with real user accounts and data
