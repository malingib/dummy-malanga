# M-Pesa Payment Management System

A modern Next.js application for managing M-Pesa C2B payments, member accounts, and payment dispute cases. Features real-time transaction tracking, comprehensive dashboards, and secure API integration.

## Features

- **Transaction Tracking**: Real-time M-Pesa C2B payment monitoring with success/failure status
- **Member Management**: Organize and manage member profiles with transaction history
- **Case Management**: Track and resolve payment disputes and failed transactions
- **Dashboard Analytics**: View key metrics and transaction statistics at a glance
- **Secure API Integration**: Environment variable-based M-Pesa API configuration
- **Payment Simulation**: Test C2B callbacks in development environments

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Database**: Supabase PostgreSQL
- **Styling**: Tailwind CSS
- **Language**: TypeScript
- **API Client**: Supabase JavaScript Client

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm
- Supabase account

### Installation

1. **Clone and install**:
   ```bash
   pnpm install
   ```

2. **Setup environment variables**:
   ```bash
   cp .env.local.example .env.local
   ```

3. **Configure your environment**:
   Edit `.env.local` with your Supabase credentials and M-Pesa API keys:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_KEY=your_service_key
   
   MPESA_CONSUMER_KEY=your_consumer_key
   MPESA_CONSUMER_SECRET=your_consumer_secret
   MPESA_BUSINESS_SHORTCODE=your_shortcode
   MPESA_PASSKEY=your_passkey
   ```

4. **Setup database**:
   Run the migration script in Supabase SQL Editor (`scripts/init-db.sql`)

5. **Start development server**:
   ```bash
   pnpm dev
   ```

   Visit `http://localhost:3000`

## API Endpoints

### M-Pesa Callbacks
- `POST /api/mpesa/validation` - Validates incoming C2B payments
- `POST /api/mpesa/confirmation` - Confirms and records C2B payments
- `POST /api/mpesa/token` - Gets OAuth token for M-Pesa API
- `POST /api/mpesa/simulate` - Simulates C2B payment for testing

### Dashboard Data
- `GET /api/dashboard/stats` - Dashboard statistics
- `GET /api/transactions` - List all transactions
- `GET /api/members` - List all members
- `GET /api/cases` - List all payment dispute cases

## Project Structure

```
├── app/
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Home page
│   ├── dashboard/          # Dashboard pages
│   │   ├── page.tsx        # Main dashboard
│   │   ├── transactions/   # Transactions page
│   │   ├── members/        # Members page
│   │   ├── cases/          # Cases page
│   │   └── settings/       # Settings page
│   └── api/                # API routes
│       ├── mpesa/          # M-Pesa endpoints
│       ├── transactions/   # Transaction queries
│       ├── members/        # Member queries
│       └── cases/          # Case queries
├── components/             # React components
├── lib/
│   ├── supabase.ts        # Supabase client
│   ├── db.ts              # Database queries
│   ├── mpesa.ts           # M-Pesa utilities
│   ├── validation.ts      # Payment validation
│   └── types.ts           # TypeScript types
└── scripts/
    └── init-db.sql        # Database migration
```

## Database Schema

### transactions
- `id`: UUID (primary key)
- `phone`: Phone number
- `amount`: Transaction amount
- `bill_reference`: Bill reference number
- `merchant_request_id`: Merchant request ID
- `result_code`: Result code (0 = success)
- `result_desc`: Result description
- `created_at`: Transaction timestamp

### members
- `id`: UUID (primary key)
- `name`: Member full name
- `phone`: Phone number
- `email`: Email address
- `id_number`: ID number
- `created_at`: Registration timestamp

### cases
- `id`: UUID (primary key)
- `case_number`: Case reference number
- `phone`: Associated phone number
- `description`: Case description
- `resolved_at`: Resolution timestamp (null if open)
- `created_at`: Case creation timestamp

## Environment Variables

See `.env.local.example` for all required variables. Key ones:

- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Public anon key
- `SUPABASE_SERVICE_KEY` - Service role key (for server-side operations)
- `MPESA_*` - M-Pesa API credentials

## Development

### Running Tests
```bash
pnpm test
```

### Building for Production
```bash
pnpm build
pnpm start
```

## Deployment

### Deploy to Vercel

1. Push code to GitHub
2. Connect repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy!

## Important Security Notes

- Never commit `.env.local` - it contains sensitive credentials
- Use Supabase Row Level Security (RLS) for data protection
- Validate all incoming M-Pesa requests with your passkey
- Keep API credentials secure and rotate regularly

## Support

For issues or questions:
1. Check the logs in `/app/api` for debugging
2. Review Supabase dashboard for data integrity
3. Verify M-Pesa credentials are correct

## License

MIT
