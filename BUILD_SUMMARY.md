# MobiPay Build Summary

## Current architecture

MobiPay is now organized as two independent runtime surfaces:

- **Frontend:** React 19, Vite, React Router, TanStack Query, and Zustand.
- **API:** standalone Node.js HTTP server, normally on port `4000`.
- **Database/auth:** Supabase PostgreSQL and Supabase Auth.
- **Payments:** Safaricom Daraja integration through the existing M-Pesa service layer.

The repository no longer uses the Next.js runtime. The compatibility layer in `server/http.ts` exists only to support migrated route-handler patterns while requests are served by the standalone Node server.

## Verification commands

```bash
npm install
npm --prefix frontend install
npm run audit:architecture
npm run lint
npm run test:mpesa
npm run build:frontend
npm run verify
```

`npm run verify` combines the architecture audit, backend typecheck, M-Pesa callback tests, and frontend production build.

## Main application areas

- Merchant dashboard and statistics
- Transactions and payment records
- Members and cases
- M-Pesa C2B validation and confirmation
- STK Push and payment operations
- Reconciliation
- Developer API keys
- Webhooks and delivery tracking
- SMS operations
- Merchant onboarding and settings

## Runtime configuration

Server-only secrets must remain outside the Vite frontend, including:

- Supabase service-role credentials
- M-Pesa credentials and passkeys
- Webhook encryption keys
- SMS provider tokens
- Administrative credentials

Use `.env.local.example` as the configuration template. Production deployment guidance is maintained in `DEPLOYMENT.md` and `DEPLOYMENT_CHECKLIST.md`.

## Production status

The repository contains the migrated application architecture, security audit, M-Pesa callback tests, and CI verification workflow. Production readiness still requires environment configuration, Supabase migration verification, live Daraja sandbox testing, callback registration, monitoring, and deployment smoke tests.

## Important distinction

This document describes the current React/Vite plus standalone Node architecture. Older references to Next.js pages, Next.js API routes, `next.config.*`, or Next.js deployment commands are historical and should not be used for current setup or deployment.
