# M-Pesa Payment System - Setup Guide

Complete step-by-step instructions for deploying and configuring the M-Pesa payment management system.

## Prerequisites

- Node.js 18.17 or higher
- pnpm 8+ (or npm/yarn)
- A Supabase account (https://supabase.com)
- M-Pesa API credentials (Safaricom)

## 1. Local Development Setup

### Clone and Install

```bash
# Install dependencies
pnpm install

# Or with npm
npm install
```

### Environment Variables

```bash
# Copy the example env file
cp .env.local.example .env.local

# Edit .env.local with your actual credentials
nano .env.local
```

### Required Environment Variables

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_KEY=your-service-key-here

# M-Pesa API Credentials
MPESA_CONSUMER_KEY=your-consumer-key
MPESA_CONSUMER_SECRET=your-consumer-secret
MPESA_BUSINESS_SHORTCODE=your-shortcode
MPESA_PASSKEY=your-passkey
MPESA_INITIATOR_NAME=your-initiator-name

# Daraja URLs (use sandbox for testing)
MPESA_BASE_URL=https://sandbox.safaricom.co.ke
MPESA_TOKEN_URL=https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Database Setup

1. **Create a new Supabase project** at https://supabase.com
2. **Go to SQL Editor** in your Supabase dashboard
3. **Create a new query** and paste the contents of `scripts/init-db.sql`
4. **Run the query** to create all required tables

Or use the Supabase CLI:

```bash
# Install Supabase CLI
brew install supabase/tap/supabase  # macOS
# For other OS, visit https://supabase.com/docs/guides/cli

# Link to your project
supabase link --project-ref your-project-id

# Push migrations
supabase db push
```

### Start Development Server

```bash
pnpm dev
```

Visit http://localhost:3000 to see the application.

## 2. Supabase Configuration

### Enable Row Level Security (RLS)

For production deployments, enable RLS policies on all tables:

```sql
-- Example: Transactions table RLS
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view transactions
CREATE POLICY "Users can view all transactions"
  ON transactions FOR SELECT
  USING (true);

-- Only app service can insert
CREATE POLICY "Service can insert transactions"
  ON transactions FOR INSERT
  WITH CHECK (true);
```

### Backup Strategy

```bash
# Backup your database
pg_dump $DATABASE_URL > backup.sql

# Restore from backup
psql $DATABASE_URL < backup.sql
```

## 3. M-Pesa Configuration

### Register Validation and Confirmation URLs

The system has an API endpoint at `/api/mpesa/validation` and `/api/mpesa/confirmation` that handles C2B callbacks.

**Production Example:**
```
Validation URL: https://yourdomain.com/api/mpesa/validation
Confirmation URL: https://yourdomain.com/api/mpesa/confirmation
```

Register these URLs in:
1. Go to Safaricom Daraja portal
2. Select your C2B application
3. Update the URLs
4. Test with the simulation endpoint

### Test M-Pesa Integration

Use the simulation endpoint to test:

```bash
curl -X POST http://localhost:3000/api/mpesa/simulate \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "254708374149",
    "amount": 100,
    "bill_reference": "TEST001"
  }'
```

## 4. Deployment to Vercel

### Prerequisites

- GitHub account with your repository
- Vercel account

### Steps

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Connect to Vercel**
   - Go to https://vercel.com
   - Click "New Project"
   - Select your GitHub repository
   - Vercel will auto-detect Next.js

3. **Add Environment Variables**
   - In Vercel dashboard, go to Settings → Environment Variables
   - Add all variables from `.env.local.example`
   - **IMPORTANT**: Never commit `.env.local` to Git

4. **Deploy**
   - Click "Deploy"
   - Your app will be live in ~1-2 minutes

### Post-Deployment

After deployment:

1. **Update M-Pesa URLs** to your Vercel domain:
   ```
   https://your-domain.vercel.app/api/mpesa/validation
   https://your-domain.vercel.app/api/mpesa/confirmation
   ```

2. **Monitor in Vercel**
   - Check Deployments tab for build status
   - View Logs for any errors
   - Monitor Metrics for performance

## 5. Security Checklist

- [ ] Environment variables are set in Vercel (not in code)
- [ ] `.env.local` is in `.gitignore`
- [ ] RLS is enabled on Supabase tables
- [ ] M-Pesa credentials are rotated periodically
- [ ] Database backups are configured
- [ ] HTTPS is enforced
- [ ] API rate limiting is configured (if needed)
- [ ] Input validation is in place

## 6. Testing

### Unit Tests

```bash
pnpm test
```

### Integration Testing

1. **Test validation endpoint:**
   ```bash
   curl -X POST http://localhost:3000/api/mpesa/validation \
     -H "Content-Type: application/json" \
     -d '{"TransactionType":"C2B","Phone":"254708374149","Amount":"100","BillRefNumber":"TEST001"}'
   ```

2. **Test dashboard pages:**
   - Navigate to http://localhost:3000/dashboard
   - Check all pages load correctly
   - Verify data displays properly

### Load Testing

For production deployments, consider using:
- LoadTesting.io
- k6
- Apache JMeter

## 7. Monitoring & Troubleshooting

### Common Issues

**"Cannot find Supabase client"**
- Check NEXT_PUBLIC_SUPABASE_URL is set
- Verify Supabase project is active

**"M-Pesa token request failed"**
- Verify MPESA_CONSUMER_KEY and MPESA_CONSUMER_SECRET
- Check that the Daraja environment is accessible
- Use the token endpoint test in dashboard settings

**"Database connection error"**
- Check SUPABASE_SERVICE_KEY is correct
- Verify Supabase project is not paused
- Check network connectivity

### Logs

- **Vercel Logs**: https://vercel.com/docs/observability/logging
- **Supabase Logs**: Go to Logs in Supabase dashboard
- **Local Logs**: Check browser console and terminal output

## 8. Scaling

### Database Performance

```sql
-- Add indexes for common queries
CREATE INDEX idx_transactions_phone ON transactions(phone);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX idx_members_phone ON members(phone);
```

### Caching

Consider using Vercel KV for:
- Session storage
- Rate limiting
- Transaction caching

## Support & Resources

- Supabase Docs: https://supabase.com/docs
- Safaricom Daraja: https://developer.safaricom.co.ke/
- Next.js Docs: https://nextjs.org/docs
- Vercel Docs: https://vercel.com/docs

## Version Info

- Next.js: ^14.0.0
- React: ^18.0.0
- TypeScript: ^5.0.0
- Supabase: ^2.38.0
