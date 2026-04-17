# Database Setup Instructions

## Step 1: Run the Database Migration

1. Go to your Supabase project dashboard
2. Click on "SQL Editor" in the left sidebar
3. Click "New Query"
4. Open the file: `/scripts/init-db.sql`
5. Copy ALL the SQL code
6. Paste it into the Supabase SQL Editor
7. Click "Run" button
8. Wait for confirmation that tables were created

## Step 2: Verify Environment Variables

Your Supabase integration is already connected with these env vars:
- ✅ NEXT_PUBLIC_SUPABASE_URL
- ✅ NEXT_PUBLIC_SUPABASE_ANON_KEY
- ✅ SUPABASE_SERVICE_ROLE_KEY
- ✅ POSTGRES_URL
- ✅ POSTGRES_PASSWORD
- ✅ POSTGRES_USER
- ✅ POSTGRES_DATABASE
- ✅ POSTGRES_HOST

All are set in Vercel. No action needed.

## Step 3: Start the Application

```bash
pnpm install
pnpm dev
```

Then open http://localhost:3000

## Step 4: Test the Application

1. **Dashboard Page** (`/dashboard`)
   - Should load with stats (will show 0 if no data yet)
   - Stats update as you add data

2. **Transactions Page** (`/dashboard/transactions`)
   - Click here to see all transactions from database
   - Should be empty initially
   - Add test data using M-Pesa simulation

3. **Members Page** (`/dashboard/members`)
   - Click "Import Members" to add members
   - Or manually add members via import form

4. **Cases Page** (`/dashboard/cases`)
   - Will show all cases once you add them
   - Can create cases from dashboard

## Step 5: Add Test Data

### Option A: Use Member Import Page
1. Go to `/dashboard/members/import`
2. Paste sample CSV data:
```
member_number,name,phone_number,email,id_number,address
M001,John Kamau,254712345678,john@example.com,12345678,Nairobi
M002,Mary Wanjiru,254798765432,mary@example.com,87654321,Mombasa
M003,James Ochieng,254723456789,james@example.com,11223344,Kisumu
```
3. Click "Import"
4. Check Members page to see them

### Option B: Use Supabase Dashboard
1. In Supabase, go to the "members" table
2. Click "Insert row"
3. Fill in the details
4. Repeat for multiple members

## Step 6: Test M-Pesa Integration

To test the M-Pesa callback:

1. Go to `/api/mpesa/simulate` endpoint (this route handles test transactions)
2. Send a POST request with:
```json
{
  "MSISDN": "254712345678",
  "TransAmount": "1000",
  "BillRefNumber": "M001",
  "TransID": "TXN12345",
  "TransTime": "2024-01-15 10:30:00",
  "FirstName": "John",
  "LastName": "Kamau"
}
```

3. Check Transactions page to see the new transaction

## Common Issues

### Pages show empty with loading spinner
- Check browser console for errors
- Open Network tab to see API responses
- Verify Supabase is connected by checking env vars

### "Failed to fetch members" error
- Verify database tables were created
- Check Supabase SQL Editor for errors
- Try running init-db.sql again

### Search not working
- Make sure data exists in database
- Check API route console logs
- Verify Supabase queries in Network tab

### Stats show 0
- Add some test data first
- Wait a moment for page to refresh
- Check dashboard stats API response

## Real Data Features Now Active

✅ **Transactions** - All from database
✅ **Members** - All from database
✅ **Cases** - All from database
✅ **Search & Filter** - Works on real data
✅ **Statistics** - Calculated from real database
✅ **Bulk Import** - Saves to database
✅ **M-Pesa Integration** - Stores in database

## File Structure

```
/vercel/share/v0-project/
├── scripts/
│   └── init-db.sql          ← Run this first
├── lib/
│   ├── db.ts                ← Database functions
│   ├── supabase.ts          ← Supabase client
│   └── types.ts             ← TypeScript types
├── app/
│   ├── api/
│   │   ├── transactions/    ← Transaction API
│   │   ├── members/         ← Members API
│   │   ├── cases/           ← Cases API
│   │   └── dashboard/       ← Stats API
│   └── dashboard/
│       ├── page.tsx         ← Dashboard page
│       ├── transactions/    ← Transactions page
│       ├── members/         ← Members page
│       └── cases/           ← Cases page
```

## Next Actions

1. ✅ Run database migration (init-db.sql)
2. ✅ Start the app (pnpm dev)
3. ✅ Add test data (import members or use Supabase)
4. ✅ Test search and filters
5. ✅ Test M-Pesa simulation
6. ✅ Deploy to production

You're now using real database instead of mock data!
