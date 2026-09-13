# MobiPay Production Readiness

This document defines the minimum standard for the MobiPay production baseline.

## 1. Runtime architecture

MobiPay is intentionally split into two deployable surfaces:

- React 19 + Vite static frontend in `frontend/dist`.
- Standalone Node.js HTTP API on port `4000` by default.
- Supabase PostgreSQL/Auth for persistence and authentication.
- Safaricom Daraja for the M-Pesa integration.

The API is not a Next.js application and must not be deployed as one.

## 2. Production boundaries

### Browser/frontend

The browser may receive only public configuration such as the API origin and Supabase public/anon configuration where required by the application.

Never expose:

- `SUPABASE_SERVICE_ROLE_KEY`
- M-Pesa consumer secrets/passkeys/initiator credentials
- webhook encryption keys
- callback/cron secrets
- administrative credentials
- private API credentials

### API

The API owns privileged database access, M-Pesa credentials, callback processing, reconciliation, developer keys, webhook secrets, and other server-side integrations.

## 3. Required production configuration

At minimum configure:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PUBLIC_API_ORIGIN`
- `PUBLIC_API_PROTOCOL=https`
- `FRONTEND_ORIGIN`
- M-Pesa Daraja credentials and callback configuration required by the selected environment
- webhook/callback secrets used by the deployed routes

Use `.env.local.example` as the configuration reference. Never commit real `.env` files or credentials.

## 4. API hardening baseline

The standalone API currently provides:

- request body limits
- request and header timeouts
- security response headers
- explicit CORS allowlisting
- HTTP method validation
- generic production error responses
- health and readiness endpoints
- graceful SIGTERM/SIGINT shutdown
- callback-specific route handling

Production deployments should additionally place the API behind TLS termination and a WAF/rate limiter where appropriate.

## 5. Deployment topology

```text
                    HTTPS
Browser ──────────────────────────┐
                                  │
                         Static frontend
                         React/Vite dist
                                  │
                         /api/* /health /ready
                                  │
                                  ▼
                         Node.js API :4000
                           │            │
                           ▼            ▼
                       Supabase     Safaricom
                        DB/Auth       Daraja
```

The frontend and API may share an origin behind a reverse proxy, or the API may have a separate public origin.

## 6. Release gate

Every release to `main` must pass:

```bash
npm run audit:architecture
npm run test:mpesa
npm run lint
npm run build:frontend
```

GitHub Actions runs the same verification sequence on pushes to `main` and pull requests targeting `main`.

The CI runtime is pinned to Node 24, matching `.nvmrc` and the `engines` declarations.

## 7. Post-deployment checks

Run:

```bash
curl -fsS https://api.example.com/health
curl -fsS https://api.example.com/ready
```

Then verify:

1. frontend loads without API errors;
2. authenticated merchant access works;
3. STK Push can be initiated in the configured environment;
4. M-Pesa callbacks are reachable and accepted;
5. transaction status/reconciliation is recorded correctly;
6. webhook delivery and retry behaviour is observable;
7. logs do not contain credentials or sensitive payment data.

## 8. Dependency maintenance

The repository uses separate npm dependency trees for the API/root workspace and the React frontend. Dependabot is configured to review npm dependencies monthly.

Until lockfiles are deliberately introduced and validated for both trees, CI uses `npm install` rather than `npm ci`. Do not switch CI to `npm ci` without committing and testing the corresponding lockfiles.

## 9. Operational ownership

Production secrets belong in the hosting provider's secret manager, not GitHub source files. Rotate credentials after personnel changes, suspected exposure, or provider-recommended intervals.

The initial MobiPay operating model assumes payment services are delivered within the scope of the applicable licensed PSP arrangement. Regulatory responsibility, settlement ownership, customer funds handling, and transaction limits must remain explicitly defined in the commercial/technical agreement with the licensed partner.
