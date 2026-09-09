# Mobiwave Developer API

## Authentication

Use an API key in the `Authorization` header:

```text
Authorization: Bearer mw_live_...
```

Keys are tenant-scoped. The raw key is returned only once when created or rotated. Store it in a server-side secret manager and never expose it in browser code.

## API key management

Dashboard-authenticated endpoints:

- `GET /api/developer/keys` — list keys (metadata only)
- `POST /api/developer/keys` — create a key
- `POST /api/developer/keys/:id` — rotate a key
- `DELETE /api/developer/keys/:id` — revoke a key

Supported scopes: `payments:read`, `payments:write`, `webhooks:manage`.

## STK Push

`POST /api/v1/payments/stk`

Required header:

```text
Idempotency-Key: unique-request-id
```

Example body:

```json
{
  "phone": "254712345678",
  "amount": 100,
  "reference": "ORDER123",
  "description": "Order payment"
}
```

The same idempotency key may be retried safely with the same request. Reusing it with different request data returns `409`.

## Payment lookup

`GET /api/v1/payments/:id`

Requires `payments:read`.

## Webhooks

Dashboard-authenticated endpoints:

- `GET /api/developer/webhooks`
- `POST /api/developer/webhooks`
- `PATCH /api/developer/webhooks/:id`
- `DELETE /api/developer/webhooks/:id`

Webhook secrets are encrypted at rest using `WEBHOOK_ENCRYPTION_KEY` and returned only once.

Delivery headers:

- `X-Mobiwave-Event`
- `X-Mobiwave-Event-Id`
- `X-Mobiwave-Timestamp`
- `X-Mobiwave-Signature: v1=<hmac-sha256(timestamp.body)>`

Failed deliveries use exponential backoff and are marked failed after eight attempts. A scheduled call to `POST /api/internal/webhooks/process` drains the retry queue; protect it with `CRON_SECRET`.

## Production checklist

Before switching a workspace to live Daraja traffic:

1. Apply migrations `001` through `006` in order.
2. Configure server-side Daraja production credentials and passkey.
3. Configure a public HTTPS callback URL and register it with Safaricom/Daraja.
4. Configure a strong random `WEBHOOK_ENCRYPTION_KEY` and `CRON_SECRET`.
5. Run `POST /api/mpesa/admin` to verify credentials.
6. Execute a sandbox E2E payment before production cutover.
7. Confirm reconciliation and webhook delivery monitoring.
8. Rotate any credentials used during testing before go-live.
