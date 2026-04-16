# Documentation Index

Complete guide to all documentation files in the M-Pesa Payment System project.

## Start Here

**New to the project?** Start with these in order:

1. **[GETTING_STARTED.md](./GETTING_STARTED.md)** ← START HERE
   - 5-minute quick start
   - Project overview
   - Common tasks
   - Troubleshooting

2. **[README.md](./README.md)**
   - Project features
   - Tech stack
   - Installation overview
   - Project structure

3. **[SETUP.md](./SETUP.md)**
   - Detailed setup instructions
   - Environment configuration
   - Database setup
   - Deployment guide

## Documentation Files

### Getting Started
- **[GETTING_STARTED.md](./GETTING_STARTED.md)** - Quick start guide with essential info
- **[README.md](./README.md)** - Project overview and features

### Setup & Configuration
- **[SETUP.md](./SETUP.md)** - Complete setup instructions for local dev and production
- **[.env.local.example](./.env.local.example)** - Environment variables template

### Deployment
- **[DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)** - Pre and post-deployment checklist
- **[SETUP.md](./SETUP.md#4-deployment-to-vercel)** - Deployment section

### Architecture & Structure
- **[PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md)** - Complete file structure and architecture
- **[DOCS_INDEX.md](./DOCS_INDEX.md)** - This file

### API Documentation
- **[API_REFERENCE.md](./API_REFERENCE.md)** - Complete API endpoint reference
  - M-Pesa endpoints
  - Dashboard endpoints
  - Request/response examples
  - Error handling

### Database
- **[scripts/init-db.sql](./scripts/init-db.sql)** - Database schema and migrations
- **[PROJECT_STRUCTURE.md#database-tables](./PROJECT_STRUCTURE.md#database-tables)** - Table schemas

---

## Documentation by Purpose

### "I want to..."

#### Get started with development
1. Read: [GETTING_STARTED.md](./GETTING_STARTED.md)
2. Follow: Setup section in [SETUP.md](./SETUP.md)
3. Reference: [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md)

#### Deploy to production
1. Follow: [SETUP.md#4-deployment-to-vercel](./SETUP.md#4-deployment-to-vercel)
2. Check: [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)
3. Verify: Security section in [SETUP.md#5-security-checklist](./SETUP.md#5-security-checklist)

#### Understand the API
1. Read: [API_REFERENCE.md](./API_REFERENCE.md)
2. Test: Examples in [API_REFERENCE.md#requestresponse-examples](./API_REFERENCE.md#requestresponse-examples)
3. Integrate: [API_REFERENCE.md#webhook-integration](./API_REFERENCE.md#webhook-integration)

#### Find where code is
1. Check: [PROJECT_STRUCTURE.md#complete-file-listing](./PROJECT_STRUCTURE.md#complete-file-listing)
2. Review: [PROJECT_STRUCTURE.md#key-features-by-file](./PROJECT_STRUCTURE.md#key-features-by-file)

#### Setup M-Pesa integration
1. Follow: [SETUP.md#3-m-pesa-configuration](./SETUP.md#3-m-pesa-configuration)
2. Test: [SETUP.md#7-testing](./SETUP.md#7-testing)
3. Reference: [API_REFERENCE.md#m-pesa-endpoints](./API_REFERENCE.md#m-pesa-endpoints)

#### Configure database
1. Setup: [SETUP.md#2-supabase-configuration](./SETUP.md#2-supabase-configuration)
2. Schema: [scripts/init-db.sql](./scripts/init-db.sql)
3. Details: [PROJECT_STRUCTURE.md#database-tables](./PROJECT_STRUCTURE.md#database-tables)

#### Debug issues
1. Troubleshoot: [GETTING_STARTED.md#troubleshooting](./GETTING_STARTED.md#troubleshooting)
2. Verify: [SETUP.md#7-monitoring--troubleshooting](./SETUP.md#7-monitoring--troubleshooting)
3. Check logs: [SETUP.md#logs](./SETUP.md#logs)

#### Monitor production
1. Review: [DEPLOYMENT_CHECKLIST.md#post-deployment-verification](./DEPLOYMENT_CHECKLIST.md#post-deployment-verification)
2. Setup: [DEPLOYMENT_CHECKLIST.md#monitoring--alerts](./DEPLOYMENT_CHECKLIST.md#monitoring--alerts)
3. Maintain: [DEPLOYMENT_CHECKLIST.md#post-launch-support](./DEPLOYMENT_CHECKLIST.md#post-launch-support)

---

## Document Quick Reference

| Document | Type | Audience | Time |
|----------|------|----------|------|
| [GETTING_STARTED.md](./GETTING_STARTED.md) | Quick Start | Everyone | 5 min |
| [README.md](./README.md) | Overview | Developers | 10 min |
| [SETUP.md](./SETUP.md) | Guide | Developers | 30 min |
| [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) | Checklist | DevOps | 20 min |
| [API_REFERENCE.md](./API_REFERENCE.md) | Reference | API Users | 15 min |
| [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) | Reference | Developers | 20 min |
| [.env.local.example](./.env.local.example) | Config | Developers | 5 min |
| [scripts/init-db.sql](./scripts/init-db.sql) | Database | DBAs | 10 min |

---

## Development Workflow

### First Time Setup
```
1. Clone repository
   ↓
2. Read GETTING_STARTED.md
   ↓
3. Run: pnpm install
   ↓
4. Copy .env.local.example → .env.local
   ↓
5. Add your credentials
   ↓
6. Run: pnpm dev
   ↓
7. Visit http://localhost:3000
```

### Adding Features
```
1. Check PROJECT_STRUCTURE.md for file locations
   ↓
2. Review similar existing features
   ↓
3. Add your code
   ↓
4. Test locally
   ↓
5. Commit and push
   ↓
6. Deploy via Vercel
```

### Production Deployment
```
1. Push code to GitHub
   ↓
2. Follow SETUP.md deployment section
   ↓
3. Use DEPLOYMENT_CHECKLIST.md
   ↓
4. Verify all checks complete
   ↓
5. Go live!
   ↓
6. Monitor with DEPLOYMENT_CHECKLIST.md#post-launch-support
```

---

## API Development Workflow

### Testing an Endpoint
```
1. Read endpoint in API_REFERENCE.md
   ↓
2. Copy example request
   ↓
3. Test with cURL or Postman
   ↓
4. Check response in console
   ↓
5. Debug with browser DevTools
```

### Integrating with M-Pesa
```
1. Get credentials from Safaricom Daraja
   ↓
2. Add to .env.local
   ↓
3. Follow SETUP.md#3-m-pesa-configuration
   ↓
4. Test with /api/mpesa/simulate
   ↓
5. Register URLs in Daraja
   ↓
6. Test with actual M-Pesa
```

---

## Troubleshooting Guide

### Problem: Dependencies not installed
**Solution:** See [GETTING_STARTED.md#troubleshooting](./GETTING_STARTED.md#troubleshooting)

### Problem: Database not connecting
**Solution:** See [SETUP.md#7-monitoring--troubleshooting](./SETUP.md#7-monitoring--troubleshooting)

### Problem: M-Pesa token request fails
**Solution:** See [SETUP.md#7-monitoring--troubleshooting](./SETUP.md#7-monitoring--troubleshooting)

### Problem: API endpoint returns 404
**Solution:** Check [API_REFERENCE.md](./API_REFERENCE.md) for correct endpoint path

### Problem: Dashboard not loading data
**Solution:** Check Supabase logs and environment variables in [SETUP.md#2-supabase-configuration](./SETUP.md#2-supabase-configuration)

---

## File-by-File Documentation

### Configuration Files
| File | Purpose | See |
|------|---------|-----|
| `package.json` | Dependencies | [README.md](./README.md#tech-stack) |
| `tsconfig.json` | TypeScript config | [SETUP.md](./SETUP.md) |
| `tailwind.config.ts` | Tailwind CSS | [README.md](./README.md#tech-stack) |
| `next.config.mjs` | Next.js config | [SETUP.md](./SETUP.md) |
| `postcss.config.mjs` | PostCSS config | [SETUP.md](./SETUP.md) |
| `.env.local.example` | Env template | [SETUP.md#required-environment-variables](./SETUP.md#required-environment-variables) |

### App Files
| File | Purpose | See |
|------|---------|-----|
| `app/layout.tsx` | Root layout | [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) |
| `app/page.tsx` | Home page | [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) |
| `app/globals.css` | Global styles | [README.md](./README.md#tech-stack) |

### Dashboard Pages
| File | Purpose | See |
|------|---------|-----|
| `app/dashboard/layout.tsx` | Dashboard layout | [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) |
| `app/dashboard/page.tsx` | Main dashboard | [API_REFERENCE.md#1-get-dashboard-statistics](./API_REFERENCE.md#1-get-dashboard-statistics) |
| `app/dashboard/transactions/page.tsx` | Transactions | [API_REFERENCE.md#2-get-all-transactions](./API_REFERENCE.md#2-get-all-transactions) |
| `app/dashboard/members/page.tsx` | Members | [API_REFERENCE.md#3-get-all-members](./API_REFERENCE.md#3-get-all-members) |
| `app/dashboard/cases/page.tsx` | Cases | [API_REFERENCE.md#4-get-all-cases](./API_REFERENCE.md#4-get-all-cases) |

### Library Files
| File | Purpose | See |
|------|---------|-----|
| `lib/db.ts` | Database queries | [PROJECT_STRUCTURE.md#key-functions](./PROJECT_STRUCTURE.md#key-functions) |
| `lib/mpesa.ts` | M-Pesa utils | [PROJECT_STRUCTURE.md#key-functions](./PROJECT_STRUCTURE.md#key-functions) |
| `lib/validation.ts` | Validation | [PROJECT_STRUCTURE.md#key-functions](./PROJECT_STRUCTURE.md#key-functions) |

### API Routes
| File | Purpose | See |
|------|---------|-----|
| `app/api/mpesa/validation/route.ts` | C2B validation | [API_REFERENCE.md#1-c2b-validation](./API_REFERENCE.md#1-c2b-validation) |
| `app/api/mpesa/confirmation/route.ts` | C2B confirmation | [API_REFERENCE.md#2-c2b-confirmation](./API_REFERENCE.md#2-c2b-confirmation) |
| `app/api/mpesa/token/route.ts` | OAuth token | [API_REFERENCE.md#3-generate-access-token](./API_REFERENCE.md#3-generate-access-token) |
| `app/api/mpesa/simulate/route.ts` | Simulate payment | [API_REFERENCE.md#4-simulate-c2b-payment](./API_REFERENCE.md#4-simulate-c2b-payment) |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Jan 2024 | Initial release |

---

## Support & Help

### Getting Stuck?
1. Check [GETTING_STARTED.md#troubleshooting](./GETTING_STARTED.md#troubleshooting)
2. Review [SETUP.md#7-monitoring--troubleshooting](./SETUP.md#7-monitoring--troubleshooting)
3. Check [API_REFERENCE.md](./API_REFERENCE.md) for endpoint details
4. Review error logs in Vercel/Supabase dashboards

### Need to Know Something Specific?
- **"How do I..."** → [GETTING_STARTED.md](./GETTING_STARTED.md#common-tasks)
- **"What is the API for..."** → [API_REFERENCE.md](./API_REFERENCE.md)
- **"Where is the code for..."** → [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md)
- **"How do I deploy..."** → [SETUP.md#4-deployment-to-vercel](./SETUP.md#4-deployment-to-vercel)

---

**Last Updated:** January 2024

All documentation is up-to-date with the current codebase.
For questions, refer to the relevant document listed above.
