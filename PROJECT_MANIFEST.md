# Project Manifest - Hartfelt Real Estate Agents Portal

Complete inventory and structure of the Hartfelt Real Estate Agents Portal project.

## Project Overview

A production-ready Next.js 14 application for managing real estate agents, their deals, commissions, and documents. Includes Supabase authentication, role-based access control (RBAC), and seamless integration with the Vault API backend.

**Technology Stack:**
- Next.js 14+ with TypeScript
- React 18
- Supabase for authentication
- Tailwind CSS for styling
- Axios for API calls
- Lucide React for icons

## File Structure

```
agents-portal/
├── Documentation Files
│   ├── README.md                 - Complete project documentation
│   ├── SETUP.md                  - Detailed setup guide
│   ├── DEPLOYMENT.md             - Deployment instructions (5 options)
│   ├── QUICK_START.md            - 5-minute quick start guide
│   └── PROJECT_MANIFEST.md       - This file
│
├── Configuration Files
│   ├── package.json              - npm dependencies and scripts
│   ├── tsconfig.json             - TypeScript configuration
│   ├── tailwind.config.js        - Tailwind CSS theme
│   ├── postcss.config.js         - PostCSS plugins
│   ├── next.config.js            - Next.js configuration
│   ├── .eslintrc.json            - ESLint rules
│   ├── .gitignore                - Git ignore rules
│   ├── .env.example              - Environment template
│   ├── .env.local                - Local environment (should be created)
│   ├── Dockerfile                - Docker container definition
│   ├── docker-compose.yml        - Docker compose setup
│   └── nginx.conf                - Nginx reverse proxy config
│
├── Application Code (app/)
│   ├── layout.tsx                - Root layout with auth provider
│   ├── page.tsx                  - Home page (redirects to dashboard)
│   ├── globals.css               - Global styles and animations
│   │
│   ├── login/
│   │   └── page.tsx              - Login page with Supabase auth
│   │
│   ├── dashboard/
│   │   └── page.tsx              - Agent/Admin dashboard with stats
│   │
│   ├── deals/
│   │   ├── page.tsx              - Deals list with filtering & search
│   │   └── [id]/
│   │       └── page.tsx          - Deal detail page
│   │
│   ├── commissions/
│   │   └── page.tsx              - Commission tracking & history
│   │
│   ├── documents/
│   │   └── page.tsx              - Document upload & management
│   │
│   └── agents/
│       ├── page.tsx              - Agents list (admin only)
│       └── [id]/
│           └── page.tsx          - Agent detail page (admin only)
│
├── Components (components/)
│   ├── Header.tsx                - Navigation header with logout
│   ├── LoadingSpinner.tsx        - Loading indicator
│   └── ProtectedRoute.tsx        - Route protection wrapper
│
├── Libraries & Utilities (lib/)
│   ├── supabase.ts               - Supabase client & auth utilities
│   ├── vault-api.ts              - Vault API client with all endpoints
│   └── auth-context.tsx          - Auth context provider & hooks
│
├── Public Assets (public/)
│   └── .gitkeep                  - Placeholder for static files
│
└── Project Setup
    └── Initial database schema in SETUP.md
```

## File Descriptions

### Documentation

**README.md** (2,500+ words)
- Complete feature documentation
- Tech stack details
- Installation instructions
- Project structure explanation
- Supabase setup guide
- Environment variables
- Available scripts
- Deployment options
- Security considerations
- Troubleshooting guide

**SETUP.md** (1,500+ words)
- Step-by-step setup instructions
- Supabase configuration
- Local development setup
- Database table creation with SQL
- Testing procedures
- Detailed troubleshooting

**DEPLOYMENT.md** (2,000+ words)
- Pre-deployment checklist
- 5 deployment options:
  1. Vercel (recommended)
  2. Docker
  3. AWS (EC2 + ECS)
  4. DigitalOcean
  5. Heroku
- Post-deployment verification
- Scaling considerations
- Rollback procedures
- Monitoring setup

**QUICK_START.md** (600+ words)
- 5-minute quick start guide
- Minimal prerequisites
- Essential commands only
- Common troubleshooting table
- Quick reference for commands

**PROJECT_MANIFEST.md** (This file)
- Complete file inventory
- Feature descriptions
- Component documentation
- API endpoint list
- Role-based access control
- Development guidelines

### Configuration Files

**package.json**
```json
{
  "dependencies": [
    "react@^18.2.0",
    "next@^14.0.0",
    "@supabase/supabase-js@^2.38.0",
    "axios@^1.6.0",
    "tailwindcss@^3.3.0",
    "lucide-react@^0.263.0"
  ],
  "scripts": [
    "dev - development server",
    "build - production build",
    "start - production server",
    "lint - code linting",
    "type-check - TypeScript check"
  ]
}
```

**Environment Variables** (.env.example)
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `NEXT_PUBLIC_VAULT_API_URL` - Vault API base URL
- `NEXT_PUBLIC_APP_URL` - Application URL
- `NEXT_PUBLIC_DEBUG` - Debug mode toggle

### Application Pages

**Authentication Flow**
- `/` - Home (redirects based on auth)
- `/login` - Login page (public)
- Protected routes redirect to /login if not authenticated

**Agent Routes**
- `/dashboard` - Personal dashboard with stats
- `/deals` - View own deals with filters
- `/deals/[id]` - Deal detail view
- `/commissions` - Commission tracking
- `/documents` - Document upload & management

**Admin Routes**
- `/dashboard` - System-wide dashboard
- `/agents` - Agent management list
- `/agents/[id]` - Agent detail with performance
- All agent routes + full data access

### Components

**Header.tsx**
- Navigation bar with responsive menu
- User info display
- Logout button
- Mobile menu support
- Role-based navigation

**LoadingSpinner.tsx**
- Animated loading indicator
- Used on all data-fetching pages

**ProtectedRoute.tsx**
- Route protection wrapper
- Role-based access control
- Redirects unauthenticated users
- Prevents unauthorized access

### Libraries

**supabase.ts**
```typescript
- createClient() - Initialize Supabase
- getCurrentUser() - Get current user
- getUserRole() - Get user's role
- Type definitions for User, UserRole, AuthSession
```

**vault-api.ts**
```typescript
Class: VaultAPI
Methods:
  // Deals
  - getDeals(filters?)
  - getDeal(id)
  - createDeal(data)
  - updateDeal(id, data)
  - deleteDeal(id)
  
  // Commissions
  - getCommissions(filters?)
  - getCommission(id)
  
  // Documents
  - getDocuments(filters?)
  - uploadDocument(file, metadata?)
  - deleteDocument(id)
  
  // Agents
  - getAgents(filters?)
  - getAgent(id)
  
  // Statistics
  - getAgentStats(agentId)
  - getAllStats(filters?)
  
  // Auth
  - setAuthToken(token)
  - clearAuthToken()
```

**auth-context.tsx**
```typescript
- AuthProvider component
- useAuth() hook
- Handles login, signup, logout
- Manages user state and role
- Auth error handling
```

## Features by Page

### Login Page (`/login`)
- Email/password authentication
- Supabase integration
- Error handling
- Demo account info
- Support contact

### Dashboard (`/dashboard`)
**Agent View:**
- Personal deal count
- Active deals count
- Total commissions earned
- Pending commissions
- Quick links to other sections

**Admin View:**
- All deals count
- Active deals count
- Total system commissions
- Pending commissions
- Agent management link

### Deals (`/deals`)
- List all deals (filtered by agent if not admin)
- Search by title/address
- Filter by status (active/pending/closed)
- Sort and pagination
- View/Edit/Delete actions

**Deal Detail** (`/deals/[id]`)
- Full deal information
- Price display
- Status badge
- Agent information
- Creation date
- Edit/Delete buttons (admin/owner)

### Commissions (`/commissions`)
- Commission statistics:
  - Total earned
  - Paid amount
  - Pending amount
- Commission history table
- Filter by status (paid/pending/cancelled)
- Date tracking
- Agent information (admin view)

### Documents (`/documents`)
- Drag-and-drop file upload
- File type support: PNG, JPG, PDF, etc.
- File size limits: up to 10MB
- Document listing with metadata
- Download functionality
- Delete option
- File size display

### Agents (`/agents`) [Admin Only]
- List all agents
- Search by name/email
- Agent statistics:
  - Total deals count
  - Commission amounts
- Status indicator
- Join date display
- Click to view details

**Agent Detail** (`/agents/[id]`) [Admin Only]
- Agent contact information
- Email and phone
- Activity statistics:
  - Total/active deals
  - Total/pending commissions
- Recent deals table
- Commission tracking
- Performance metrics

## Styling System

**Tailwind CSS Configuration** (tailwind.config.js)
```javascript
Colors:
- primary: #2563eb (blue)
- secondary: #1e40af (dark blue)
- accent: #f59e0b (amber)
- danger: #dc2626 (red)
- success: #16a34a (green)
- warning: #eab308 (yellow)
```

**Global Styles** (globals.css)
- Base styles and resets
- Custom animations:
  - fadeIn (0.3s)
  - slideInUp (0.3s)
- Loading spinner animation
- Root CSS variables
- Responsive typography

## Database Schema

**user_profiles Table**
```sql
- id: UUID (PK)
- user_id: UUID (FK to auth.users)
- email: TEXT (unique)
- full_name: TEXT
- role: TEXT ('agent' | 'admin' | 'broker')
- agency_id: TEXT
- phone: TEXT
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

**Row Level Security (RLS) Policies**
- Users can view own profile
- Admins can view all profiles
- Users can update own profile
- Admins can update all profiles

## API Integration

**Vault API Endpoints Used**

Deals:
- `GET /api/deals` - List deals
- `GET /api/deals/:id` - Get deal details
- `POST /api/deals` - Create deal
- `PUT /api/deals/:id` - Update deal
- `DELETE /api/deals/:id` - Delete deal

Commissions:
- `GET /api/commissions` - List commissions
- `GET /api/commissions/:id` - Get commission

Documents:
- `GET /api/documents` - List documents
- `POST /api/documents/upload` - Upload file
- `DELETE /api/documents/:id` - Delete document

Agents:
- `GET /api/agents` - List agents
- `GET /api/agents/:id` - Get agent

Statistics:
- `GET /api/agents/:id/stats` - Agent stats
- `GET /api/stats` - System stats

## Role-Based Access Control

**Agent Role**
✓ View own deals
✓ View own commissions
✓ Upload documents
✓ View own documents
✗ View other agents' data
✗ Admin dashboard
✗ Agent management

**Admin/Broker Role**
✓ View all deals
✓ View all commissions
✓ View all documents
✓ View all agents
✓ Admin dashboard
✓ Agent management
✓ Manage all data

## Security Features

- Supabase Row Level Security (RLS)
- Secure token handling
- Protected routes with role checking
- Input validation
- HTTPS in production
- CORS configuration
- Secure headers (nginx config included)
- Environment variable protection

## Performance Optimizations

- Next.js automatic code splitting
- Tailwind CSS purging
- Image optimization
- API call caching (Axios interceptors)
- Lazy loading on pages
- CSS-in-JS minification
- Gzip compression (nginx config)

## Development Guidelines

### Adding a New Page
1. Create file in `app/[feature]/page.tsx`
2. Wrap with `<ProtectedRoute requiredRole="agent">`
3. Use `useAuth()` hook for user data
4. Fetch data with `vaultAPI` client
5. Add navigation link in `Header.tsx`

### Adding a New Component
1. Create in `components/[ComponentName].tsx`
2. Use TypeScript for type safety
3. Export as default
4. Import and use in pages

### API Integration
1. Use `vaultAPI` client from `lib/vault-api.ts`
2. All methods handle errors
3. Add new endpoints in VaultAPI class
4. Use async/await pattern

### Styling
1. Use Tailwind classes
2. Refer to config colors
3. Use responsive prefixes (sm:, md:, lg:)
4. Keep custom CSS in globals.css

## Deployment Checklist

- [ ] Environment variables configured
- [ ] Supabase project created
- [ ] Database tables created
- [ ] Vault API running
- [ ] CORS configured
- [ ] `npm run build` passes
- [ ] `npm run type-check` passes
- [ ] Local testing complete
- [ ] Domain registered
- [ ] SSL certificate ready
- [ ] Backups configured
- [ ] Monitoring setup

## Support & Resources

**Documentation**
- README.md - Full reference
- SETUP.md - Setup instructions
- DEPLOYMENT.md - Production deployment
- QUICK_START.md - 5-minute start

**External Resources**
- Next.js: https://nextjs.org/docs
- Supabase: https://supabase.com/docs
- Tailwind: https://tailwindcss.com/docs
- React: https://react.dev/docs

**Contact**
- support@hartfelt.com
- Check existing issues/docs first

## License

© 2024 Hartfelt Real Estate. All rights reserved.

## Version History

**v1.0.0** (Initial Release)
- Complete Next.js setup
- Supabase authentication
- All core features
- Ready for production deployment
- Comprehensive documentation
