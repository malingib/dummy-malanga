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
- licensed PSP credentials
- settlement credentials

### API

The API owns privileged database access, M-Pesa credentials, callback processing, reconciliation, developer keys, webhook secrets, and other server-side integrations.

## 3. Licensed PSP operating model

MobiPay's initial production model is **partner PSP**: MobiPay provides payment technology/orchestration while the applicable regulated services remain within the scope of an appropriately licensed PSP arrangement.

Production payment initiation is technically blocked unless all of the following are configured server-side:

- `MOBIPAY_OPERATING_MODE=partner_psp`
- `PSP_LICENSE_STATUS=verified`
- `PSP_PROVIDER_ID` is configured

This is a technical release gate, not a substitute for legal/regulatory authorization. The partner agreement must define settlement ownership, customer-funds handling, KYC/AML responsibilities, transaction limits, complaints/disputes, reporting, audit rights and incident response.

See [`docs/PSP-OPERATING-MODEL.md`](./docs/PSP-OPERATING-MODEL.md).

## 4. Required production configuration

At minimum configure:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PUBLIC_API_ORIGIN`
- `PUBLIC_API_PROTOCOL=https`
- `FRONTEND_ORIGIN`
- `MOBIPAY_OPERATING_MODE=partner_psp`
- `PSP_PROVIDER_ID`
- `PSP_LICENSE_STATUS=verified`
- M-Pesa Daraja credentials and callback configuration required by the selected environment
- webhook/callback secrets used by the deployed routes

Use `.env.local.example` as the configuration reference. Never commit real `.env` files or credentials.

## 5. API hardening baseline

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
- idempotent public STK requests
- tenant-safe payment routing
- production PSP boundary enforcement

Production deployments should additionally place the API behind TLS termination and a WAF/rate limiter where appropriate.

## 6. Deployment topology

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
                                        │
                                        ▼
                              Licensed PSP boundary
```

The frontend and API may share an origin behind a reverse proxy, or the API may have a separate public origin.

## 7. Release gate

Every release to `main` must pass:

```bash
npm run audit:architecture
npm run test:mpesa
npm run lint
npm run build:frontend
```

GitHub Actions runs the same verification sequence on pushes to `main` and pull requests targeting `main`.

The CI runtime is pinned to Node 24, matching `.nvmrc` and the `engines` declarations.

## 8. Post-deployment checks

Run:

```bash
curl -fsS https://api.example.com/health
curl -fsS https://api.example.com/ready
```

Then verify:

1. frontend loads without API errors;
2. authenticated merchant access works;
3. the licensed PSP configuration is verified;
4. STK Push can be initiated in the configured environment;
5. M-Pesa callbacks are reachable and accepted;
6. transaction status/reconciliation is recorded correctly;
7. webhook delivery and retry behaviour is observable;
8. logs do not contain credentials or sensitive payment data.

## 9. Dependency maintenance

The repository uses separate npm dependency trees for the API/root workspace and the React frontend. Dependabot is configured to review npm dependencies monthly.

Until lockfiles are deliberately introduced and validated for both trees, CI uses `npm install` rather than `npm ci`. Do not switch CI to `npm ci` without committing and testing the corresponding lockfiles.

## 10. Operational ownership

Production secrets belong in the hosting provider's secret manager, not GitHub source files. Rotate credentials after personnel changes, suspected exposure, or provider-recommended intervals.

The production software baseline is technically prepared for partner onboarding and sandbox validation. It does not claim independent PSP authorization, Safaricom production approval, production credentials, or a right to hold customer funds outside the applicable licensed arrangement.
