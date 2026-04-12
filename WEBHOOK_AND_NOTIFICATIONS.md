# Webhook and Notifications Implementation

## ✅ Completed

### 1. **Webhook Signature Verification** (SECURITY FIX)
**File**: `/app/api/onboarding/webhook/route.ts`

**What was implemented**:
- ✅ Added `verifyDocuSignSignature()` function
- ✅ Uses HMAC-SHA256 for signature verification
- ✅ Uses constant-time comparison (prevents timing attacks)
- ✅ Rejects unauthorized webhook calls with 401 status
- ✅ Added proper error logging

**How it works**:
1. DocuSign sends webhook with `X-Docusign-Signature-1` header
2. Server calculates expected signature using webhook secret
3. Signatures compared using constant-time comparison
4. If mismatch: request rejected immediately
5. If valid: event processing continues

**Security Benefits**:
- Prevents spoofed webhook calls
- Prevents man-in-the-middle attacks
- Protects against timing attacks
- Only authorized DocuSign events processed

**Configuration Required**:
```
DOCUSIGN_WEBHOOK_SECRET=your-docusign-webhook-secret
```

---

### 2. **Admin Notifications System** (COMPLIANCE FEATURE)
**File**: `/app/api/onboarding/webhook/route.ts`

**What was implemented**:
- ✅ `notifyAdminsOfSignedDocuments()` - Creates in-app notifications
- ✅ `notifyAdminsViaEmail()` - Sends email alerts to admins
- ✅ Fetches all admin/broker users from database
- ✅ Creates notifications with clickable action link
- ✅ Includes email template with document review link

**Notification Flow**:
```
Agent signs documents via DocuSign
  ↓
Webhook received with signature
  ↓
Signature verified (CRITICAL)
  ↓
In-app notifications created for all admins/brokers
  ↓
Email notifications sent via SendGrid
  ↓
Admins see notification + email alert
```

**What Admins Receive**:
1. **In-app Notification** in Agent Portal
   - Shows in notification center
   - Can be marked as read
   - Direct link to review documents

2. **Email Alert**
   - Subject: `Agent Document Review Required: {email}`
   - Includes agent email
   - Action button to review documents
   - Professional formatting

---

## 📊 Required Database Schema

You'll need to create a `notifications` table in Supabase:

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- 'agent_signed_documents', etc.
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  data JSONB, -- Stores additional data like agentEmail, action, etc.
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX notifications_user_id_created_at 
ON notifications(user_id, created_at DESC);

CREATE INDEX notifications_user_id_read 
ON notifications(user_id, read);
```

**Or using Supabase Dashboard**:
1. Go to SQL Editor
2. Run the above SQL
3. Or go to Tables → Create Table manually with same columns

---

## 🔧 Implementation Details

### Webhook Signature Verification
```typescript
// Function that verifies DocuSign webhook signature
function verifyDocuSignSignature(body: string, signature: string | null): boolean {
  // 1. Get webhook secret from environment
  // 2. Calculate HMAC-SHA256 of request body
  // 3. Compare with provided signature using timing-safe comparison
  // 4. Return true only if signatures match exactly
}
```

**Why this matters**:
- Without verification, any request could trigger agent provisioning
- Attackers could create fake agents, provision accounts, send emails
- Signature proves the request came from DocuSign

### Admin Notifications
```typescript
// Admins/brokers are notified in two ways:

1. In-app notification:
   - Stored in Supabase notifications table
   - Shows in notification center in Agent Portal
   - Can be marked as read
   - Includes action link

2. Email notification:
   - Sent via SendGrid
   - Professional formatted email
   - Direct link to review documents
   - Immediate alert without needing to open portal
```

---

## ✅ Testing Checklist

### Webhook Signature Verification
- [ ] Valid webhook signature: Request processed ✓
- [ ] Invalid signature: Request rejected with 401 ✓
- [ ] Missing signature: Request rejected ✓
- [ ] Tampered body: Request rejected ✓
- [ ] Expired signature: Request rejected ✓

**To test**:
```bash
# Test with valid signature (from DocuSign)
curl -X POST https://your-domain/api/onboarding/webhook \
  -H "X-Docusign-Signature-1: {valid-signature}" \
  -d '{valid json body}'

# Test with invalid signature
curl -X POST https://your-domain/api/onboarding/webhook \
  -H "X-Docusign-Signature-1: invalid-signature" \
  -d '{valid json body}'
# Should return 401
```

### Admin Notifications
- [ ] Agent signs documents
- [ ] In-app notification created for all admins/brokers
- [ ] Email alert sent to all admin emails
- [ ] Admin can click link in email to review
- [ ] Notification appears in Agent Portal
- [ ] Admin can mark notification as read
- [ ] Multiple admins all get notified

**To test**:
1. Complete agent onboarding and sign documents
2. Check Agent Portal notification center
3. Check admin email inbox
4. Click link in email - should go to document review page
5. Check that notification marked as read in portal

---

## 🚀 Environment Configuration

Add these to `.env.local`:

```bash
# DocuSign Webhook Security
DOCUSIGN_WEBHOOK_SECRET=your-webhook-secret-from-docusign

# SendGrid Email Notifications
SENDGRID_API_KEY=your-sendgrid-api-key
SENDGRID_FROM_EMAIL=noreply@hartfeltrealestate.com
```

---

## 📝 Database Migration (Supabase)

If using Supabase migrations:

**File**: `supabase/migrations/{timestamp}_create_notifications.sql`

```sql
-- Create notifications table for admin alerts
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_created 
ON notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read 
ON notifications(user_id, read);

-- RLS Policies
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "Users can view their own notifications"
ON notifications FOR SELECT
USING (auth.uid() = user_id);

-- System can insert notifications
CREATE POLICY "System can insert notifications"
ON notifications FOR INSERT
WITH CHECK (true);

-- Users can update their own notification read status
CREATE POLICY "Users can update own notification read status"
ON notifications FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
```

---

## 🔐 Security Checklist

- ✅ Webhook signature verification implemented
- ✅ Constant-time comparison prevents timing attacks
- ✅ Only authorized DocuSign events processed
- ✅ Error logging for audit trail
- ⏳ Rate limiting on webhook endpoint (recommended)
- ⏳ Webhook endpoint monitoring (recommended)
- ⏳ Signature verification tests (recommended)

---

## 🎯 Production Readiness

### Before deploying to production:

1. **Webhook Secret Configuration**
   - [ ] Get webhook secret from DocuSign API dashboard
   - [ ] Set in environment variables
   - [ ] Test signature verification

2. **Email Configuration**
   - [ ] SendGrid API key configured
   - [ ] From email domain verified
   - [ ] Email template tested

3. **Database**
   - [ ] Run notifications table migration
   - [ ] Enable RLS policies
   - [ ] Test notification creation

4. **Testing**
   - [ ] Run full webhook tests
   - [ ] Send test notification emails
   - [ ] Verify in-app notifications display
   - [ ] Check notification database

5. **Monitoring**
   - [ ] Set up error logging for webhook failures
   - [ ] Monitor SendGrid delivery
   - [ ] Track notification creation rate

---

## 📞 Support

**If webhook signature verification fails**:
1. Check DocuSign dashboard for webhook secret
2. Verify secret in environment variables
3. Ensure webhook URL is correctly configured in DocuSign
4. Check logs for specific error messages

**If emails not sending**:
1. Verify SendGrid API key is valid
2. Check SendGrid dashboard for delivery status
3. Verify from email domain is authorized
4. Check logs for SendGrid error responses

