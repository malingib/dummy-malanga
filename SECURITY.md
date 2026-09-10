# Security

## Credential rotation

Historical repository files contained production-style Safaricom and Supabase credentials. Those legacy files have been removed from `main`, but removing a secret from Git does not revoke it.

Before production use, rotate any credential that was ever committed, especially:

- Safaricom Daraja consumer key/secret
- Supabase service-role key
- M-Pesa passkey/initiator credentials
- SMS API token
- webhook encryption key
- cron/callback secrets
- admin credentials

Use the new values only through the deployment environment/secret manager. Never place server secrets in `frontend/.env*`, Vite source code, or committed files.

## API controls

The standalone API provides:

- explicit CORS origin allowlisting
- request body size limits
- request and header timeouts
- security response headers
- generic production error responses
- graceful shutdown on SIGTERM/SIGINT
- `/health` liveness and `/ready` readiness endpoints

Public MobiPay API v1 endpoints authenticate with scoped API keys. Internal webhook processing requires `CRON_SECRET`. Safaricom callback routes use their existing callback-specific validation and are intentionally not protected by browser/API-key authentication.

## Reporting

Do not commit credentials, customer data, callback payload dumps, runtime logs, or local environment files. Report suspected credential exposure immediately and rotate the affected credential before investigating historical usage.
