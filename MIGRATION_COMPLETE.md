# MobiPay Migration & Verification Complete

## Current architecture

MobiPay is now a framework-independent payment operations platform with:

- React 19 + Vite frontend in `frontend/`;
- standalone Node.js HTTP API in `server/`;
- Supabase PostgreSQL/Auth integration;
- Safaricom Daraja M-Pesa integration;
- payment transactions and reconciliation;
- STK Push and M-Pesa callback processing;
- developer API keys and webhooks;
- SMS operations and merchant configuration.

The old Next.js runtime is no longer part of the deployment model. `server/http.ts` is a small compatibility layer used by migrated route handlers; the application itself runs on Node's native HTTP server.

## Completed stabilization work

- Removed obsolete Next.js TypeScript path aliases.
- Corrected the published `@types/d3-timer` dependency version.
- Restored the compatibility aliases required by the migrated route handlers.
- Corrected stale build/migration documentation.
- Added architecture/security auditing to CI.
- Added M-Pesa callback regression tests to CI.
- Added backend TypeScript verification to CI.
- Added React/Vite production builds to CI.
- Pinned the development/CI runtime to Node 24.
- Corrected repository ignore rules so JSON configuration files are not accidentally ignored.
- Added monthly npm dependency maintenance through Dependabot.
- Added a production-readiness standard in `PRODUCTION_READINESS.md`.

## Verification

The production verification gate is:

```bash
npm run audit:architecture
npm run test:mpesa
npm run lint
npm run build:frontend
```

The GitHub Actions `CI` workflow runs the same gate for pushes to `main` and pull requests targeting `main`.

## Deployment model

### Frontend

Build and deploy `frontend/dist` to a static host such as Vercel, Cloudflare Pages, Netlify, or equivalent.

### API

Run the standalone Node service:

```bash
npm install --omit=dev --no-audit --no-fund
npm start
```

The default API port is `4000`.

### Database and authentication

Supabase remains the database/authentication layer. Server-side privileged access stays inside the API runtime.

### M-Pesa

Daraja credentials and callback configuration remain server-side. Existing callback paths are preserved.

## Production readiness

The codebase has a verified build baseline, but production activation still requires environment-specific configuration and operational checks:

1. Configure production Supabase credentials.
2. Configure the applicable Daraja production credentials and callback URLs.
3. Configure explicit frontend/API origins and HTTPS.
4. Configure webhook/callback/cron secrets in the hosting provider's secret manager.
5. Run `/health` and `/ready` checks after deployment.
6. Perform a controlled end-to-end M-Pesa transaction test.
7. Confirm reconciliation, webhook delivery, logging, and monitoring.
8. Confirm the applicable licensed-PSP operating boundaries before processing live customer funds.

See `DEPLOYMENT.md` and `PRODUCTION_READINESS.md` for the operational standard.
