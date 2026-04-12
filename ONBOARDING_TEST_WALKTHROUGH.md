# 🧪 Live Onboarding System Test Walkthrough

**Complete end-to-end testing of: DocuSign → Google Workspace → SendGrid → Supabase → Agent Login**

Follow this checklist step-by-step. Each section takes 2-5 minutes.

---

## ✅ Pre-Test Checklist

Before starting, verify:

- [ ] Portal is running: `npm run dev` (should be at http://localhost:3000)
- [ ] .env.local has all environment variables added
- [ ] You are logged into Portal as admin/broker user
- [ ] You have access to a test email inbox (your personal email)
- [ ] You are logged into Google Workspace Admin Console
- [ ] You are logged into Supabase dashboard
- [ ] You are logged into SendGrid dashboard

---

## 📊 Test Data

Use this information for testing:

```
Agent Name: Test Agent One
First Name: Test
Last Name: Agent
Email: testoneagent@gmail.com (use YOUR email here)
Expected Brokerage Email: test.agent@hartfeltrealestate.com
```

Write down your actual email so you can check it for the welcome email:
```
My Test Email: _________________________
```

---

## Test 1: Upload Onboarding Document (5 min)

### Step 1.1: Navigate to Onboarding Page
```
1. Go to http://localhost:3000/dashboard
2. Scroll down to "Admin Tools" section
3. Click the "Onboarding" card (blue, with clipboard icon)
   OR go directly to: http://localhost:3000/admin/onboarding

You should see three tabs:
- Documents (currently active)
- Invites
- Approvals
```

**✅ Check: Can you see the Documents tab with "Upload Document" button?**

### Step 1.2: Upload a Document
```
1. Click "Upload Document" button
2. Enter Name: "HartFelt Agent Agreement - 2025"
3. Click "Upload PDF" 
4. Select any PDF file from your computer
5. Click "Upload Document"
```

**✅ Check: Document appears in the list below with your name and today's date?**

---

## Test 2: Send Signing Invite (5 min)

### Step 2.1: Go to Invites Tab
```
1. Click "Invites" tab at the top
2. Click "Send New Invite" button
3. A form appears with three fields
```

### Step 2.2: Fill in Agent Information
```
1. First Name: Test
2. Last Name: Agent
3. Email: [YOUR ACTUAL EMAIL]
   (This is where the agent will receive the signing link)

4. Click "Send Signing Invite"
```

**✅ Check: A new invite appears in the list with status "Pending Invite"?**

**📝 Note:** The signing link is displayed. In production with DocuSign, the agent would receive an email with this link.

---

## Test 3: Simulate Document Signing (10 min)

Since we're testing locally, we'll manually mark the documents as signed.

### Step 3.1: Open Supabase Dashboard
```
1. Open Supabase in a new tab
2. Go to your project
3. Click "Table Editor" in the left sidebar
4. Find and click "onboarding_invites" table
5. You should see the Test Agent One row you just created
```

### Step 3.2: Mark Document as Signed
```
1. Click on the Test Agent row to open it for editing
2. Find the "status" column
3. Change from "pending_invite" to "signed"
4. Find the "signed_at" column
5. Click on it and set it to current time (NOW())
6. Click "Save" or close to save
```

**✅ Check: The row now shows status = "signed" and signed_at has a timestamp?**

### Step 3.3: Refresh Portal
```
1. Go back to Portal (onboarding page)
2. Click "Approvals" tab at the top
3. You should see Test Agent One listed with:
   - Status: "Awaiting Approval"
   - Red badge showing "1" pending approval
```

**✅ Check: Test Agent appears in Approvals tab?**

---

## Test 4: Approve Agent (3 min)

### Step 4.1: Approve the Agent
```
1. On Approvals tab, you see Test Agent One
2. There's a blue button: "Approve & Create Email"
3. Click this button
```

**What happens:**
- ✅ Status changes to "Approved"
- ✅ Email account created in Google Workspace
- ✅ Shows: "test.agent@hartfeltrealestate.com"

### Step 4.2: Verify Google Workspace Account
```
1. Open Google Workspace Admin Console in new tab
   https://admin.google.com/
2. Go to "Users & Accounts" > "Users"
3. Search for: "test.agent"
4. You should see the account just created
5. Check:
   - Email: test.agent@hartfeltrealestate.com ✅
   - Name: Test Agent ✅
```

**✅ Check: Google Workspace account exists and is active?**

---

## Test 5: Send Credentials (3 min)

### Step 5.1: Send Credentials
```
1. Back on Portal, still on Approvals tab
2. Test Agent now shows: "Approved" status
3. There's a purple button: "Send Credentials to Agent"
4. Click this button
```

**What happens:**
- ✅ Status changes to "Provisioned"
- ✅ Supabase user account created
- ✅ Welcome email sent to your test email
- ✅ Agent moves to "Recently Provisioned" section

### Step 5.2: Verify Supabase User Created
```
1. Open Supabase dashboard
2. Go to "Authentication" > "Users" in left sidebar
3. Search for: "test.agent@hartfeltrealestate.com"
4. You should see the user just created
5. Check:
   - Email: test.agent@hartfeltrealestate.com ✅
   - User ID: populated ✅
   - Confirmed Email: Yes ✅
```

**✅ Check: Supabase user exists with correct email?**

### Step 5.3: Check Welcome Email
```
1. Go to YOUR test email inbox
2. Look for email from: noreply@hartfeltrealestate.com
3. Subject: "Welcome to HartFelt! Your Portal Access"
4. Check:
   - Brokerage Email: test.agent@hartfeltrealestate.com ✅
   - Temporary Password: [visible] ✅
   - Portal link: https://portal.hartfelt.com ✅
   - EASE app download info ✅
```

**⚠️ Important:** The email might be in spam folder. Check there if you don't see it in Inbox!

**✅ Check: Welcome email received with all credentials?**

---

## Test 6: Agent Login (5 min)

### Step 6.1: Logout from Admin
```
1. On Portal, click "Sign Out" (top right)
2. You should be on login page
```

### Step 6.2: Login as Agent
```
1. On login page, enter:
   Email: test.agent@hartfeltrealestate.com
   Password: [the temporary password from the email]
2. Click "Sign In"
```

**✅ Check: Successfully logged in to Portal as agent?**

### Step 6.3: Verify Agent Dashboard
```
1. You should be on the Dashboard
2. Check:
   - Email in top right: test.agent@hartfeltrealestate.com ✅
   - Role in top right: "agent" ✅
   - Can see all agent features (My Leads, Deal Pipeline, etc.) ✅
   - Cannot see Admin Tools (correct - agents don't see those) ✅
```

**✅ Check: Agent account is fully functional and logged in?**

---

## Test 7: Verify Complete Integration (5 min)

Let's verify the entire chain worked:

### Checklist:
```
✅ Step 1: Document uploaded to Portal
✅ Step 2: Invite sent with unique ID
✅ Step 3: Document marked as signed (manual Supabase update)
✅ Step 4: Agent approved in Portal
✅ Step 5: Email created in Google Workspace
✅ Step 6: User created in Supabase
✅ Step 7: Welcome email sent via SendGrid
✅ Step 8: Agent successfully logged in
```

---

## 🎉 Test Complete!

If all checkmarks passed, your onboarding system is **fully functional** and ready for:

1. **Live Testing** - Create real agents with actual DocuSign envelopes
2. **Production Deployment** - Deploy to live environment
3. **Admin Training** - Train your team to use `/admin/onboarding`

---

## Troubleshooting During Test

| Issue | Solution |
|-------|----------|
| "Invite doesn't appear" | Refresh page, or check Portal console for errors |
| "Status not updating in Supabase" | Make sure you click Save after editing |
| "Agent doesn't appear in Approvals" | Refresh Portal page after updating Supabase |
| "Google account not created" | Check env variables, especially GOOGLE_SERVICE_ACCOUNT JSON |
| "Welcome email not received" | Check spam folder, or check SendGrid logs in dashboard |
| "Can't login as agent" | Verify email/password are exactly correct (copy from email) |
| "Login succeeds but see blank page" | Check browser console (F12) for errors |

---

## What's Different from DocuSign Integration?

In this test, we **manually simulated the DocuSign signing** by updating Supabase directly.

In **production**, here's what happens:

```
Agent clicks signing link (from email)
    ↓
DocuSign interface opens
    ↓
Agent signs documents
    ↓
DocuSign sends webhook to your Portal
    ↓
Portal automatically updates status to "signed"
    ↓
Admin sees "Awaiting Approval" notification
    ↓
Admin approves in Portal
    ↓
Rest is the same...
```

The webhook handler is already built in: `app/api/onboarding/webhook/route.ts`

---

## Next Steps

### After Successful Test:

1. **Test with Real DocuSign**
   - Use the DocuSign credentials in your .env.local
   - Send a real signing envelope
   - Let DocuSign webhook auto-detect signature

2. **Full Production Setup**
   - Deploy to production domain
   - Update webhook URLs
   - Train admin team

3. **Add More Agents**
   - Now you know the workflow
   - You can onboard real agents
   - System is proven and working

---

## Test Results Summary

Fill this out when you complete the test:

```
Test Date: ________________
Tester Name: ________________

Results:
☐ Document Upload: PASS / FAIL
☐ Send Invite: PASS / FAIL
☐ Simulate Signing: PASS / FAIL
☐ Agent Approval: PASS / FAIL
☐ Google Account Creation: PASS / FAIL
☐ Supabase User Creation: PASS / FAIL
☐ Welcome Email: PASS / FAIL
☐ Agent Login: PASS / FAIL

Overall: ☐ PASS ☐ FAIL

Issues Encountered:
_________________________________
_________________________________

Notes:
_________________________________
_________________________________
```

---

## Questions or Issues?

If you get stuck on any step, check:
1. `COMPLETE_SETUP_GUIDE.md` - Detailed setup instructions
2. `ONBOARDING_SETUP.md` - Technical reference
3. Browser console (F12) - For error messages
4. `.env.local` - Verify all credentials are present

**You're ready! Start with Test 1 and follow the steps.**
