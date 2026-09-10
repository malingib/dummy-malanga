# MobiPay deployment

MobiPay runs as two independent runtime surfaces:

- **Frontend:** React 19 + Vite, producing a static `frontend/dist` build.
- **API:** standalone Node.js HTTP server started with `npm start` on port `4000` by default.
- **Database/auth:** Supabase PostgreSQL + Supabase Auth.

The repository no longer depends on the Next.js runtime. The small `server/http.ts` compatibility layer exists only to keep migrated route handlers stable while the API runs on Node's native HTTP server.

## Recommended production topology

```text
Browser
  |
  | HTTPS
  v
Static frontend host / reverse proxy
  |                         \
  | /                       | /api/* and /health
  v                         v
Vite dist              Node.js API :4000
                              |
                 +------------+------------+
                 |                         |
              Supabase                 Safaricom
              Auth/DB                   Daraja
```

The frontend may be deployed to Vercel, Cloudflare Pages, Netlify, or another static host. The API must run on a Node-compatible service such as Railway, Render, Fly.io, a VM, or behind an existing reverse proxy. Do not deploy the standalone API as an old Next.js application.

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

Use Node 22+ (Node 24 is used by CI):

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
- `MAX_BODY_BYTES` (optional, defaults to 1 MiB)
- `REQUEST_TIMEOUT_MS` (optional, defaults to 30 seconds)
- `HEADER_TIMEOUT_MS` (optional, defaults to 10 seconds)

The API exposes:

- `/health` — process/liveness check; returns 200 when the HTTP service is alive.
- `/ready` — readiness check; returns 200 only when the required Supabase server credentials are present.
- `/api/...` — application API routes.

M-Pesa callback paths remain unchanged. Configure Safaricom with the exact public callback URL expected by the existing integration.

## Frontend

Build the static application:

```bash
npm --prefix frontend install --omit=dev --no-audit --no-fund
npm --prefix frontend run build
```

Deploy `frontend/dist` to the static host. For a separately hosted API, set:

```text
VITE_API_BASE_URL=https://api.example.com
```

If frontend and API share an origin through a reverse proxy, leave `VITE_API_BASE_URL` empty and proxy `/api/*` to the Node service.

## Reverse proxy

A production reverse proxy should route:

- `/api/*` → Node API on port `4000`
- `/health` and `/ready` → Node API
- all other paths → Vite static files with SPA fallback to `index.html`

Terminate TLS at the reverse proxy/load balancer. The Node process should normally remain on a private network interface when a reverse proxy is available.

## Security requirements

- Never expose `SUPABASE_SERVICE_ROLE_KEY`, M-Pesa secrets, SMS API tokens, webhook encryption keys, or admin credentials to Vite.
- Set `FRONTEND_ORIGIN` or `CORS_ORIGIN` to an explicit comma-separated allowlist. The API no longer reflects arbitrary browser origins.
- Keep production `PUBLIC_API_PROTOCOL=https` when the public API URL is HTTPS.
- Keep callback endpoints reachable from Safaricom without browser authentication requirements; callback-specific validation remains inside their route handlers.
- The Node server applies a 1 MiB default request-body cap, HTTP request/header timeouts, security headers, method validation, generic production error responses, and graceful SIGTERM/SIGINT shutdown.
- Put rate limiting/WAF protection at the reverse proxy or API gateway if the deployment exposes the API directly to the internet.

## Deployment verification

After deployment:

```bash
curl -fsS https://api.example.com/health
curl -fsS https://api.example.com/ready
```

Expected results are HTTP 200 for both when the API is configured correctly. Then verify one authenticated application API request and the configured M-Pesa callback endpoints in the Safaricom environment.
