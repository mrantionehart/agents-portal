# Portal Testing Checklist

**Tester**: _______________  
**Date**: _______________  
**Build Version**: _______________  

---

## Pre-Test Setup

- [ ] Supabase running and accessible
- [ ] Vault API running (192.168.6.88:3000)
- [ ] Portal running (http://localhost:3000)
- [ ] Test data loaded in Vault
- [ ] Test user accounts created:
  - [ ] Agent 1: agent1@hartfelt.com (role: agent)
  - [ ] Agent 2: agent2@hartfelt.com (role: agent)
  - [ ] Broker: broker@hartfelt.com (role: broker)
  - [ ] Admin: admin@hartfelt.com (role: admin)
- [ ] Browser: Chrome (latest)
- [ ] DevTools: Open and console enabled
- [ ] Network monitoring: Ready

---

## Day 1: Authentication & Navigation

### Login Functionality

**Test as Agent 1**
- [ ] Can login with agent1@hartfelt.com
- [ ] Enter correct password → logs in
- [ ] Enter wrong password → error message
- [ ] Session persists after refresh
- [ ] Can navigate to dashboard
- [ ] Logout button works
- [ ] After logout, redirects to login

**Test as Broker**
- [ ] Can login with broker@hartfelt.com
- [ ] Session persists
- [ ] Can logout

**Test as Admin**
- [ ] Can login with admin@hartfelt.com
- [ ] Session persists
- [ ] Can logout

### Route Navigation

**As Agent**
- [ ] Login → redirects to `/dashboard` (not `/admin`)
- [ ] Can navigate to `/commission-calculator`
- [ ] Can navigate to `/compliance`
- [ ] Can navigate to `/documents`
- [ ] Can navigate to `/training`
- [ ] Cannot access `/admin/dashboard` (redirects to `/dashboard`)
- [ ] Cannot access `/admin/agents`

**As Broker**
- [ ] Login → redirects to `/admin/dashboard`
- [ ] Can navigate to `/admin/agents`
- [ ] Can navigate to `/admin/deals`
- [ ] Can navigate to `/admin/commissions`
- [ ] Can navigate to `/admin/compliance`
- [ ] Can navigate to `/admin/settings`

### Page Load

- [ ] Dashboard loads without errors
- [ ] No 404 errors
- [ ] Console has no critical errors
- [ ] Network requests all successful (200 status)
- [ ] Page loads in < 3 seconds

---

## Day 2: Agent Dashboard Testing

### Dashboard Display

**Login as Agent 1**
- [ ] Dashboard loads
- [ ] Title shows "HartFelt Agents Portal"
- [ ] Username displayed: agent1@hartfelt.com
- [ ] Role shows: "agent"

### Stats Section

- [ ] "Total Deals" stat displays (should match Agent 1's deal count)
- [ ] "Total Commissions" stat displays in $K format
- [ ] "Net Earned" stat displays in $K format
- [ ] Stats are numeric values

### Deals Table

- [ ] Recent Deals section loads
- [ ] Table headers: Property, Type, Status, Price
- [ ] Shows up to 5 most recent deals
- [ ] Deal addresses visible
- [ ] Status badges show
- [ ] Prices formatted with commas
- [ ] "View all deals →" link visible

### Quick Access Cards

- [ ] Training card clickable
- [ ] MLS Login card (may be stub)
- [ ] Contracts & Documents card clickable
- [ ] Marketing Resources card clickable
- [ ] All cards have icons and descriptions

### Quick Tools Panel

- [ ] Commission Calculator link works
- [ ] View Commissions link works
- [ ] Compliance Docs link works
- [ ] Support button visible

### Data Isolation Check

**Critical: Verify Agent 1 sees only Agent 1 data**
- [ ] Deal addresses match Agent 1's deals (not Agent 2's)
- [ ] Total deal count ≠ Agent 2's count
- [ ] Commission total matches Agent 1's commissions
- [ ] DevTools: Check X-User-Role = "agent"
- [ ] DevTools: Check X-User-ID = Agent 1's ID

**Login as Agent 2 (in new incognito window)**
- [ ] Different deals displayed than Agent 1
- [ ] Different commission total
- [ ] Agent 1's data NOT visible
- [ ] Completely isolated experience

---

## Day 3: Commission Calculator Testing

### Local Calculation

**Test: Basic Deal**
```
Input:
- Sale Price: $500,000
- Commission Rate: 5%
- Broker Split: 80%

Expected:
- Gross Commission: $25,000
- Your Split (80%): $20,000
- Net Commission: $20,000
```

- [ ] Gross Commission displays: $25,000.00
- [ ] Your Split (80%) displays: $20,000.00
- [ ] Net Commission displays: $20,000.00
- [ ] All values formatted with commas

**Test: With Referral Fee**
```
Input:
- Sale Price: $500,000
- Commission Rate: 5%
- Broker Split: 80%
- Referral Fee: 25%

Expected:
- Your Split: $20,000
- Referral Fee (25%): -$5,000
- Net Commission: $15,000
```

- [ ] Referral Fee field appears when entered
- [ ] Referral Fee deduction shows: -$5,000
- [ ] Net Commission: $15,000
- [ ] Negative amounts show in red

**Test: With Transaction Fee**
```
Input:
- Sale Price: $500,000
- Commission Rate: 5%
- Broker Split: 80%
- Transaction Fee: $295

Expected:
- Your Split: $20,000
- Transaction Fee: -$295
- Net Commission: $19,705
```

- [ ] Transaction Fee deduction shows: -$295
- [ ] Net Commission: $19,705
- [ ] All fees subtract properly

**Test: Reset Button**
- [ ] Click Reset Calculator
- [ ] All fields reset to defaults
- [ ] No errors on reset
- [ ] Calculation updates

### Vault Integration

**Calculate with Vault**
- [ ] "Calculate with Vault" button visible
- [ ] Click button → Loading indicator shows
- [ ] Vault calculation completes (< 2 seconds)
- [ ] Purple "Vault-Calculated Net Commission" header appears
- [ ] Result displays in large font
- [ ] Breakdown shows

**Vault vs Local Comparison**
- [ ] Both results visible
- [ ] Results can be compared
- [ ] Vault result may differ from local (broker rules)
- [ ] No errors on Vault call

---

## Day 4: Compliance Documents Testing

### Stage Selection

**Test Stage Selection**
- [ ] Listing stage card clickable
- [ ] Under Contract stage card clickable
- [ ] Closing stage card clickable
- [ ] Selected stage highlighted in blue
- [ ] Stage name displays in summary

### File Upload

**Test File Selection**
- [ ] Drag-drop area visible when stage selected
- [ ] Can drag PDF file into upload area
- [ ] Can click to select file
- [ ] File appears in "Selected Files" list
- [ ] File size displays (e.g., "1024.50 KB")

**Test Multiple Files**
- [ ] Can upload 3+ files at once
- [ ] All files listed
- [ ] All file sizes shown
- [ ] No file size limit errors

**Test File Types**
- [ ] PDF file accepted
- [ ] DOC file accepted
- [ ] DOCX file accepted
- [ ] PNG image accepted
- [ ] JPG image accepted
- [ ] Other file types may be rejected (expected)

### Analysis & Upload

**Test Analysis**
- [ ] Click "Analyze & Upload Documents"
- [ ] Loading state appears: "Analyzing & Uploading..."
- [ ] AI analysis runs (may take 3-5 seconds)
- [ ] Green success banner appears
- [ ] "Document Analysis Complete" message shows

**Test Error Handling**
- [ ] Select stage but upload no files → error message
- [ ] Don't select stage but upload files → error message
- [ ] Network error → handled gracefully
- [ ] Messages are clear and helpful

---

## Day 5: Documents & Training

### Document Library

**Test Loading**
- [ ] Documents page loads
- [ ] "Contracts & Documents" title displays
- [ ] Document categories visible

**Test Organization**
- [ ] Documents grouped by category
- [ ] At least 4 categories visible:
  - [ ] Listing Agreements
  - [ ] Buyer Documents
  - [ ] Offer & Contract
  - [ ] Closing Documents
- [ ] Documents listed under categories

**Test Document Metadata**
- [ ] File names visible
- [ ] File sizes displayed (e.g., "256.45 KB")
- [ ] Icons show file types
- [ ] Hover effects work

### Training Modules

**Test Loading**
- [ ] Training page loads
- [ ] "Training Modules" title displays
- [ ] Loading indicator appears briefly

**Test Course Display**
- [ ] At least 6 courses visible
- [ ] Course titles visible
- [ ] Duration shown (e.g., "2h 30m")
- [ ] Difficulty level shown (Beginner, Intermediate, Advanced)
- [ ] Module count shown
- [ ] "Start Course" button visible

**Test Course Structure**
- [ ] Courses have consistent layout
- [ ] Cards are readable
- [ ] Difficulty colors clear:
  - [ ] Green = Beginner
  - [ ] Yellow = Intermediate
  - [ ] Red = Advanced

---

## Day 6: Admin Dashboard Testing

### Admin Access

**Login as Broker**
- [ ] Redirects to `/admin/dashboard` (not `/dashboard`)
- [ ] "Broker Admin Dashboard" title shows
- [ ] Sidebar navigation visible with dark theme
- [ ] Admin-only features visible

### Admin Stats

- [ ] "Active Agents" stat displays (should be > 1)
- [ ] "Total Deals" stat shows sum of all agents
- [ ] "Total Commission" stat shows in $M format
- [ ] "Paid Out" stat shows in $M format
- [ ] Stats are aggregated from all agents

### Admin Navigation

- [ ] Sidebar has links to:
  - [ ] Dashboard
  - [ ] Agents
  - [ ] All Deals
  - [ ] Commission Approvals
  - [ ] Compliance Review
  - [ ] Settings
  - [ ] ← Agent View (link back)

### Admin Features

**Agents Page**
- [ ] All agents listed
- [ ] Agent deal counts correct
- [ ] "View Details" buttons present

**Deals Page**
- [ ] All agents' deals visible
- [ ] Agent names shown in table
- [ ] Deal count matches agent + agent2
- [ ] Prices formatted correctly

**Commissions Page**
- [ ] All agents' commissions listed
- [ ] Gross and net amounts shown
- [ ] Status shows (Pending, Approved, Paid)
- [ ] Approve buttons visible for pending items

**Compliance Page**
- [ ] Compliance overview visible
- [ ] Coming soon message if not yet implemented
- [ ] Interface placeholder visible

---

## Day 7: Multi-Agent Data Isolation (CRITICAL)

### Agent 1 Isolation

**Login as Agent 1**
- [ ] Dashboard loads
- [ ] Note total deals: _____ (e.g., 8)
- [ ] Note total commission: _____ (e.g., $125,000)
- [ ] All deals belong to Agent 1
- [ ] No deals from Agent 2

### Agent 2 Isolation

**Logout and Login as Agent 2**
- [ ] Dashboard loads
- [ ] Note total deals: _____ (should be different from Agent 1)
- [ ] Note total commission: _____ (should be different)
- [ ] All deals belong to Agent 2
- [ ] No deals from Agent 1 visible
- [ ] Cannot see Agent 1's property addresses
- [ ] Cannot see Agent 1's commission amounts

### Complete Isolation Verification

- [ ] Agent 1 deals ≠ Agent 2 deals ✓
- [ ] Agent 1 commissions ≠ Agent 2 commissions ✓
- [ ] No data bleeding between agents ✓
- [ ] Completely separate experiences ✓

### Broker Aggregation

**Login as Broker**
- [ ] All deals from both agents visible
- [ ] Deal count = Agent 1 deals + Agent 2 deals
- [ ] Commission total = Agent 1 commissions + Agent 2 commissions
- [ ] Both agents' names visible in deal list

---

## Day 8: API Header Validation

### Network Monitoring

Open DevTools → Network Tab

**Test API Call Headers**

For any GET request to `/api/deals`:
- [ ] X-User-ID header present
- [ ] X-User-ID value = user's ID
- [ ] X-User-Role header present
- [ ] X-User-Role value = user's role
- [ ] Content-Type = application/json

**For Commission Calculation** (POST request):
- [ ] X-User-ID header present
- [ ] X-User-Role header present
- [ ] Body contains calculation parameters
- [ ] Status 200 returned

**For Document Upload** (POST request):
- [ ] X-User-ID header present
- [ ] X-User-Role header present
- [ ] FormData contains file
- [ ] Status 200 returned

### Response Validation

**Check Deal Response**
```json
{
  "deals": [
    {
      "id": "...",
      "agent_id": "...",
      "property_address": "...",
      "status": "...",
      "contract_price": ...
    }
  ]
}
```

- [ ] Response is valid JSON
- [ ] All required fields present
- [ ] Data types correct
- [ ] No null values for required fields

---

## Day 9: Performance Testing

### Page Load Times

Measure using DevTools → Performance:

- [ ] Dashboard: < 2s
  - Actual: _____ seconds
- [ ] Commission Calculator: < 1.5s
  - Actual: _____ seconds
- [ ] Documents: < 2s
  - Actual: _____ seconds
- [ ] Compliance: < 2s
  - Actual: _____ seconds
- [ ] Admin Dashboard: < 3s
  - Actual: _____ seconds

### API Response Times

Monitor in DevTools → Network → Time column:

- [ ] GET /api/deals: < 1s
  - Actual: _____ ms
- [ ] GET /api/commissions: < 1s
  - Actual: _____ ms
- [ ] POST /api/commissions/calculate: < 2s
  - Actual: _____ ms
- [ ] POST /api/ai/analyze-document: < 5s
  - Actual: _____ ms

---

## Day 10: Load Testing

### Concurrent Users

- [ ] Open 3 incognito windows with different agents
- [ ] All can navigate and load dashboards
- [ ] No errors or slowdowns
- [ ] All see correct isolated data

- [ ] Open 5 incognito windows
- [ ] All can use Portal simultaneously
- [ ] No performance degradation
- [ ] All data still correct

### Stress Test

- [ ] Leave Portal open for 1 hour
- [ ] Make various API calls throughout
- [ ] No memory leaks
- [ ] No console errors
- [ ] Still responsive

---

## Bug Log

### Critical Issues (Blocks Release)

| # | Issue | Steps | Status | Notes |
|---|-------|-------|--------|-------|
| C1 | | | [ ] | |
| C2 | | | [ ] | |

### Major Issues (Should Fix)

| # | Issue | Steps | Status | Notes |
|---|-------|-------|--------|-------|
| M1 | | | [ ] | |
| M2 | | | [ ] | |

### Minor Issues (Can Fix Later)

| # | Issue | Steps | Status | Notes |
|---|-------|-------|--------|-------|
| m1 | | | [ ] | |
| m2 | | | [ ] | |

---

## Test Summary

### Pass Rate
- **Total Tests**: _____
- **Passed**: _____
- **Failed**: _____
- **Blocked**: _____
- **Pass Rate**: _____%

### Results by Category
- **Authentication**: ___/___
- **Navigation**: ___/___
- **Dashboard**: ___/___
- **Commission Calc**: ___/___
- **Documents**: ___/___
- **Data Filtering**: ___/___
- **Performance**: ___/___

### Overall Assessment
- [ ] **READY FOR PRODUCTION** - All critical tests passed, no blocking issues
- [ ] **READY WITH KNOWN ISSUES** - Issues documented, acceptable risk
- [ ] **NOT READY** - Critical issues must be fixed

### Recommendations
[Add recommendations here]

---

## Sign-Off

**Tester Signature**: _____________________ **Date**: _______

**QA Manager Signature**: _____________________ **Date**: _______

**Product Owner Signature**: _____________________ **Date**: _______

---

**Test Completion Date**: _______  
**Total Testing Hours**: _______  
**Environment**: Development / Staging / Production
