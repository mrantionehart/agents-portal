# Setup Guide for Notifications & Webhooks

## 🎯 Goal
Get notifications and webhook security working before domain transfer completes.

## ⏱️ Time Required
**Total: 20-30 minutes**

---

## **Step 1: Create Notifications Table in Supabase** (5 min)

### Option A: Using SQL Editor (Recommended)
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **SQL Editor** → **New Query**
4. Copy the entire contents of `supabase-migrations.sql`
5. Paste into the SQL Editor
6. Click **Run**
7. Should see: "Query succeeded" ✅

### Option B: Using Supabase CLI (Advanced)
```bash
cd agents-portal
supabase db push  # Requires migration files in supabase/migrations/
```

**Verify it worked**:
- Go to **Database** → **Tables**
- You should see `notifications` table with these columns:
  - `id` (UUID)
  - `user_id` (UUID)
  - `type` (text)
  - `title` (text)
  - `message` (text)
  - `data` (jsonb)
  - `read` (boolean)
  - `created_at` (timestamp)
  - `updated_at` (timestamp)

---

## **Step 2: Get Webhook Secret from DocuSign** (5 min)

### From DocuSign Admin Console:

1. Log into [DocuSign Admin](https://admindemo.docusign.com) 
2. Go to **Settings** → **Webhooks** (or **Events & Webhooks**)
3. Find your webhook endpoint for agent onboarding
4. Copy the **Webhook Secret/Key** (labeled as "secret" or "shared secret")
5. Save it somewhere safe (you'll need it for environment variables)

**If you don't see webhooks configured**:
1. Go to **Integrations** → **Webhooks**
2. Create new webhook:
   - **URL**: `https://your-domain/api/onboarding/webhook`
   - **Events**: 
     - `envelope-signed`
     - `envelope-completed`
   - **Secret**: Will be generated or you can set one
3. Copy the secret

---

## **Step 3: Configure Environment Variables** (3 min)

Update `/agents-portal/.env.local`:

```bash
# DocuSign Webhook Security
DOCUSIGN_WEBHOOK_SECRET=your-webhook-secret-from-step-2

# SendGrid Email Notifications  
SENDGRID_API_KEY=your-sendgrid-api-key
SENDGRID_FROM_EMAIL=noreply@hartfeltrealestate.com
```

**Where to find these values**:
- `DOCUSIGN_WEBHOOK_SECRET`: From Step 2 above
- `SENDGRID_API_KEY`: Your SendGrid API key (already configured)
- `SENDGRID_FROM_EMAIL`: Your SendGrid verified sender email

---

## **Step 4: Test Webhook Signature Verification** (5 min)

### Test Valid Signature
```bash
# Get your webhook secret
WEBHOOK_SECRET="your-secret-here"
BODY='{"envelopeId":"test","eventType":"envelope-signed"}'

# Calculate signature
SIGNATURE=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" | tr -d ' ' | sed 's/.*= //')

# Send test webhook
curl -X POST https://localhost:3000/api/onboarding/webhook \
  -H "X-Docusign-Signature-1: $SIGNATURE" \
  -H "Content-Type: application/json" \
  -d "$BODY"

# Expected: 200 OK or webhook processing response
```

### Test Invalid Signature
```bash
curl -X POST https://localhost:3000/api/onboarding/webhook \
  -H "X-Docusign-Signature-1: invalid-signature-123" \
  -H "Content-Type: application/json" \
  -d '{"envelopeId":"test","eventType":"envelope-signed"}'

# Expected: 401 Unauthorized
# You should see: "Unauthorized: invalid signature"
```

---

## **Step 5: Test Admin Notifications** (5 min)

### Send Manual Test Notification

Create a test script at `agents-portal/test-notification.js`:

```javascript
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testNotification() {
  // Get first admin user
  const { data: admin, error: adminError } = await supabase
    .from('profiles')
    .select('id, email')
    .eq('role', 'admin')
    .limit(1)
    .single();

  if (adminError || !admin) {
    console.error('No admin found');
    return;
  }

  // Create test notification
  const { error } = await supabase
    .from('notifications')
    .insert({
      user_id: admin.id,
      type: 'test_notification',
      title: 'Test Notification',
      message: 'This is a test notification from the setup script.',
      data: { timestamp: new Date().toISOString() },
      read: false,
    });

  if (error) {
    console.error('Error creating notification:', error);
    return;
  }

  console.log('✅ Test notification created for admin:', admin.email);
}

testNotification();
```

Run it:
```bash
node test-notification.js
```

**Verify notification was created**:
1. In Supabase, go to **Database** → **notifications** table
2. You should see a new row with your test data
3. If admin logs into Agent Portal, they should see the notification

---

## **Step 6: Update `.env.example` Files** (2 min)

Make sure your `.env.example` files document all required variables:

**`agents-portal/.env.example`**:
```bash
# ... existing vars ...

# DocuSign Webhook Security (from DocuSign admin)
DOCUSIGN_WEBHOOK_SECRET=your-webhook-secret-from-docusign

# SendGrid Configuration
SENDGRID_API_KEY=your-sendgrid-api-key
SENDGRID_FROM_EMAIL=noreply@hartfeltrealestate.com
```

---

## ✅ Complete Verification Checklist

- [ ] Notifications table created in Supabase
- [ ] 5 columns visible in database
- [ ] Webhook secret obtained from DocuSign
- [ ] Environment variables configured in `.env.local`
- [ ] Valid webhook signature accepted (200 OK)
- [ ] Invalid webhook signature rejected (401)
- [ ] Test notification created in database
- [ ] Admin can see notification in Agent Portal (if logged in)
- [ ] `.env.example` updated with new variables

---

## 🧪 Integration Test (Optional but Recommended)

### Full end-to-end test:

1. **Start Agent Portal locally**:
   ```bash
   npm run dev
   ```

2. **Complete onboarding flow**:
   - Have an agent sign documents via DocuSign
   - DocuSign sends webhook event
   - System verifies signature
   - Admin notification created in database
   - Email alert sent to admins

3. **Verify notifications**:
   - Admin logs into Agent Portal
   - Sees notification in notification center
   - Admin email receives notification email
   - Can click link in email to review documents

---

## 🚀 What's Now Working

✅ **Webhook Security**
- Only authorized DocuSign events processed
- Invalid requests rejected with 401
- Timing attack protection

✅ **Admin Notifications**
- In-app notifications in Agent Portal
- Email alerts via SendGrid
- Automatic for all admins/brokers
- Document review link included

✅ **Database**
- Notifications table created
- RLS policies configured
- Indexes for performance

---

## ⚠️ If Something Doesn't Work

### Webhook signature verification fails

**Check**:
1. Is `DOCUSIGN_WEBHOOK_SECRET` correctly set in `.env.local`?
2. Does it match exactly what DocuSign shows?
3. Are you using the right webhook secret (not API key)?
4. Check server logs: `npm run dev` shows error messages

**Fix**:
```bash
# Verify webhook secret is set
echo $DOCUSIGN_WEBHOOK_SECRET

# If empty, update .env.local and restart server
npm run dev
```

### Notifications not appearing

**Check**:
1. Is notifications table created? (verify in Supabase)
2. Are RLS policies enabled? (check in Supabase)
3. Is `SENDGRID_API_KEY` configured?
4. Check server logs for errors

**Fix**:
```bash
# Verify table exists
# Go to Supabase → Database → Tables → notifications

# Re-run migration if needed
# Copy supabase-migrations.sql and re-run in SQL Editor
```

### Email not sending

**Check**:
1. Is `SENDGRID_API_KEY` correct?
2. Is `SENDGRID_FROM_EMAIL` correct and verified?
3. Check SendGrid dashboard for delivery status

**Fix**:
```bash
# Verify SendGrid API key
# Go to SendGrid → Settings → API Keys
# Copy and paste into .env.local

# Verify from email is authorized
# SendGrid → Settings → Sender Authentication
```

---

## 📞 Support

If you get stuck on any step:
1. Check the error message in server logs
2. Verify environment variables are set correctly
3. Ensure all services (Supabase, SendGrid, DocuSign) are properly configured
4. Check that you're using production credentials (not sandbox)

---

## Next Steps After This

Once you've completed all 6 steps:

1. **Wait for domain transfer** to complete (April 13-15)
2. **Then**: Set up Google Workspace provisioning
3. **Then**: Enable SMS via Twilio
4. **Finally**: Full production deployment

Everything else is ready! 🚀
