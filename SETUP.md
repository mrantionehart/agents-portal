# Complete Setup Guide

Follow this guide to set up the Hartfelt Real Estate Agents Portal from scratch.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Supabase Setup](#supabase-setup)
3. [Local Development Setup](#local-development-setup)
4. [Configuration](#configuration)
5. [Testing](#testing)
6. [Troubleshooting](#troubleshooting)

## Prerequisites

- Node.js 18+ ([Download](https://nodejs.org/))
- npm or yarn
- Git
- A Supabase account ([Sign up](https://supabase.com))
- Access to Vault API server (192.168.6.88:3000)

## Supabase Setup

### Step 1: Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Click "New project"
3. Enter project details:
   - **Name**: hartfelt-agents-portal
   - **Database Password**: Create a strong password
   - **Region**: Select your region
4. Click "Create new project"
5. Wait for project to initialize (2-3 minutes)

### Step 2: Get Your Credentials

1. Go to Project Settings (bottom left)
2. Click "API"
3. Copy the following:
   - **Project URL** - This is `NEXT_PUBLIC_SUPABASE_URL`
   - **Anon Public Key** - This is `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Keep these safe - you'll need them for `.env.local`

### Step 3: Set Up Authentication

1. In Supabase, go to "Authentication" → "Providers"
2. Make sure "Email" is enabled
3. Go to "URL Configuration" and add your deployment URL:
   - Development: http://localhost:3000
   - Production: https://agents.hartfeltrealestate.com

### Step 4: Create Required Tables

1. Go to "SQL Editor" in Supabase
2. Create new query
3. Paste the following SQL:

```sql
-- Create user_profiles table
CREATE TABLE public.user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT UNIQUE,
  role TEXT DEFAULT 'agent',
  agency_id TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT role_check CHECK (role IN ('agent', 'admin', 'broker'))
);

-- Enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
CREATE POLICY "Users can view own profile"
  ON public.user_profiles
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
  ON public.user_profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'broker')
    )
  );

CREATE POLICY "Users can update own profile"
  ON public.user_profiles
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can update all profiles"
  ON public.user_profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'broker')
    )
  );

-- Create index for faster queries
CREATE INDEX idx_user_profiles_user_id ON public.user_profiles(user_id);
CREATE INDEX idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX idx_user_profiles_role ON public.user_profiles(role);

-- Insert initial admin user (replace with your email)
INSERT INTO public.user_profiles (user_id, email, full_name, role)
VALUES (
  (SELECT id FROM auth.users LIMIT 1), -- Use first user created
  'admin@hartfelt.com',
  'Admin User',
  'admin'
)
ON CONFLICT DO NOTHING;
```

4. Click "Run" to execute

### Step 5: Configure Auth Triggers (Optional but Recommended)

Create a trigger to auto-create user profile on signup:

```sql
-- Create function to handle new user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'agent')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

## Local Development Setup

### Step 1: Clone/Download Project

```bash
# If you have git
git clone <your-repo-url> agents-portal
cd agents-portal

# Or just extract the folder you downloaded
cd agents-portal
```

### Step 2: Install Dependencies

```bash
npm install
```

This installs:
- Next.js 14
- React 18
- Supabase client
- Tailwind CSS
- And other dependencies

### Step 3: Create Environment File

1. Copy the example file:
```bash
cp .env.example .env.local
```

2. Edit `.env.local` and add your credentials:

```env
# Get these from Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Vault API
NEXT_PUBLIC_VAULT_API_URL=http://192.168.6.88:3000/api

# Your app
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional
NEXT_PUBLIC_DEBUG=false
```

**IMPORTANT**: Never commit `.env.local` to version control!

## Configuration

### Step 1: Verify Vault API Connection

The application expects the Vault API to be running. Test connectivity:

```bash
curl http://192.168.6.88:3000/api/deals
```

If this fails:
- Check that the IP address is correct
- Verify the port is correct
- Ensure the Vault API server is running
- Check firewall rules

### Step 2: Create Test User (Optional)

To create a test user:

1. Start the development server
2. Click "Sign In" and sign up with email
3. Go back to Supabase → SQL Editor
4. Run this to make them admin:

```sql
UPDATE public.user_profiles
SET role = 'admin'
WHERE email = 'your-email@example.com';
```

### Step 3: Configure CORS (if needed)

If you get CORS errors, add this header to Vault API responses:

```
Access-Control-Allow-Origin: http://localhost:3000
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

## Testing

### Step 1: Start Development Server

```bash
npm run dev
```

You should see:
```
> next dev

  ▲ Next.js 14.0.0
  - Local:        http://localhost:3000
```

### Step 2: Test the Application

1. Open http://localhost:3000 in your browser
2. You should be redirected to `/login`
3. Sign in with your test user credentials
4. You should see the dashboard

### Step 3: Test Features

**Test Agent Dashboard:**
- Visit http://localhost:3000/dashboard
- You should see statistics

**Test Deals Page:**
- Visit http://localhost:3000/deals
- You should see a list of deals (or empty if no data)

**Test Commissions:**
- Visit http://localhost:3000/commissions
- You should see commission statistics

**Test Documents:**
- Visit http://localhost:3000/documents
- Try uploading a file
- You should see it listed

**Test Admin Pages (if admin):**
- Visit http://localhost:3000/agents
- You should see a list of agents

### Step 4: Test Build

```bash
npm run build
```

This should complete without errors. If there are TypeScript errors, fix them before deployment.

## Troubleshooting

### "Cannot find module '@supabase/supabase-js'"

**Solution**: Run `npm install` again

```bash
npm install
```

### "Invalid Supabase URL"

**Solution**: Check your `.env.local` file

```bash
# Verify these lines exist:
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
```

- Confirm URL starts with `https://`
- Confirm it ends with `.supabase.co`
- Confirm there are no extra spaces

### "Unable to connect to Vault API"

**Solution**: Check network connectivity

```bash
# Test if Vault API is accessible
curl -i http://192.168.6.88:3000/api

# If this fails, check:
# 1. Is Vault API running?
# 2. Is the IP address correct?
# 3. Is the port correct?
# 4. Are there firewall rules blocking it?
```

### "401 Unauthorized" errors

**Solution**: Check authentication

- Make sure you're logged in
- Check browser console for specific errors
- Verify Supabase credentials are correct
- Ensure user profile exists in user_profiles table

### "CORS errors"

**Solution**: Configure CORS on Vault API

If you see errors like "Access to XMLHttpRequest blocked by CORS policy", the Vault API needs CORS headers:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

### "Database table doesn't exist"

**Solution**: Recreate the tables

1. Go back to Supabase SQL Editor
2. Run the SQL from Step 4 of Supabase Setup
3. Refresh your browser

### Performance is slow

**Solution**: Check network and enable debugging

```env
# In .env.local
NEXT_PUBLIC_DEBUG=true
```

Then check browser console for slow requests.

### Can't upload documents

**Solution**: Check Vault API configuration

- Verify document upload endpoint exists
- Check file size limits
- Verify authentication token is being sent

## Next Steps

1. **Customize Branding**
   - Update colors in `tailwind.config.js`
   - Replace logo in components/Header.tsx
   - Update company name throughout

2. **Add More Features**
   - Implement deal creation form
   - Add payment processing
   - Add email notifications

3. **Deploy to Production**
   - Follow DEPLOYMENT.md
   - Set up custom domain
   - Configure SSL certificate

## Support

If you encounter issues:

1. Check this troubleshooting section
2. Review README.md for more info
3. Check Supabase documentation
4. Contact support@hartfelt.com

## Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [React Documentation](https://react.dev)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
