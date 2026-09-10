# MobiPay Project Structure

MobiPay is a standalone Node.js + React/Vite application. There is no Next.js application runtime.

```text
mobiPay/
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── src/
│       ├── App.tsx
│       ├── main.tsx
│       ├── api.ts
│       ├── store.ts
│       ├── styles.css
│       ├── reference.css
│       └── *.tsx                 # Merchant and operations screens
├── server/
│   ├── index.ts                  # Standalone Node HTTP server
│   ├── http.ts                   # Request/response compatibility layer
│   └── routes/                   # API route modules
│       ├── admin/
│       ├── cases/
│       ├── dashboard/
│       ├── developer/
│       ├── internal/
│       ├── members/
│       ├── mpesa/
│       ├── onboarding/
│       ├── payments/
│       ├── settings/
│       ├── sms/
│       ├── transactions/
│       └── v1/
├── lib/
│   ├── api-auth.ts
│   ├── db.ts
│   ├── mpesa.ts
│   ├── mpesa-connection-service.ts
│   ├── mpesa-connection-resolver.ts
│   ├── mpesa-credentials.ts
│   ├── mobiwave-sms.ts
│   ├── supabase.ts
│   ├── types.ts
│   ├── utils.ts
│   ├── validation.ts
│   └── webhooks.ts
├── supabase/
│   └── migrations/               # Existing database migrations
├── scripts/
├── tests/
├── .github/workflows/ci.yml
├── package.json
└── tsconfig.json
```

## Runtime flow

```text
Browser
  │
  ▼
React/Vite :5173
  │ /api/*
  ▼
Node HTTP API :4000
  │
  ├── server/routes/*
  ├── lib/*
  ├── Supabase
  └── Safaricom Daraja
```

## Frontend

The frontend uses React 19, Vite, React Router, TanStack Query and Zustand. API calls are centralized in `frontend/src/api.ts`; UI state is kept in `frontend/src/store.ts`.

## Backend

`server/index.ts` owns HTTP lifecycle, CORS, route matching, request parsing and response writing. Route modules under `server/routes` contain the business endpoints while shared integrations remain in `lib/`.

The public API contract remains under `/api/*`, including M-Pesa callbacks, STK Push, transactions, reconciliation, developer APIs, webhooks, SMS and onboarding.

## Database

Supabase migrations remain under `supabase/migrations`. The framework migration does not modify the existing database schema.

## Verification

```bash
npm run lint
npm run test:mpesa
npm run build
```

`npm run build` builds the React/Vite frontend. The standalone API is typechecked by `npm run lint` and started with `npm run dev` or `npm start`.
