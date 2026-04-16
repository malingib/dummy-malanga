# Deployment Checklist

Use this checklist to ensure your M-Pesa payment system is properly configured before going to production.

## Pre-Deployment (Local Testing)

### Database & Environment
- [ ] `.env.local` file created with all required variables
- [ ] `.env.local` is in `.gitignore` (not committed to Git)
- [ ] Supabase project created and accessible
- [ ] Database schema initialized (scripts/init-db.sql executed)
- [ ] All database tables visible in Supabase dashboard

### M-Pesa Configuration
- [ ] M-Pesa consumer key and secret obtained from Safaricom
- [ ] Business shortcode confirmed
- [ ] Passkey generated and stored securely
- [ ] Initiator name configured
- [ ] Development endpoint (sandbox) URL configured

### Application Testing
- [ ] `pnpm install` runs successfully
- [ ] `pnpm dev` starts without errors
- [ ] Home page loads at http://localhost:3000
- [ ] Dashboard loads at http://localhost:3000/dashboard
- [ ] All dashboard pages accessible:
  - [ ] `/dashboard/transactions`
  - [ ] `/dashboard/members`
  - [ ] `/dashboard/cases`
  - [ ] `/dashboard/settings`
- [ ] API endpoints respond correctly:
  - [ ] `GET /api/transactions`
  - [ ] `GET /api/members`
  - [ ] `GET /api/cases`
  - [ ] `GET /api/dashboard/stats`
- [ ] M-Pesa simulation endpoint works: `POST /api/mpesa/simulate`
- [ ] No console errors or warnings

### Security Validation
- [ ] No hardcoded credentials in code
- [ ] API keys only in environment variables
- [ ] HTTPS enabled (localhost is fine)
- [ ] CORS headers configured appropriately
- [ ] Input validation in place on all API routes

## GitHub & Vercel Setup

### GitHub Repository
- [ ] Code pushed to GitHub
- [ ] Repository is private (if sensitive data involved)
- [ ] `.env.local` is in `.gitignore`
- [ ] README.md is present and informative
- [ ] No secrets in git history (`git-secrets` or similar tool used)

### Vercel Connection
- [ ] Vercel account created
- [ ] GitHub repository connected to Vercel
- [ ] Build command verified: `pnpm build`
- [ ] Start command verified: `pnpm start`
- [ ] Node version set to 18.17+ in Vercel settings

## Production Environment Variables

Set these in Vercel dashboard under Settings → Environment Variables:

### Required for Deployment
- [ ] `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Public anon key from Supabase
- [ ] `SUPABASE_SERVICE_KEY` - Service role key (marked as sensitive)
- [ ] `MPESA_CONSUMER_KEY` - M-Pesa consumer key (marked as sensitive)
- [ ] `MPESA_CONSUMER_SECRET` - M-Pesa consumer secret (marked as sensitive)
- [ ] `MPESA_BUSINESS_SHORTCODE` - Your business shortcode
- [ ] `MPESA_PASSKEY` - M-Pesa passkey (marked as sensitive)
- [ ] `MPESA_INITIATOR_NAME` - Initiator name
- [ ] `MPESA_BASE_URL` - Production: https://api.safaricom.co.ke
- [ ] `MPESA_TOKEN_URL` - Production token URL
- [ ] `NEXT_PUBLIC_APP_URL` - Your production domain

### Mark as Sensitive
- [ ] `SUPABASE_SERVICE_KEY`
- [ ] `MPESA_CONSUMER_KEY`
- [ ] `MPESA_CONSUMER_SECRET`
- [ ] `MPESA_PASSKEY`

## Production Build

### Build & Deployment
- [ ] Vercel deployment triggered
- [ ] Build logs show no errors
- [ ] Build completes in < 5 minutes
- [ ] Preview deployment is accessible
- [ ] All pages load correctly in preview
- [ ] API routes respond in preview
- [ ] No 500 errors in logs

### Production Deployment
- [ ] Domain connected to Vercel
- [ ] SSL certificate auto-generated (Vercel handles this)
- [ ] Production environment is live
- [ ] All pages accessible via production domain
- [ ] API endpoints working in production

## Post-Deployment Verification

### Website Functionality
- [ ] Home page loads at https://yourdomain.com
- [ ] Dashboard accessible at https://yourdomain.com/dashboard
- [ ] All navigation links work
- [ ] Dashboard pages load and display data
- [ ] Search/filter functionality works
- [ ] No console errors in browser DevTools

### API Functionality
- [ ] Transaction data loads in dashboard
- [ ] Member data loads in dashboard
- [ ] Case data loads in dashboard
- [ ] Statistics calculate correctly
- [ ] API response times acceptable (< 500ms)

### M-Pesa Integration
- [ ] M-Pesa callback URLs updated in Safaricom Daraja:
  - [ ] Validation URL: `https://yourdomain.com/api/mpesa/validation`
  - [ ] Confirmation URL: `https://yourdomain.com/api/mpesa/confirmation`
- [ ] Test C2B payment via Daraja simulator
- [ ] Transaction recorded in database
- [ ] Transaction appears in dashboard

### Database Health
- [ ] Can connect to Supabase from production
- [ ] Database queries execute < 100ms
- [ ] Data persists correctly
- [ ] No connection pool issues
- [ ] Backups configured in Supabase

## Security Hardening

### Supabase Configuration
- [ ] Row Level Security (RLS) enabled on all tables
- [ ] RLS policies configured and tested
- [ ] Service key restricted to backend operations
- [ ] Anon key has minimal permissions
- [ ] Database backups automated (Supabase Pro+)

### Application Security
- [ ] No sensitive data logged to console
- [ ] Error messages don't expose system details
- [ ] API rate limiting configured (if needed)
- [ ] HTTPS enforced (Vercel does this by default)
- [ ] Security headers configured in next.config.mjs

### Monitoring & Alerts
- [ ] Vercel analytics dashboard configured
- [ ] Error notifications setup
- [ ] Database usage alerts configured
- [ ] Daily backup verification process

## Scaling & Performance

### Database Optimization
- [ ] Indexes created on frequently queried columns:
  - [ ] transactions.phone
  - [ ] transactions.created_at
  - [ ] members.phone
- [ ] Query performance analyzed
- [ ] No N+1 queries detected
- [ ] Connection pooling configured (Supabase PgBouncer)

### Caching Strategy
- [ ] Supabase caching headers configured
- [ ] Next.js ISR (Incremental Static Regeneration) setup for static pages
- [ ] Consider Vercel KV for session/rate limit data

### Load Testing
- [ ] Application tested under load
- [ ] Expected concurrent users defined
- [ ] Response times acceptable under load
- [ ] No errors during load test

## Backup & Disaster Recovery

### Database Backups
- [ ] Supabase automatic backups enabled
- [ ] Backup retention policy set
- [ ] Test restore procedure
- [ ] Backup location verified (off-site)

### Code Backup
- [ ] GitHub repository backed up
- [ ] Deployment history maintained
- [ ] Rollback procedure documented

## Documentation & Handoff

### Documentation Complete
- [ ] README.md updated with deployment info
- [ ] SETUP.md covers local development
- [ ] DEPLOYMENT_CHECKLIST.md reviewed
- [ ] Environment variables documented
- [ ] API endpoints documented
- [ ] Database schema documented

### Monitoring Access
- [ ] Team members have Vercel access
- [ ] Team members have Supabase access
- [ ] GitHub access configured
- [ ] Incident response procedures documented
- [ ] Contact information for support

## Final Verification

### 24-Hour Monitor
- [ ] Application stable for 24 hours
- [ ] No recurring errors in logs
- [ ] Database performing well
- [ ] API response times consistent
- [ ] M-Pesa payments processing correctly

### Sign-Off
- [ ] Project manager approval
- [ ] Client/stakeholder approval
- [ ] Security review completed
- [ ] Performance benchmarks met
- [ ] Documentation complete

---

## Post-Launch Support

### Week 1
- [ ] Monitor error logs daily
- [ ] Respond to user feedback
- [ ] Fix any critical issues
- [ ] Verify M-Pesa transaction accuracy

### Month 1
- [ ] Review performance metrics
- [ ] Optimize slow endpoints if needed
- [ ] Gather user feedback
- [ ] Plan future enhancements

### Ongoing
- [ ] Monthly security updates
- [ ] Quarterly performance review
- [ ] Annual security audit
- [ ] Dependency updates as released

---

## Rollback Procedure

If issues arise post-deployment:

1. **Identify Issue**
   - Check Vercel logs
   - Check Supabase logs
   - Review recent changes

2. **Rollback Steps**
   - Go to Vercel dashboard
   - Select Deployments
   - Choose previous working version
   - Click "Redeploy"

3. **Investigation**
   - Review what changed
   - Test changes locally
   - Plan fix
   - Redeploy

---

**Last Updated**: [Your Date]
**Deployed By**: [Your Name]
**Production URL**: https://yourdomain.com
**Support Contact**: [Support Email/Phone]
