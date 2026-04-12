# Agent Portal - Quick Start Guide

## 🚀 What's New in Phase 3

The Agent Portal is now fully integrated with Vault and EASE! Here's what's working:

### Dashboard
- **Displays**: Real deals and commissions from Vault
- **Data**: Live from Vault API (192.168.6.88:3000)
- **Updates**: Automatic when you log in
- **Shows**: Total deals, gross commission, net earned

### Commission Calculator
- **Local Calc**: Instant calculation as you type
- **Vault Calc**: Click "Calculate with Vault" to use broker's custom rules
- **Comparison**: See both results side-by-side
- **Accurate**: Follows broker's exact commission structure

### Compliance Documents
- **Upload**: Drag-and-drop file upload
- **Analysis**: AI analyzes documents automatically
- **Feedback**: See compliance issues immediately
- **Storage**: Documents saved to Vault backend
- **Approval**: Tracked for commission payment

### Document Library
- **Dynamic**: Fetches documents from Vault
- **Organized**: Documents grouped by category
- **Metadata**: Shows file sizes and details
- **Fallback**: Default templates if Vault is empty

### Training Modules
- **Live Data**: Fetches from EASE app database
- **Same Content**: Same training modules as mobile app
- **Progressive**: Tracks your progress
- **Flexible**: Desktop or mobile, same courses

---

## 📋 For Agents

### Getting Started
1. Go to http://localhost:3000 (dev) or agents.hartfeltrealestate.com (production)
2. Login with your credentials
3. View your dashboard

### Submitting Compliance Documents
1. Go to **Compliance & Commission Approval**
2. Select your transaction stage (Listing, Under Contract, Closing)
3. Drag documents into the upload area
4. AI analyzes your documents automatically
5. Address any issues flagged
6. Documents are stored for commission approval

### Calculating Commission
1. Go to **Commission Calculator**
2. Enter deal details (sale price, commission %, broker split)
3. See instant calculation on the right
4. Click "Calculate with Vault" to use broker's exact rules
5. Compare the results

### Accessing Training
1. Go to **Training Modules**
2. Browse all available courses
3. View duration and difficulty level
4. Click "Start Course" to begin

---

## 🔧 For Developers

### API Service Layer

All Vault API calls go through `/lib/vault-client.ts`:

```typescript
import { vaultAPI } from '@/lib/vault-client'

// Fetch data
const deals = await vaultAPI.deals.list(user.id)
const commissions = await vaultAPI.commissions.list(user.id)
const documents = await vaultAPI.documents.list(user.id)

// Calculate with Vault
const result = await vaultAPI.commissions.calculate({
  salePrice: 500000,
  commissionRate: 5,
  brokerSplit: 80,
  referralFee: 0,
  transactionFee: 295
}, user.id)

// Upload documents with AI analysis
const analysis = await vaultAPI.ai.analyzeDocument(file, user.id)
const uploaded = await vaultAPI.documents.upload(file, dealId, user.id)

// AI compliance tools
const compliance = await vaultAPI.ai.complianceCheck(data, user.id)
const deadlines = await vaultAPI.ai.extractDeadlines(file, user.id)
```

### Adding New Features

1. **New Vault Endpoint?** → Add to `/lib/vault-client.ts`
2. **New Page?** → Use vaultAPI for data, fallback for defaults
3. **New API Route?** → Consider removing proxy, use vaultAPI directly

### Current Vault API URL
```
http://192.168.6.88:3000
```

---

## 🛠️ Troubleshooting

### Dashboard shows "No deals found"
- Check if Vault is running
- Verify user has deals in Vault
- Check browser console for API errors

### Commission Calculator says "Calculating..."
- Vault API may be slow to respond
- Check Vault is running at 192.168.6.88:3000
- Check X-User-ID header is being sent

### Compliance documents won't upload
- File might be too large
- Check file format is PDF, DOC, DOCX, PNG, or JPG
- Check Vault's document storage is working

### Training modules say "Loading..."
- Supabase connection may be slow
- Check NEXT_PUBLIC_SUPABASE_URL is set
- Check training data exists in database

---

## 📚 Files & Architecture

### Key Files
- `/lib/vault-client.ts` - API service layer
- `/app/dashboard/page.tsx` - Main dashboard
- `/app/commission-calculator/page.tsx` - Commission tool
- `/app/compliance/page.tsx` - Document management
- `/app/documents/page.tsx` - Document library
- `/app/training/page.tsx` - Training modules
- `/app/providers.tsx` - Authentication context

### Environment Variables (.env.local)
```env
NEXT_PUBLIC_SUPABASE_URL=<your-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-key>
NEXT_PUBLIC_VAULT_API_URL=http://192.168.6.88:3000
```

---

## 🔄 Data Flow

### Agents Viewing Their Data
```
Agent Portal → vaultAPI → Vault API → Returns only agent's data
```

### Admins/Brokers (Future)
```
Admin Portal → vaultAPI → Vault API → Returns all agents' data
```

---

## ✨ What's Working Now

✅ Dashboard with real Vault data  
✅ Commission calculations with Vault  
✅ Document upload and AI analysis  
✅ Document library from Vault  
✅ Training modules from EASE  
✅ User authentication  
✅ Error handling  
✅ Fallback data when APIs unavailable  

---

## 🎯 Coming Next (Phase 4)

🔲 Role-based data filtering (agents vs admins)  
🔲 Admin dashboard for brokers  
🔲 Deal creation workflow  
🔲 Commission approval workflows  
🔲 Document templates  
🔲 Production deployment  

---

## 📞 Support

- **Portal Issues?** Check browser console (F12)
- **Vault Connection?** Verify 192.168.6.88:3000 is accessible
- **Authentication?** Check Supabase credentials
- **Data Missing?** Verify data exists in source system

---

**Last Updated**: April 7, 2026  
**Portal Version**: 1.0.0 (Phase 3 Complete)  
**Status**: Ready for Testing & Production Deployment
