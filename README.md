# Hartfelt Real Estate - Agents Portal

A complete Next.js portal for managing real estate agents, deals, commissions, and documents. Built with TypeScript, Supabase authentication, and integration with the Vault API backend.

## Features

- **User Authentication**: Supabase-based login system with role-based access control
- **Agent Dashboard**: Personal dashboard showing deals, commissions, and documents
- **Admin Dashboard**: Comprehensive admin view with agent management and statistics
- **Deal Management**: View, create, and manage property deals
- **Commission Tracking**: Track commission status and payment history
- **Document Management**: Upload and manage documents with Vault storage integration
- **Agent Management**: Admin interface for managing agents and viewing their performance
- **Responsive Design**: Fully responsive UI for desktop, tablet, and mobile
- **Role-Based Access**: Support for agent, admin, and broker roles

## Tech Stack

- **Framework**: Next.js 14+ with App Router
- **Language**: TypeScript
- **Authentication**: Supabase
- **Styling**: Tailwind CSS
- **UI Components**: Lucide React icons
- **API Client**: Axios
- **State Management**: React Context API

## Quick Start

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- Supabase project with credentials
- Vault API running at http://192.168.6.88:3000/api

### Installation

1. Clone or download the project:
```bash
cd agents-portal
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

4. Update `.env.local` with your credentials:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_VAULT_API_URL=http://192.168.6.88:3000/api
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

5. Start the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
agents-portal/
├── app/                    # Next.js app router
│   ├── layout.tsx         # Root layout with auth provider
│   ├── page.tsx           # Home page (redirects to dashboard)
│   ├── login/             # Login page
│   ├── dashboard/         # Agent/Admin dashboard
│   ├── deals/             # Deal management
│   │   └── [id]/          # Deal detail page
│   ├── commissions/       # Commission tracking
│   ├── documents/         # Document management
│   └── agents/            # Admin agent management
│       └── [id]/          # Agent detail page
├── components/            # Reusable React components
│   ├── Header.tsx         # Navigation header
│   ├── LoadingSpinner.tsx # Loading indicator
│   └── ProtectedRoute.tsx # Route protection wrapper
├── lib/                   # Utilities and helpers
│   ├── supabase.ts       # Supabase client and auth
│   ├── vault-api.ts      # Vault API client
│   └── auth-context.tsx  # Auth context provider
├── public/               # Static assets
├── package.json          # Dependencies
├── tsconfig.json         # TypeScript configuration
├── tailwind.config.js    # Tailwind CSS configuration
└── postcss.config.js     # PostCSS configuration
```

## Environment Variables

Create a `.env.local` file with the following variables:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Vault API Configuration
NEXT_PUBLIC_VAULT_API_URL=http://192.168.6.88:3000/api

# Application URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional: Enable debug logging
NEXT_PUBLIC_DEBUG=false
```

## Available Scripts

```bash
# Development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run TypeScript check
npm run type-check

# Run ESLint
npm run lint
```

## Pages and Features

### Authentication
- **Login Page** (`/login`): User authentication with email/password
- Protected routes redirect unauthenticated users to login

### Agent Features
- **My Dashboard** (`/dashboard`): Personal statistics and quick access
- **Deals** (`/deals`): View personal deals with filtering
- **Deal Details** (`/deals/[id]`): Full deal information
- **Commissions** (`/commissions`): Track earned commissions
- **Documents** (`/documents`): Upload and manage files

### Admin Features
- **Admin Dashboard** (`/dashboard`): System-wide statistics
- **Agents** (`/agents`): List and manage all agents
- **Agent Details** (`/agents/[id]`): View agent performance and deals
- Full access to all data with filtering options

## Supabase Setup

### Required Tables

Create these tables in your Supabase project:

```sql
-- User Profiles Table
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT auth.uid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT UNIQUE,
  role TEXT DEFAULT 'agent', -- 'agent', 'admin', 'broker'
  agency_id TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT role_check CHECK (role IN ('agent', 'admin', 'broker'))
);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
  ON user_profiles FOR SELECT
  USING ((SELECT role FROM user_profiles WHERE user_id = auth.uid()) = 'admin');
```

## Vault API Integration

The application connects to the Vault API for:
- Deal management (CRUD operations)
- Commission tracking and history
- Document storage and retrieval
- Agent statistics and performance

### Vault API Endpoints Used

- `GET /deals` - Fetch deals with filters
- `GET /deals/:id` - Get deal details
- `POST /deals` - Create new deal
- `PUT /deals/:id` - Update deal
- `DELETE /deals/:id` - Delete deal
- `GET /commissions` - Fetch commissions
- `GET /documents` - Fetch documents
- `POST /documents/upload` - Upload document
- `DELETE /documents/:id` - Delete document
- `GET /agents` - Fetch agents
- `GET /agents/:id` - Get agent details
- `GET /agents/:id/stats` - Get agent statistics

## Authentication Flow

1. User visits `/login`
2. Enters email and password
3. Supabase authenticates and returns session
4. User role is fetched from user_profiles table
5. User is redirected to `/dashboard`
6. Navigation and features are shown based on role

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Connect repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy with `npm run build`

### Docker

Create a `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

Build and run:
```bash
docker build -t agents-portal .
docker run -p 3000:3000 --env-file .env.local agents-portal
```

### Production Environment Variables

For production, ensure:
- `NEXT_PUBLIC_SUPABASE_URL` points to production Supabase
- `NEXT_PUBLIC_VAULT_API_URL` points to production Vault API
- `NEXT_PUBLIC_APP_URL` is set to production domain
- Consider using server-side environment variables for sensitive data

## Security Considerations

- Never commit `.env.local` to version control
- Use Supabase RLS policies to protect data
- Validate all user inputs
- Implement CORS properly on Vault API
- Use HTTPS in production
- Regularly update dependencies

## Troubleshooting

### Authentication Issues
- Verify Supabase credentials in `.env.local`
- Check Supabase project is active
- Ensure user exists in Supabase auth

### Vault API Connection
- Verify `NEXT_PUBLIC_VAULT_API_URL` is correct
- Check Vault API is running and accessible
- Verify firewall allows connections
- Check CORS settings on Vault API

### Build Errors
- Run `npm install` to ensure dependencies are installed
- Clear `.next` folder and rebuild
- Check Node.js version is 18+
- Verify all required environment variables are set

## Support

For issues or questions:
1. Check the environment variables are configured correctly
2. Review Supabase and Vault API documentation
3. Contact support@hartfelt.com

## License

© 2024 Hartfelt Real Estate. All rights reserved.
