# MobiPay

MobiPay is a merchant payment operations platform for M-Pesa collections, STK Push, reconciliation, developer APIs, webhooks, SMS notifications, and merchant configuration.

The application is now fully independent of Next.js and Supabase:

- **Frontend:** React 19 + Vite + React Router + TanStack Query + Zustand
- **API:** standalone Node.js HTTP server
- **Database:** Neon PostgreSQL accessed directly over the PostgreSQL protocol
- **Auth:** signed merchant workspace cookie, hashed developer API keys, and a separate signed platform-admin session
- **Payments:** Safaricom Daraja integration through the existing M-Pesa service layer
- **Production model:** payment technology/orchestration operating within an appropriately licensed PSP arrangement

Database migrations live in `db/migrations` and are applied with `npm run db:migrate`. The API no longer uses Supabase PostgREST or Supabase Auth.

## Architecture

```text
Browser
   │
   ▼
React + Vite
   │ /api/*
   ▼
Node.js API (:4000)
   ├── merchant operations
   ├── STK Push
   ├── C2B validation / confirmation
   ├── M-Pesa connections and activation
   ├── reconciliation
   ├── developer API keys
   ├── webhooks and deliveries
   ├── SMS operations
   └── platform administration (/api/admin/*)
          │
          ├── Neon PostgreSQL
          └── Safaricom Daraja
                  │
                  ▼
             Licensed PSP boundary
```

The merchant console and the platform admin console are two separate application shells:

- **Merchant console:** `/`, `/payments`, `/customers`, `/reconciliation`, `/mpesa`, `/sms`, `/developers`, `/settings`
- **Platform admin console:** `/admin`, `/admin/merchants`, `/admin/transactions`, `/admin/exceptions`, `/admin/activations`, `/admin/audit`

They also use separate server-side authentication boundaries: merchant routes resolve the `mobiwave_workspace_id` workspace cookie, while admin routes only accept the signed `mobiwave_platform_admin` session. A merchant workspace cookie cannot authorise an admin request.

The existing API contracts remain under `/api/*`, so the merchant frontend and external M-Pesa callback URLs do not need to change merely because the web framework changed.

## Production operating model

MobiPay's initial production deployment is **partner PSP**. The application includes a server-side production gate that blocks production payment initiation unless:

```text
MOBIPAY_OPERATING_MODE=partner_psp
PSP_LICENSE_STATUS=verified
PSP_PROVIDER_ID=<approved partner identifier>
```

This is a technical control, not legal authorization. The licensed partner agreement must define settlement ownership, customer-funds handling, KYC/AML duties, transaction limits, disputes, reporting and incident response.

See [`docs/PSP-OPERATING-MODEL.md`](./docs/PSP-OPERATING-MODEL.md) and [`PRODUCTION_READINESS.md`](./PRODUCTION_READINESS.md).

## Local development

Install backend dependencies:

```bash
npm install
```

Install frontend dependencies:

```bash
npm --prefix frontend install
```

Start the API:

```bash
npm run dev
```

Start the Vite frontend in a second terminal:

```bash
npm run dev:frontend
```

The Vite development server runs on port `5173` and proxies `/api` to the Node API on port `4000`.

## Environment

Copy the example file:

```bash
cp .env.local.example .env.local
```

Configure the Neon `DATABASE_URL`, Daraja, licensed PSP mode, webhook encryption, SMS, and application variables there. Server secrets must never be placed in the Vite frontend environment.

For a separately hosted frontend, set `VITE_API_BASE_URL` to the public API origin. When frontend and API share an origin behind a reverse proxy, leave it empty and route `/api/*` to Node.

## Database setup

Create a Neon project, copy its pooled or direct PostgreSQL connection string into `DATABASE_URL`, then apply the schema:

```bash
npm run db:migrate
```

The migration runner applies every file in `db/migrations` in filename order, wraps each file in a transaction, and records it in `public.schema_migrations` so reruns are safe. `000_neon_bootstrap.sql` provides the historical `auth.uid()` compatibility shim required by the RLS policies; the API itself connects directly as the database owner and authorises requests in server code. Migration `014_mpesa_production_observability.sql` now uses the real `mpesa_callback_events.received_at` column.

## Platform administration

The platform admin console is available at `/admin` and is intentionally not linked from the merchant navigation. It is for internal operators who need a cross-merchant view of onboarding, M-Pesa posture, payment volume, reconciliation exceptions and activation decisions.

Configure its credentials on the API server:

```text
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<a long unique password>
PLATFORM_ADMIN_NAME=Platform administrator
# Optional. Defaults to ADMIN_PASSWORD. Changing it invalidates existing sessions.
PLATFORM_ADMIN_SESSION_SECRET=<a long random secret>
```

Admin sessions are signed, HTTP-only cookies with an 8-hour lifetime. They are separate from merchant workspace cookies and from merchant API keys. Admin routes use `/api/admin/*` and are rejected unless the admin session is valid. Run `db/migrations/018_platform_admin.sql` to enable the platform summary view, SQL overview aggregate and append-only admin audit trail.

Platform data routes also need `DATABASE_URL`. When it is missing they fail fast with `503 database_configured:false`; database calls time out after `DATABASE_REQUEST_TIMEOUT_MS` (default `8000`) if the Neon endpoint is unreachable.

Admin actions are recorded with the actor, target, merchant workspace and metadata. The overview and merchant directory fall back to bounded queries if migration 018 has not been applied yet, and the UI labels that state explicitly.

## Commands

```bash
npm run db:migrate     # apply db/migrations to DATABASE_URL
npm run dev            # standalone Node API
npm run dev:frontend   # React/Vite development server
npm run lint           # TypeScript verification
npm run test:mpesa     # M-Pesa callback tests
npm run build:frontend # production Vite build
npm start              # standalone Node API
```

## Health check

The API exposes:

```text
GET /health
GET /ready
GET /api/health
GET /api/ready
```

A healthy response identifies the service as `mobipay-api` and the runtime as the standalone Node HTTP server.

## API surface

The backend preserves the existing endpoint families:

- `/api/mpesa/*`
- `/api/payments/*`
- `/api/transactions/*`
- `/api/members/*`
- `/api/cases`
- `/api/settings`
- `/api/developer/*`
- `/api/sms/*`
- `/api/onboarding`
- `/api/dashboard/stats`
- `/api/v1/payments/*`
- `/api/admin/session`, `/api/admin/overview`, `/api/admin/merchants`, `/api/admin/transactions`, `/api/admin/exceptions`, `/api/admin/activations`, `/api/admin/audit`, `/api/admin/reconcile`

M-Pesa validation and confirmation callbacks continue to use the same public paths.

## Deployment

See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for standalone API hosting, static frontend hosting, environment variables, and reverse-proxy routing.

## Security

- Keep `DATABASE_URL` server-side only.
- Keep M-Pesa credentials server-side only.
- Keep webhook encryption keys server-side only.
- Keep licensed PSP and settlement credentials server-side only.
- Keep platform administrator credentials and session secrets server-side only.
- Use HTTPS for production API and callback endpoints.
- Set `FRONTEND_ORIGIN` explicitly in production.
- Keep database migrations versioned and apply them before deploying API changes.
- Historical RLS policies remain in the schema for compatibility, but the API connects as the table owner and enforces workspace scoping in server code.
- Rotate API keys and webhook secrets when required.

## License

MIT
