# MobiPay deployment

MobiPay is now split into two independent runtime processes:

- **Frontend:** React 19 + Vite, built with `npm --prefix frontend run build`.
- **API:** standalone Node.js HTTP server started with `npm start` on port `4000` by default.
- **Database/auth:** Supabase. No Supabase migrations are changed by the framework migration.

## Local development

Terminal 1:

```bash
npm install
npm run dev
```

Terminal 2:

```bash
npm --prefix frontend install
npm run dev:frontend
```

The Vite development server proxies `/api` to `http://localhost:4000`.

## Production API

Run the repository on a Node 22+ or Node 24 runtime:

```bash
npm install --omit=dev --no-audit --no-fund
npm start
```

Set these server variables at minimum:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- M-Pesa Daraja variables required by the selected integration
- `PORT` (optional, defaults to `4000`)
- `HOST` (optional, defaults to `0.0.0.0`)
- `PUBLIC_API_ORIGIN` for callback URL generation
- `FRONTEND_ORIGIN` for browser CORS

The API exposes a health check at `/health` and preserves the existing `/api/...` endpoints used by the merchant portal and M-Pesa callbacks.

## Production frontend

Build the static application:

```bash
npm --prefix frontend install --omit=dev --no-audit --no-fund
npm --prefix frontend run build
```

Deploy `frontend/dist` to any static hosting provider. For a separately hosted API, set:

```text
VITE_API_BASE_URL=https://api.example.com
```

If the frontend and API share an origin through a reverse proxy, leave `VITE_API_BASE_URL` empty and proxy `/api/*` to the Node service.

## Reverse proxy

A production reverse proxy should route:

- `/api/*` → Node API on port `4000`
- `/health` → Node API health endpoint
- all other paths → Vite static files with SPA fallback to `index.html`

Do not expose Supabase service-role credentials or M-Pesa secrets to the Vite build.
