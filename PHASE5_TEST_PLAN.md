# Phase 5: Testing & Validation Plan

**Objective**: Validate Portal functionality, role-based access, data filtering, and API integration before production deployment.

**Timeline**: 1-2 weeks of testing across 4 test types

---

## Test Environment Setup

### Prerequisites

1. **Supabase Setup**
   - Test database with sample data
   - Test user accounts (agent + admin)
   - Profiles table with correct roles

2. **Vault API**
   - Running on 192.168.6.88:3000
   - Test data loaded
   - API endpoints responding

3. **Test Portal**
   - Running on http://localhost:3000
   - Dev environment
   - Console logging enabled

### Test Data Needed

```
Supabase Profiles:
├─ Agent 1 (agent1@hartfelt.com) - role: 'agent'
├─ Agent 2 (agent2@hartfelt.com) - role: 'agent'
├─ Broker (broker@hartfelt.com) - role: 'broker'
└─ Admin (admin@hartfelt.com) - role: 'admin'

Vault Test Data:
├─ 10+ deals for Agent 1
├─ 10+ deals for Agent 2
├─ Commissions for each deal
├─ Sample documents
└─ Compliance submissions
```

---

## Test Categories

### 1. Functional Testing

#### 1.1 Authentication & Authorization
- [ ] User can login with email/password
- [ ] Session persists across navigation
- [ ] User can logout
- [ ] Invalid credentials rejected
- [ ] Expired sessions redirected to login

#### 1.2 Role-Based Routing
- [ ] Agent login → redirects to `/dashboard`
- [ ] Broker login → redirects to `/admin/dashboard`
- [ ] Admin login → redirects to `/admin/dashboard`
- [ ] Non-admin can't access `/admin/*` routes
- [ ] Admin can't see agent-only features (check: should they?)

#### 1.3 Agent Dashboard
- [ ] Dashboard loads without errors
- [ ] Shows only agent's deals
- [ ] Shows only agent's commissions
- [ ] Stats calculated correctly
- [ ] Recent deals table populated
- [ ] Quick access cards visible
- [ ] Logout button works

#### 1.4 Commission Calculator
- [ ] Local calculation works
- [ ] Values update in real-time
- [ ] "Calculate with Vault" button functional
- [ ] Vault result displays correctly
- [ ] Local vs Vault results shown
- [ ] Reset button clears form

#### 1.5 Compliance Documents
- [ ] Can select transaction stage
- [ ] Can upload files (drag-drop and click)
- [ ] File validation working
- [ ] AI analysis runs
- [ ] Results displayed to user
- [ ] Multiple files handled
- [ ] Error messages clear

#### 1.6 Document Library
- [ ] Documents load from Vault
- [ ] Organized by category
- [ ] File metadata displayed
- [ ] Download links work
- [ ] Fallback templates shown if empty

#### 1.7 Training Modules
- [ ] Training data loads from Supabase
- [ ] Courses display correctly
- [ ] Progress calculations work
- [ ] Course details visible
- [ ] Difficulty levels shown

#### 1.8 Admin Dashboard
- [ ] Shows all agents' data
- [ ] Stats aggregated correctly
- [ ] All agents listed
- [ ] Deal count accurate
- [ ] Commission total correct
- [ ] Quick access cards work

#### 1.9 Admin Pages
- [ ] **Agents**: List shows all agents
- [ ] **Deals**: Shows all deals from all agents
- [ ] **Commissions**: Lists all commissions
- [ ] **Compliance**: Shows submission interface
- [ ] **Settings**: Configuration interface visible

---

### 2. Data Filtering Testing (Critical)

#### 2.1 Agent Data Access
Test: Login as Agent 1

- [ ] Agent 1 sees only Agent 1's deals
- [ ] Agent 1 sees only Agent 1's commissions
- [ ] Agent 1 sees only Agent 1's documents
- [ ] Agent 1 does NOT see Agent 2's deals
- [ ] Agent 1 does NOT see Agent 2's commissions
- [ ] Dashboard stats are for Agent 1 only

Test: Login as Agent 2

- [ ] Agent 2 sees only Agent 2's deals
- [ ] Agent 2 sees only Agent 2's commissions
- [ ] Agent 2 does NOT see Agent 1's deals
- [ ] Two agents' data completely isolated

#### 2.2 Admin Data Access
Test: Login as Broker

- [ ] Broker sees all agents' deals
- [ ] Broker sees Agent 1's deals
- [ ] Broker sees Agent 2's deals
- [ ] Total deal count = Agent 1 deals + Agent 2 deals
- [ ] Commission total aggregates all agents
- [ ] Agent list shows all agents

#### 2.3 API Header Validation

Monitor Network Tab (F12 → Network):

- [ ] X-User-ID header present in all requests
- [ ] X-User-Role header present in all API calls
- [ ] X-User-Role = 'agent' for agent account
- [ ] X-User-Role = 'broker' for broker account
- [ ] Headers sent to Vault API endpoint

**Test Command**:
```bash
# In browser console, monitor these requests:
# GET /api/deals
# GET /api/commissions
# GET /api/documents
# Check DevTools → Network → Headers
```

---

### 3. Commission Calculation Testing

#### 3.1 Local Calculation
- [ ] Sale Price: $500,000 inputs correctly
- [ ] Commission Rate: 5% inputs correctly
- [ ] Broker Split: 80% inputs correctly
- [ ] Referral Fee: 0% optional, can input
- [ ] Transaction Fee: $295 optional, can input

**Test Case 1**: Basic calculation
```
Sale Price: $500,000
Commission Rate: 5%
Broker Split: 80%
Expected Gross: $25,000
Expected Agent Split: $20,000
Expected Net: $20,000 - $295 = $19,705
```

- [ ] Local result matches expected
- [ ] UI displays formatted currency

#### 3.2 Vault Calculation
- [ ] Click "Calculate with Vault"
- [ ] Loading state appears
- [ ] Vault response received
- [ ] Result displays correctly
- [ ] Breakdown shows line items
- [ ] Purple highlight indicates Vault result

#### 3.3 Various Scenarios

Test multiple commission structures:

**Scenario A**: Standard deal
- $750,000 sale, 5% commission, 80% broker split
- Expected: $30,000 gross, $24,000 agent

**Scenario B**: With referral fee
- $500,000 sale, 5% commission, 80% split, 25% referral
- Expected: $20,000 gross, $15,000 agent, -$3,750 referral

**Scenario C**: High-value deal
- $2,000,000 sale, 5% commission, 85% split
- Expected: $100,000 gross, $85,000 agent

---

### 4. Compliance Document Testing

#### 4.1 Document Upload
- [ ] Can select Listing stage
- [ ] Can select Under Contract stage
- [ ] Can select Closing stage
- [ ] Selected stage highlighted
- [ ] File upload area visible
- [ ] Can drag-drop files
- [ ] Can click and select files
- [ ] Multiple files selectable
- [ ] File list shows selected files
- [ ] File sizes displayed

#### 4.2 AI Analysis
- [ ] Click "Analyze & Upload Documents"
- [ ] Loading state shows
- [ ] AI analysis runs (may take a few seconds)
- [ ] Results display
- [ ] Issues/warnings shown if any
- [ ] Success message appears
- [ ] Files uploaded to Vault
- [ ] No console errors

#### 4.3 File Type Support
Test uploading various files:
- [ ] PDF files accepted
- [ ] DOC files accepted
- [ ] DOCX files accepted
- [ ] PNG images accepted
- [ ] JPG images accepted
- [ ] Unsupported types rejected with message
- [ ] Large files handled (if size limit: test limits)

#### 4.4 Error Handling
- [ ] Empty upload with no files → error message
- [ ] No stage selected → error message
- [ ] Vault API error → handled gracefully
- [ ] Network timeout → error message
- [ ] User can retry after error

---

### 5. Multi-Agent Scenario Testing

#### 5.1 Agent 1 → Agent 2 Isolation

**Step 1**: Login as Agent 1
- [ ] See Dashboard with Agent 1 deals
- [ ] Note total deal count (e.g., 8 deals)
- [ ] Note total commission (e.g., $125,000)

**Step 2**: Logout, Login as Agent 2
- [ ] Different deals displayed
- [ ] Different commission total
- [ ] Different commission breakdown
- [ ] Data completely isolated from Agent 1

**Step 3**: Verify no data bleeding
- [ ] Agent 1's deal addresses not visible
- [ ] Agent 1's commission amounts different
- [ ] No cross-contamination

#### 5.2 Broker → All Agents View

**Step 1**: Login as Broker
- [ ] Admin Dashboard loads
- [ ] Total deal count = Agent 1 deals + Agent 2 deals
- [ ] Total commission aggregated
- [ ] Both agents' deals in table

**Step 2**: Navigate to Agents page
- [ ] Both agents listed
- [ ] Agent 1 deal count correct
- [ ] Agent 2 deal count correct

**Step 3**: Navigate to Deals page
- [ ] All deals visible
- [ ] Both agents' deals shown
- [ ] Agent name in each row

---

### 6. API Integration Testing

#### 6.1 Network Requests

Monitor in DevTools → Network:

**Login**
- [ ] POST /auth/v1/token - returns session token
- [ ] Status 200 OK

**Dashboard Load**
- [ ] GET /api/deals - returns deals
- [ ] Includes X-User-ID header
- [ ] Includes X-User-Role header
- [ ] Status 200 OK

**Commission Calculation**
- [ ] POST /api/commissions/calculate
- [ ] Body includes parameters
- [ ] Headers include X-User-Role
- [ ] Status 200 OK
- [ ] Response includes calculated amounts

**Document Upload**
- [ ] POST /api/documents
- [ ] FormData with file
- [ ] Headers include X-User-Role
- [ ] Status 200 OK

#### 6.2 Error Responses

Test API error handling:

- [ ] 401 Unauthorized → redirects to login
- [ ] 403 Forbidden → shows error message
- [ ] 404 Not Found → handled gracefully
- [ ] 500 Server Error → shows error message
- [ ] Network timeout → shows error message
- [ ] Invalid response → logged to console

#### 6.3 Response Data Validation

Check API responses contain expected data:

**Deals Response**:
```json
{
  "deals": [
    {
      "id": "deal_123",
      "agent_id": "user_456",
      "agent_name": "Agent Name",
      "property_address": "123 Main St",
      "contract_price": 500000,
      "status": "active",
      ...
    }
  ]
}
```

- [ ] Deal structure correct
- [ ] All fields present
- [ ] Data types correct
- [ ] No null values for required fields

---

### 7. Performance Testing

#### 7.1 Page Load Times

Measure load time for each page:

- [ ] Dashboard: < 2 seconds
- [ ] Commission Calculator: < 1 second
- [ ] Documents: < 2 seconds
- [ ] Compliance: < 2 seconds
- [ ] Admin Dashboard: < 3 seconds
- [ ] Admin Agents: < 2 seconds
- [ ] Admin Deals: < 3 seconds

**Method**: Open DevTools → Performance tab → Record

#### 7.2 API Response Times

Measure Vault API response times:

- [ ] /api/deals: < 1 second
- [ ] /api/commissions: < 1 second
- [ ] /api/documents: < 1 second
- [ ] /api/commissions/calculate: < 2 seconds
- [ ] /api/ai/analyze-document: < 3 seconds

**Method**: DevTools → Network → note "Time" column

#### 7.3 Load Test (Concurrent Users)

Test Portal with multiple simultaneous connections:

- [ ] 5 concurrent agents → no errors
- [ ] 10 concurrent agents → no errors
- [ ] 1 broker + 10 agents → no errors
- [ ] No memory leaks over 30 minutes
- [ ] No console errors under load

**Tool**: Apache JMeter or similar

---

### 8. User Experience Testing

#### 8.1 Navigation

- [ ] All links work
- [ ] Navigation flows logically
- [ ] Back button works
- [ ] Breadcrumbs clear (if present)
- [ ] Mobile responsive (if applicable)

#### 8.2 Error Messages

- [ ] Messages are user-friendly
- [ ] Messages explain what went wrong
- [ ] Messages suggest actions
- [ ] Messages don't contain jargon
- [ ] Error colors consistent

#### 8.3 Loading States

- [ ] Loading indicators appear
- [ ] Loading text is clear
- [ ] Spinners/animations smooth
- [ ] Content doesn't flash
- [ ] Proper state transitions

#### 8.4 Forms & Inputs

- [ ] Form fields obvious
- [ ] Labels clear
- [ ] Placeholders helpful
- [ ] Tab order logical
- [ ] Enter key submits
- [ ] Reset works

---

## Test Execution

### Test Environment Checklist

Before testing:

- [ ] Supabase running and accessible
- [ ] Vault API running (192.168.6.88:3000)
- [ ] Portal running (localhost:3000)
- [ ] Test user accounts created
- [ ] Test data loaded in Vault
- [ ] Browser DevTools open
- [ ] Console logging enabled
- [ ] No browser extensions interfering

### Test Execution Steps

1. **Day 1-2: Authentication & Basic Navigation**
   - Test authentication flows
   - Test role-based routing
   - Test dashboard loads
   - Verify basic UI works

2. **Day 3-4: Data Filtering (Most Critical)**
   - Test agent sees only own data
   - Test admin sees all data
   - Verify API headers correct
   - Check network requests

3. **Day 5: Feature Testing**
   - Commission calculations
   - Document uploads
   - Training modules
   - Admin features

4. **Day 6-7: Multi-Agent Scenarios**
   - Test with 2+ agents
   - Test admin aggregation
   - Test data isolation

5. **Day 8+: Load Testing & Edge Cases**
   - Concurrent user testing
   - Error scenarios
   - Performance validation

---

## Test Report Template

Create report after testing:

```markdown
# Portal Test Report
**Date**: [Date]
**Tester**: [Name]
**Environment**: [Dev/Staging/Prod]
**Duration**: [X hours]

## Summary
- Total Tests: X
- Passed: X
- Failed: X
- Blocked: X
- Pass Rate: X%

## Critical Issues
[List critical bugs]

## Major Issues
[List major bugs]

## Minor Issues
[List minor bugs]

## Recommendations
[Next steps]

## Sign-Off
[Approval for production]
```

---

## Success Criteria

Portal ready for production deployment when:

- ✅ All authentication tests pass
- ✅ All role-based filtering tests pass (CRITICAL)
- ✅ All data isolation tests pass (CRITICAL)
- ✅ Commission calculations verified
- ✅ Document upload/analysis works
- ✅ No critical bugs remaining
- ✅ No major bugs blocking functionality
- ✅ Performance acceptable (< 3s page loads)
- ✅ Load tested with 10+ concurrent users

---

## Known Test Limitations

- Mobile testing scope: TBD
- Accessibility (a11y) testing: Optional
- Localization testing: Not required
- Browser compatibility: Chrome only (for now)
- API uptime requirements: To be determined

---

## Post-Test Deliverables

1. **Test Report** - Detailed results
2. **Bug List** - Issues found, severity, status
3. **Performance Metrics** - Load times, response times
4. **Sign-Off Document** - Ready for production approval
5. **Known Issues Doc** - Any items for Phase 6

---

**Test Plan Status**: Ready to execute  
**Target Completion**: 1-2 weeks  
**Next Phase**: Production deployment after sign-off
