# Platform Administration

MobiPay has two deliberately separate operator surfaces.

| Surface | UI routes | API namespace | Authentication |
|---|---|---|---|
| Merchant console | `/`, `/payments`, `/customers`, `/reconciliation`, `/mpesa`, `/sms`, `/developers`, `/settings` | `/api/*` (merchant routes) | Merchant workspace cookie (`mobiwave_workspace_id`) and merchant API keys for `/api/v1/*` |
| Platform admin | `/admin`, `/admin/merchants`, `/admin/transactions`, `/admin/exceptions`, `/admin/activations`, `/admin/audit` | `/api/admin/*` | Signed platform admin session (`mobiwave_platform_admin`) |

The two session models are not interchangeable:

- Merchant routes ignore the platform admin cookie.
- Admin routes reject requests that only have the merchant workspace cookie.
- Admin routes never call the merchant convenience endpoints; they query Neon PostgreSQL directly behind `requirePlatformAdmin()`.
- The frontend keeps a separate `frontend/src/admin/api.ts` client and separate shell/navigation from `frontend/src/api.ts` and `frontend/src/App.tsx`.

## Configuration

Set these on the API server:

```text
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<long unique password>
PLATFORM_ADMIN_NAME=Platform administrator
PLATFORM_ADMIN_SESSION_SECRET=<optional long random secret>
```

`PLATFORM_ADMIN_SESSION_SECRET` is optional. When absent, the session HMAC is derived from `ADMIN_PASSWORD`; rotating either value invalidates existing sessions. Sessions expire after 8 hours.

Platform data routes also require `DATABASE_URL`. Without it the session endpoint stays available so the login screen can explain the configuration gap, while data endpoints return `503` with `database_configured: false`. Database calls time out after `DATABASE_REQUEST_TIMEOUT_MS` (default `8000`) so an unreachable Neon endpoint cannot leave the console loading forever.

## Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/admin/session` | Read session state and whether admin access is configured. |
| `POST` | `/api/admin/session` | Sign in with platform administrator credentials. |
| `DELETE` | `/api/admin/session` | Clear the admin session. |
| `GET` | `/api/admin/overview?days=14` | Network metrics, queues, readiness and recent activity. |
| `GET` | `/api/admin/merchants?q=&status=&environment=` | Merchant directory with volume, connection and exception aggregates. |
| `GET` | `/api/admin/merchants/:id` | Merchant profile, connections, activation history, payments, exceptions and audit entries. |
| `GET` | `/api/admin/transactions?q=&status=&reconciliation=&workspace_id=` | Cross-merchant transaction ledger. |
| `GET` | `/api/admin/exceptions?status=&severity=&workspace_id=` | Cross-merchant reconciliation exception queue. |
| `PATCH` | `/api/admin/exceptions` | Resolve, ignore or move an exception into review. |
| `GET` | `/api/admin/activations?status=&environment=` | M-Pesa activation/go-live queue. |
| `PATCH` | `/api/admin/activations` | Start review, request credentials, mark testing, approve, block, cancel or reopen. |
| `GET` | `/api/admin/audit` | Append-only platform admin audit trail. |
| `POST` | `/api/admin/reconcile` | Legacy full reconciliation action; now requires the platform admin session. |

## Database migration

`db/migrations/018_platform_admin.sql` adds:

- `platform_admin_audit_logs` — append-only admin action log.
- `platform_admin_workspace_summaries` — merchant summary view.
- `platform_admin_overview(integer)` — SQL aggregate for the network overview.

The overview and merchant directory have bounded JavaScript fallbacks so the console remains inspectable before the migration is applied. The UI labels degraded aggregates explicitly. Apply the migration before relying on platform-wide numbers in production.

## Security model

- The session cookie is HTTP-only, `SameSite=Strict`, `Secure` in production, and signed with HMAC-SHA256. Signature comparison is timing-safe.
- The cookie is a bearer session, not a workspace identity: admin routes never resolve `mobiwave_workspace_id`, and merchant routes never accept `mobiwave_platform_admin`.
- Admin traffic uses its own IP rate-limit bucket: sign-in defaults to 20 attempts/minute (`RATE_LIMIT_MAX_ADMIN_LOGIN`), and authenticated admin reads/writes default to 240 requests/minute (`RATE_LIMIT_MAX_ADMIN`). This keeps a read-heavy console from consuming the merchant API budget.
- Every activation decision, exception decision and session start/end is written to `platform_admin_audit_logs`. Audit writes are best-effort so an audit-table outage cannot make an operational action appear to fail.
- Rotating `ADMIN_PASSWORD` or `PLATFORM_ADMIN_SESSION_SECRET` invalidates existing admin sessions. Rotating `DATABASE_URL` credentials cuts off the API until the new values are deployed; rotate after any suspected exposure.

## Verification note

The migration chain now applies cleanly from `000_neon_bootstrap.sql` through `018_platform_admin.sql` against
PostgreSQL 16. The summary view and `platform_admin_overview(integer)` RPC were exercised with seeded merchant,
payment, exception and activation rows. Migration `014_mpesa_production_observability.sql` was corrected to use
`mpesa_callback_events.received_at`; the earlier replay failure is resolved.

## Operational boundaries

- Approval marks the activation request `live` and moves the merchant workspace to `live` status. It does not create or rotate Daraja credentials.
- Exception resolution records the decision and note; it does not change the underlying PSP settlement state.
- Every reviewed activation and exception writes an audit entry. If the audit table is unavailable, the operational action still completes and the server logs an audit warning; apply migration 018 to close that gap.
