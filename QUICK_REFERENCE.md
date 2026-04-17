# M-Pesa Dashboard - Quick Reference Card

## 🚀 Quick Start (5 Minutes)

### 1. Install
```bash
pnpm install
cp .env.local.example .env.local
```

### 2. Configure .env.local
```env
NEXT_PUBLIC_SUPABASE_URL=your-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key
MPESA_CONSUMER_KEY=your-key
MPESA_CONSUMER_SECRET=your-secret
MPESA_SHORTCODE=your-code
OPENAI_API_KEY=your-api-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Setup Database
1. Go to Supabase SQL Editor
2. Copy/paste content from `scripts/init-db.sql`
3. Execute

### 4. Run
```bash
pnpm dev
# Visit http://localhost:3000
```

---

## 📍 Navigation Map

```
Dashboard (Home)
├── Dashboard (Stats Overview)
├── Transactions (Payment History)
├── Members
│   ├── Member List
│   └── Import Members (AI-Powered)
├── Cases (Disputes)
├── Failed Payments (Reconciliation)
└── Settings (Config & Tools)
```

---

## 🔗 Key URLs

| Page | URL | Purpose |
|------|-----|---------|
| Dashboard | `/dashboard` | Stats & Overview |
| Transactions | `/dashboard/transactions` | View all payments |
| Members | `/dashboard/members` | Member directory |
| Import | `/dashboard/members/import` | Bulk member upload |
| Cases | `/dashboard/cases` | Manage disputes |
| Failed | `/dashboard/failed` | Reconcile failures |
| Settings | `/dashboard/settings` | Configuration |

---

## 🔌 API Quick Reference

### M-Pesa
```bash
# Validate payment
POST /api/mpesa/validation
{ "MSISDN": "254712...", "TransAmount": 100, "BillRefNumber": "MEM123" }

# Confirm payment (from Safaricom)
POST /api/mpesa/confirmation
{ "TransID": "...", "TransAmount": 100 }

# Get token
GET /api/mpesa/token

# Test payment
POST /api/mpesa/simulate
{ "phone_number": "254712...", "amount": 100, "bill_reference": "MEM123" }
```

### Members
```bash
# List members
GET /api/members

# Create member
POST /api/members
{ "member_number": "MEM123", "name": "John", "phone_number": "254712..." }

# Import bulk (AI-powered)
POST /api/members/import
{ "data": "CSV/JSON/text content", "format": "csv|json|text" }
```

### Transactions
```bash
# List transactions
GET /api/transactions?status=completed&limit=50

# Reconcile failed
POST /api/transactions/[id]/reconcile
```

### Dashboard
```bash
# Get stats
GET /api/dashboard/stats

# Run reconciliation
POST /api/admin/reconcile
```

---

## 📊 Data Models

### Transaction
```typescript
{
  id: string
  trans_id: string              // Safaricom ID
  msisdn: string                // Payer phone
  trans_amount: string          // Amount
  bill_ref_number: string       // Payment reference
  status: 'completed'|'failed'  // Status
  created_at: string
}
```

### Member
```typescript
{
  id: string
  member_number: string         // Unique ID
  name: string
  phone_number: string          // 254 format
  email?: string
  wallet_balance: number
  created_at: string
}
```

### Case
```typescript
{
  id: string
  case_number: string           // Unique ID
  member_id: string
  amount_due: number
  amount_paid: number
  status: 'open'|'closed'
  created_at: string
}
```

---

## 🎯 Common Tasks

### Import Members from CSV
1. Go to `/dashboard/members`
2. Click "Import Members"
3. Upload CSV file OR paste data
4. Select "CSV" format
5. Click "Import Members"
6. Review results (duplicates, errors)

### Find Failed Transaction
1. Go to `/dashboard/failed`
2. Search by transaction ID or phone
3. Click "Reconcile" to mark fixed

### Check System Status
1. Go to `/dashboard/settings`
2. Scroll to "System Status"
3. View connection statuses

### Run Reconciliation
1. Go to `/dashboard/settings`
2. Click "Run Full Reconciliation"
3. Review results (matched, unmatched, duplicates)

---

## 🔐 Environment Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | DB connection | https://xxx.supabase.co |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin access | eyJ... |
| `MPESA_CONSUMER_KEY` | M-Pesa auth | abc123... |
| `MPESA_CONSUMER_SECRET` | M-Pesa auth | xyz789... |
| `MPESA_SHORTCODE` | Merchant code | 123456 |
| `OPENAI_API_KEY` | AI parsing | sk-... |
| `NEXT_PUBLIC_APP_URL` | App URL | http://localhost:3000 |

---

## 📱 UI Components

| Component | Location | Usage |
|-----------|----------|-------|
| StatsCard | `/components/StatsCard.tsx` | Display metrics |
| Navigation | `/components/Navigation.tsx` | Sidebar menu |
| Button | `/components/ui/button.tsx` | Action buttons |
| Card | `/components/ui/card.tsx` | Content containers |
| Input | `/components/ui/input.tsx` | Form fields |

---

## 🛠 Database Functions

### Query Examples

```typescript
// Get all transactions
const txs = await getTransactions()

// Get failed transactions
const failed = await getFailedTransactions()

// Search members
const members = await getMembers('john')

// Get member by phone
const member = await getMemberByPhone('254712...')

// Create transaction
const tx = await createTransaction({
  trans_id: '123...',
  msisdn: '254712...',
  // ...
})

// Update case
await updateCase(caseId, { status: 'closed' })
```

---

## 📝 Common Error Messages

| Error | Solution |
|-------|----------|
| "Missing data or format" | Provide CSV/JSON data and format type |
| "Database connection failed" | Check `SUPABASE_URL` and keys in .env |
| "AI parsing failed" | Ensure `OPENAI_API_KEY` is set |
| "Transaction not found" | Verify transaction ID exists |
| "Duplicate member" | Member number or phone already exists |

---

## 🧪 Testing

### Simulate Payment
```bash
curl -X POST http://localhost:3000/api/mpesa/simulate \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "254712345678",
    "amount": 1000,
    "bill_reference": "MEM123"
  }'
```

### Create Test Member
```bash
curl -X POST http://localhost:3000/api/members \
  -H "Content-Type: application/json" \
  -d '{
    "member_number": "TEST001",
    "name": "Test User",
    "phone_number": "254712345678"
  }'
```

### Import Test Members
```bash
curl -X POST http://localhost:3000/api/members/import \
  -H "Content-Type: application/json" \
  -d '{
    "data": "member_number,name,phone_number\nMEM001,John,254712345678\nMEM002,Jane,254712345679",
    "format": "csv"
  }'
```

---

## 🚀 Deployment

### Deploy to Vercel
```bash
git add .
git commit -m "Ready for production"
git push
# Go to vercel.com and deploy
```

### Environment Variables on Vercel
1. Go to Project Settings
2. Go to Environment Variables
3. Add all variables from `.env.local`
4. Redeploy

### Post-Deployment
1. Test webhook URLs (in Settings)
2. Configure M-Pesa Daraja portal with webhook URLs
3. Run test transaction
4. Monitor reconciliation

---

## 📞 Documentation Files

| File | Purpose |
|------|---------|
| `GETTING_STARTED.md` | 5-min setup guide |
| `README.md` | Project overview |
| `API_REFERENCE.md` | Complete API docs |
| `SETUP.md` | Detailed setup |
| `IMPLEMENTATION_COMPLETE.md` | Feature summary |
| `FEATURES_CHECKLIST.md` | Complete checklist |
| `QUICK_REFERENCE.md` | This file |

---

## 💡 Tips & Tricks

1. **Phone Normalization**: All phones are auto-converted to 254 format
2. **Idempotency**: Same transaction won't be processed twice
3. **Search**: Works across name, phone, ID, reference
4. **AI Parsing**: Accepts CSV, JSON, or plain text
5. **Reconciliation**: Run after each day's transactions
6. **Backups**: Supabase auto-backups daily
7. **Monitoring**: Check Failed Payments weekly

---

## ✅ Pre-Launch Checklist

- [ ] All environment variables set
- [ ] Database initialized (init-db.sql)
- [ ] M-Pesa API credentials confirmed
- [ ] OpenAI API key added
- [ ] Webhook URLs configured in Daraja
- [ ] Test payment processed successfully
- [ ] Member import tested
- [ ] Reconciliation tested
- [ ] All pages load without errors
- [ ] Search/filter working
- [ ] Ready to go live!

---

**Version**: 1.0.0  
**Last Updated**: 2025  
**Status**: Production Ready ✅
