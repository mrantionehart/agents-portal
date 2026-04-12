# Quick Start (5 Minutes)

Get the Hartfelt Agents Portal running in 5 minutes.

## Prerequisites (Have Ready)

- [ ] Node.js 18+ installed
- [ ] Supabase credentials (URL + API Key)
- [ ] Vault API URL (likely http://192.168.6.88:3000/api)

## Step-by-Step

### 1. Install Dependencies (1 min)

```bash
cd agents-portal
npm install
```

### 2. Create Environment File (1 min)

```bash
cp .env.example .env.local
```

Then edit `.env.local` with your credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_VAULT_API_URL=http://192.168.6.88:3000/api
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Set Up Database (1 min)

1. Go to [supabase.com](https://supabase.com)
2. Log in to your project
3. Click "SQL Editor" → "New Query"
4. Paste this and click "Run":

```sql
CREATE TABLE public.user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE,
  full_name TEXT,
  role TEXT DEFAULT 'agent',
  agency_id TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.user_profiles FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all"
  ON public.user_profiles FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND role = 'admin')
  );
```

### 4. Start Development Server (1 min)

```bash
npm run dev
```

Open http://localhost:3000

### 5. Test Login (1 min)

1. Go to http://localhost:3000/login
2. Sign up with your email
3. You're in!

## Common Commands

```bash
# Start development
npm run dev

# Build for production
npm run build

# Check for TypeScript errors
npm run type-check

# Run linter
npm run lint
```

## File Locations

- **Pages**: `app/` folder
- **Components**: `components/` folder
- **Styling**: `app/globals.css`
- **API Client**: `lib/vault-api.ts`
- **Auth**: `lib/auth-context.tsx`

## Making Your First Change

1. Edit `components/Header.tsx`
2. Change "Hartfelt Portal" to your company name
3. Save and refresh browser - changes appear instantly!

## Deploying

### Option 1: Vercel (Easiest)

1. Push to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import repository
4. Add environment variables
5. Done!

### Option 2: Docker

```bash
docker build -t agents-portal .
docker run -p 3000:3000 --env-file .env.local agents-portal
```

### Option 3: Traditional Server

```bash
npm run build
npm start
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Cannot find module" | Run `npm install` |
| "Invalid Supabase URL" | Check `.env.local` has correct URL |
| "Cannot connect to Vault API" | Check IP/port, ensure API is running |
| "Can't log in" | Create user in Supabase auth first |
| "404 on page" | Check route exists in `app/` folder |

## Need Help?

1. Check [SETUP.md](./SETUP.md) for detailed setup
2. Check [DEPLOYMENT.md](./DEPLOYMENT.md) for production
3. Check [README.md](./README.md) for full documentation
4. Contact: support@hartfelt.com

## What's Included?

✅ Login page with Supabase auth
✅ Agent dashboard with stats
✅ Admin dashboard for all agents
✅ Deal management interface
✅ Commission tracking
✅ Document uploads
✅ Agent management (admin only)
✅ Mobile-responsive design
✅ Role-based access control
✅ Integration with Vault API

## Project Structure

```
agents-portal/
├── app/              # Pages and routes
├── components/       # React components
├── lib/             # Utilities (auth, API)
├── public/          # Static files
├── package.json     # Dependencies
└── README.md        # Full documentation
```

## Features by Role

### Agent Role
- View own deals
- Track own commissions
- Upload documents
- View commission history

### Admin/Broker Role
- View all agents
- View all deals
- View all commissions
- Manage agents
- Filter and search

## API Integration

The app automatically integrates with Vault API at:
- `GET /deals` - Fetch deals
- `GET /commissions` - Fetch commissions
- `GET /documents` - Fetch documents
- `POST /documents/upload` - Upload files
- `GET /agents` - Fetch agents

No additional setup needed!

## Next Steps

1. **Customize Colors**
   - Edit `tailwind.config.js`
   - Update `--primary`, `--secondary`, etc.

2. **Add Your Logo**
   - Place logo in `public/` folder
   - Update `components/Header.tsx`

3. **Update Branding**
   - Change "Hartfelt Portal" to your name
   - Update email address
   - Change colors to match brand

4. **Deploy**
   - Follow Option 1, 2, or 3 above
   - Update domain DNS
   - Set up SSL

## Security Checklist

- [ ] Never commit `.env.local`
- [ ] Use strong database passwords
- [ ] Enable HTTPS in production
- [ ] Set Supabase RLS policies
- [ ] Validate all inputs
- [ ] Update dependencies regularly

## Performance Tips

- Next.js automatically optimizes images
- Pages are cached at build time
- API calls are minified
- CSS is purged of unused styles
- Use browser DevTools to profile slow pages

## Success!

You now have a fully functional real estate agent portal. Next step: Deploy to production!

See [DEPLOYMENT.md](./DEPLOYMENT.md) for production setup.
