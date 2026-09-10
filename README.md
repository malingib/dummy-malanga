# MobiPay

MobiPay is a merchant payment operations platform for M-Pesa collections, STK Push, reconciliation, developer APIs, webhooks, SMS notifications, and merchant configuration.

The application is now fully independent of Next.js:

- **Frontend:** React 19 + Vite + React Router + TanStack Query + Zustand
- **API:** standalone Node.js HTTP server
- **Database/auth:** Supabase PostgreSQL and Supabase Auth
- **Payments:** Safaricom Daraja integration through the existing M-Pesa service layer

Supabase migrations are intentionally unchanged by this framework migration.

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
   └── SMS operations
          │
          ├── Supabase
          └── Safaricom Daraja
```

The existing API contracts remain under `/api/*`, so the merchant frontend and external M-Pesa callback URLs do not need to change merely because the web framework changed.

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

Configure Supabase, Daraja, webhook encryption, SMS, and application variables there. Server secrets must never be placed in the Vite frontend environment.

For a separately hosted frontend, set `VITE_API_BASE_URL` to the public API origin. When frontend and API share an origin behind a reverse proxy, leave it empty and route `/api/*` to Node.

## Commands

```bash
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
GET /api/health
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

M-Pesa validation and confirmation callbacks continue to use the same public paths.

## Deployment

See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for standalone API hosting, static frontend hosting, environment variables, and reverse-proxy routing.

## Security

- Keep `SUPABASE_SERVICE_ROLE_KEY` server-side only.
- Keep M-Pesa credentials server-side only.
- Keep webhook encryption keys server-side only.
- Use HTTPS for production API and callback endpoints.
- Set `FRONTEND_ORIGIN` explicitly in production.
- Keep Supabase RLS enabled for data protection.
- Rotate API keys and webhook secrets when required.

## License

MIT
