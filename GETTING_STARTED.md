# Getting Started - Quick Reference

Welcome to the M-Pesa Payment Management System! Follow these steps to get your system up and running.

## 5-Minute Quick Start

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Setup Environment Variables
```bash
cp .env.local.example .env.local
```

Edit `.env.local` and add your Supabase and M-Pesa credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
MPESA_CONSUMER_KEY=your-consumer-key
MPESA_CONSUMER_SECRET=your-consumer-secret
MPESA_BUSINESS_SHORTCODE=your-shortcode
MPESA_PASSKEY=your-passkey
MPESA_INITIATOR_NAME=Initiator
```

### 3. Setup Database
- Go to your Supabase project
- Open SQL Editor
- Paste contents of `scripts/init-db.sql`
- Click "Run"

### 4. Start Development Server
```bash
pnpm dev
```

Open http://localhost:3000 in your browser.

---

## Project Overview

### What You Have

```
✅ Complete M-Pesa C2B payment system
✅ Dashboard with transactions, members, and cases
✅ API routes for payment callbacks
✅ Supabase PostgreSQL database
✅ Search and filtering on all pages
✅ Environment-based configuration
✅ Production-ready setup
```

### Key Files to Know

| File | Purpose |
|------|---------|
| `app/dashboard/page.tsx` | Main dashboard |
| `lib/db.ts` | Database queries |
| `lib/mpesa.ts` | M-Pesa logic |
| `app/api/mpesa/*` | Payment endpoints |
| `scripts/init-db.sql` | Database schema |
| `.env.local` | Your credentials |

---

## Common Tasks

### View Dashboard
```
http://localhost:3000/dashboard
```

### Test Payment Simulation
```bash
curl -X POST http://localhost:3000/api/mpesa/simulate \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "254708374149",
    "amount": 1000,
    "bill_reference": "TEST001"
  }'
```

### Check API Response
```bash
curl http://localhost:3000/api/dashboard/stats
```

### Debug Issues
1. Check terminal output: `pnpm dev`
2. Open browser DevTools (F12)
3. Check Supabase logs in dashboard
4. Review `SETUP.md` for troubleshooting

---

## Next Steps

1. **Customize Branding**
   - Edit app name in `app/dashboard/layout.tsx`
   - Update colors in `tailwind.config.ts`
   - Add your logo to `public/` folder

2. **Configure M-Pesa**
   - Get API credentials from Safaricom Daraja
   - Update `.env.local` with your credentials
   - Test with sandbox environment first

3. **Deploy to Vercel**
   - Push code to GitHub
   - Connect to Vercel
   - Add environment variables
   - Deploy!

See `SETUP.md` for detailed instructions.

---

## Project Structure Cheat Sheet

```
app/
  ├── page.tsx                    → Home page
  ├── dashboard/                  → Dashboard pages
  │   ├── page.tsx               → Main dashboard
  │   ├── transactions/page.tsx   → View transactions
  │   ├── members/page.tsx        → Manage members
  │   └── cases/page.tsx          → View dispute cases
  └── api/
      ├── mpesa/                  → Payment endpoints
      ├── transactions/           → Transaction queries
      ├── members/                → Member queries
      └── cases/                  → Case queries

lib/
  ├── db.ts                       → Database functions
  ├── mpesa.ts                    → M-Pesa utilities
  ├── supabase.ts                 → Supabase client
  ├── types.ts                    → TypeScript types
  └── validation.ts               → Payment validation

scripts/
  └── init-db.sql                 → Database setup
```

---

## Important Environment Variables

### Supabase (Required)
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Public key
- `SUPABASE_SERVICE_KEY` - Server-side key

### M-Pesa (Required for Payments)
- `MPESA_CONSUMER_KEY` - From Safaricom Daraja
- `MPESA_CONSUMER_SECRET` - From Safaricom Daraja
- `MPESA_BUSINESS_SHORTCODE` - Your business code
- `MPESA_PASSKEY` - Your M-Pesa passkey

### URLs
- `MPESA_BASE_URL` - `https://sandbox.safaricom.co.ke` (development)
- `MPESA_TOKEN_URL` - Token generation endpoint

---

## Troubleshooting

### "Cannot find module '@supabase/supabase-js'"
```bash
pnpm install
```

### "Environment variables not found"
1. Check `.env.local` exists
2. Verify all required variables are set
3. Restart dev server: `pnpm dev`

### "Database connection error"
1. Check `SUPABASE_SERVICE_KEY` is correct
2. Verify Supabase project is active
3. Ensure `scripts/init-db.sql` was executed

### "M-Pesa token request failed"
1. Verify `MPESA_CONSUMER_KEY` and `MPESA_CONSUMER_SECRET`
2. Check you're using sandbox URLs for testing
3. Ensure credentials are from Safaricom Daraja

---

## Development Commands

```bash
# Start dev server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Run tests
pnpm test

# Format code
pnpm format

# Lint code
pnpm lint
```

---

## API Endpoints

### Dashboard
- `GET /api/dashboard/stats` - Overview statistics
- `GET /api/transactions` - List transactions
- `GET /api/members` - List members
- `GET /api/cases` - List cases

### M-Pesa
- `POST /api/mpesa/validation` - Validate payment
- `POST /api/mpesa/confirmation` - Confirm payment
- `POST /api/mpesa/token` - Get OAuth token
- `POST /api/mpesa/simulate` - Test payment

---

## File Creation Checklist

All these files have been created:

### Configuration Files
- [x] `package.json` - Dependencies
- [x] `tsconfig.json` - TypeScript config
- [x] `tailwind.config.ts` - Tailwind config
- [x] `next.config.mjs` - Next.js config
- [x] `postcss.config.mjs` - PostCSS config
- [x] `.env.local.example` - Environment template
- [x] `.gitignore` - Git ignore rules
- [x] `components.json` - shadcn/ui config

### App Files
- [x] `app/layout.tsx` - Root layout
- [x] `app/page.tsx` - Home page
- [x] `app/globals.css` - Global styles

### Dashboard
- [x] `app/dashboard/layout.tsx` - Dashboard layout
- [x] `app/dashboard/page.tsx` - Dashboard home
- [x] `app/dashboard/transactions/page.tsx` - Transactions
- [x] `app/dashboard/members/page.tsx` - Members
- [x] `app/dashboard/cases/page.tsx` - Cases
- [x] `app/dashboard/settings/page.tsx` - Settings

### API Routes
- [x] `app/api/mpesa/validation/route.ts`
- [x] `app/api/mpesa/confirmation/route.ts`
- [x] `app/api/mpesa/token/route.ts`
- [x] `app/api/mpesa/simulate/route.ts`
- [x] `app/api/dashboard/stats/route.ts`
- [x] `app/api/transactions/route.ts`
- [x] `app/api/members/route.ts`
- [x] `app/api/cases/route.ts`

### Library Files
- [x] `lib/supabase.ts` - Supabase client
- [x] `lib/db.ts` - Database queries
- [x] `lib/types.ts` - TypeScript types
- [x] `lib/mpesa.ts` - M-Pesa utilities
- [x] `lib/validation.ts` - Validation logic
- [x] `lib/utils.ts` - Helper functions

### Components
- [x] `components/StatsCard.tsx` - Stat card
- [x] `components/Navigation.tsx` - Navigation

### Documentation
- [x] `README.md` - Project overview
- [x] `SETUP.md` - Detailed setup
- [x] `DEPLOYMENT_CHECKLIST.md` - Deploy checklist
- [x] `API_REFERENCE.md` - API docs
- [x] `PROJECT_STRUCTURE.md` - Structure overview
- [x] `GETTING_STARTED.md` - This file

### Database
- [x] `scripts/init-db.sql` - Database schema

---

## What's Included

### Frontend
- ✅ Home page with feature overview
- ✅ Dashboard with statistics
- ✅ Transaction management and search
- ✅ Member profile management
- ✅ Case/dispute tracking
- ✅ Settings page
- ✅ Responsive design (mobile-friendly)
- ✅ Dark mode support (via Tailwind)

### Backend
- ✅ M-Pesa C2B validation
- ✅ M-Pesa C2B confirmation
- ✅ OAuth token generation
- ✅ Payment simulation for testing
- ✅ Database query APIs
- ✅ Error handling & logging

### Database
- ✅ Transactions table
- ✅ Members table
- ✅ Cases table
- ✅ Optimized for queries
- ✅ Ready for indexes

### Security
- ✅ Environment variables for credentials
- ✅ M-Pesa signature validation
- ✅ API rate limiting (ready to implement)
- ✅ Supabase RLS policies (template)

---

## After Deployment

### Register M-Pesa Callbacks
1. Go to Safaricom Daraja
2. Update callback URLs:
   - Validation: `https://yourdomain.com/api/mpesa/validation`
   - Confirmation: `https://yourdomain.com/api/mpesa/confirmation`

### Monitor in Production
1. Check Vercel dashboard for errors
2. Review Supabase logs
3. Monitor API response times

### Ongoing Maintenance
- Update M-Pesa credentials seasonally
- Review transaction logs weekly
- Monitor database performance
- Keep dependencies updated

---

## Support & Resources

- **Next.js Docs**: https://nextjs.org/docs
- **Supabase Docs**: https://supabase.com/docs
- **Safaricom Daraja**: https://developer.safaricom.co.ke/
- **Vercel Docs**: https://vercel.com/docs

---

## Quick Links

| Document | Purpose |
|----------|---------|
| `README.md` | Project overview |
| `SETUP.md` | Detailed setup & deployment |
| `DEPLOYMENT_CHECKLIST.md` | Pre-launch checklist |
| `API_REFERENCE.md` | API documentation |
| `PROJECT_STRUCTURE.md` | File structure & features |

---

**Ready to start?** Run:
```bash
pnpm install
pnpm dev
```

Then open http://localhost:3000

Good luck! 🚀
