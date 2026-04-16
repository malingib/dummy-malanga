# Project Structure Overview

## Complete File Listing

```
mlg/
├── app/
│   ├── layout.tsx                    # Root layout with metadata
│   ├── page.tsx                      # Home/landing page
│   ├── globals.css                   # Global Tailwind styles
│   ├── dashboard/
│   │   ├── layout.tsx               # Dashboard layout with sidebar navigation
│   │   ├── page.tsx                 # Main dashboard with stats
│   │   ├── transactions/
│   │   │   └── page.tsx             # Transactions table with search/filter
│   │   ├── members/
│   │   │   └── page.tsx             # Members management table
│   │   ├── cases/
│   │   │   └── page.tsx             # Payment disputes/cases table
│   │   └── settings/
│   │       └── page.tsx             # Configuration & API settings
│   └── api/
│       ├── mpesa/
│       │   ├── validation/
│       │   │   └── route.ts         # C2B validation callback
│       │   ├── confirmation/
│       │   │   └── route.ts         # C2B confirmation callback
│       │   ├── token/
│       │   │   └── route.ts         # OAuth token generation
│       │   └── simulate/
│       │       └── route.ts         # Payment simulation for testing
│       ├── dashboard/
│       │   └── stats/
│       │       └── route.ts         # Dashboard statistics endpoint
│       ├── transactions/
│       │   └── route.ts             # Get all transactions
│       ├── members/
│       │   └── route.ts             # Get all members
│       └── cases/
│           └── route.ts             # Get all cases
├── components/
│   ├── StatsCard.tsx                # Reusable statistics card component
│   └── Navigation.tsx               # Top navigation bar
├── lib/
│   ├── supabase.ts                  # Supabase client initialization
│   ├── db.ts                        # Database queries and operations
│   ├── types.ts                     # TypeScript type definitions
│   ├── mpesa.ts                     # M-Pesa utility functions
│   ├── validation.ts                # Payment validation logic
│   └── utils.ts                     # Helper functions (cn for Tailwind)
├── scripts/
│   └── init-db.sql                  # Database schema migration
├── public/                          # Static assets (images, etc.)
├── .env.local.example               # Environment variables template
├── .env.local                       # (Git ignored) Actual environment variables
├── .gitignore                       # Git ignore rules
├── next.config.mjs                  # Next.js configuration
├── tsconfig.json                    # TypeScript configuration
├── tailwind.config.ts               # Tailwind CSS configuration
├── postcss.config.mjs               # PostCSS configuration
├── components.json                  # shadcn/ui configuration
├── package.json                     # Dependencies and scripts
├── README.md                        # Project documentation
├── SETUP.md                         # Detailed setup instructions
└── PROJECT_STRUCTURE.md             # This file
```

## Key Features by File

### API Routes

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/mpesa/validation` | POST | Validates C2B transactions |
| `/api/mpesa/confirmation` | POST | Confirms and records C2B payments |
| `/api/mpesa/token` | POST | Generates OAuth tokens |
| `/api/mpesa/simulate` | POST | Simulates payment for testing |
| `/api/dashboard/stats` | GET | Returns dashboard statistics |
| `/api/transactions` | GET | Lists all transactions |
| `/api/members` | GET | Lists all members |
| `/api/cases` | GET | Lists all payment cases |

### Dashboard Pages

| Page | Route | Features |
|------|-------|----------|
| Dashboard | `/dashboard` | Overview stats, quick actions |
| Transactions | `/dashboard/transactions` | Searchable table, status filter |
| Members | `/dashboard/members` | Member profiles, search |
| Cases | `/dashboard/cases` | Dispute tracking, status filter |
| Settings | `/dashboard/settings` | API config, notifications |

### Database Tables

**transactions**
- id (UUID)
- phone (varchar)
- amount (numeric)
- bill_reference (varchar)
- merchant_request_id (varchar)
- result_code (integer)
- result_desc (text)
- created_at (timestamp)

**members**
- id (UUID)
- name (varchar)
- phone (varchar)
- email (varchar, nullable)
- id_number (varchar, nullable)
- created_at (timestamp)

**cases**
- id (UUID)
- case_number (varchar)
- phone (varchar)
- description (text)
- resolved_at (timestamp, nullable)
- created_at (timestamp)

## Technology Stack

### Frontend
- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Custom components + shadcn/ui

### Backend
- **Runtime**: Node.js (Next.js API Routes)
- **Database**: PostgreSQL (via Supabase)
- **Client Library**: @supabase/supabase-js

### Development
- **Package Manager**: pnpm
- **Testing**: Jest (configured in package.json)
- **Linting**: ESLint, Prettier
- **Build Tool**: Turbopack (Next.js 14+)

## Environment Variables

Required variables in `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=

# M-Pesa
MPESA_CONSUMER_KEY=
MPESA_CONSUMER_SECRET=
MPESA_BUSINESS_SHORTCODE=
MPESA_PASSKEY=
MPESA_INITIATOR_NAME=

# URLs
MPESA_BASE_URL=https://sandbox.safaricom.co.ke
MPESA_TOKEN_URL=https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Key Functions

### Database Operations (`lib/db.ts`)
- `getStats()` - Dashboard statistics
- `getTransactions()` - All transactions
- `getMembers()` - All members
- `getCases()` - All cases
- `createTransaction()` - Record new transaction
- `createCase()` - Create dispute case
- `addMember()` - Register new member

### M-Pesa Utilities (`lib/mpesa.ts`)
- `generateMPesaToken()` - Get OAuth token
- `validateCallback()` - Validate C2B request
- `parseBillReference()` - Extract bill data
- `sendSMS()` - Send confirmation SMS
- `updateWallet()` - Update member wallet

### Validation (`lib/validation.ts`)
- `validateC2BRequest()` - Validate payment data
- `validatePhoneNumber()` - Phone format validation
- `validateAmount()` - Amount validation
- `validateMerchantSignature()` - Security validation

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Setup environment
cp .env.local.example .env.local
# Edit .env.local with credentials

# 3. Setup database
# - Go to Supabase
# - Run scripts/init-db.sql in SQL Editor

# 4. Start dev server
pnpm dev

# 5. Open browser
# http://localhost:3000
```

## Deployment

### Vercel (Recommended)
1. Push to GitHub
2. Connect repo to Vercel
3. Add environment variables
4. Deploy

See `SETUP.md` for detailed instructions.

## Security Features

- Environment variables for all credentials
- M-Pesa signature validation
- Idempotency guards on callbacks
- Request logging and monitoring
- SQL injection prevention with parameterized queries
- CORS configuration ready

## File Sizes & Performance

- Next.js with Turbopack provides instant HMR
- Optimized database queries with indexing
- Tailwind CSS minified in production
- Image optimization ready (public/ folder)
- API routes use streaming where applicable

## Maintenance

### Regular Tasks
- Monitor Supabase backups
- Review API logs for errors
- Update M-Pesa credentials seasonally
- Check transaction failure rates

### Scaling
- Add database indexes for large datasets
- Consider caching with Vercel KV
- Implement rate limiting
- Monitor API response times
