# MobiWave Payments Reconciliation MVP

## Objective

Ship a reconciliation-first MVP for Kenyan businesses without taking custody of customer funds. The initial release uses the merchant's existing M-Pesa Paybill/Till and approved provider relationship. MobiWave provides transaction ingestion, matching, exceptions, auditability, receipts and reporting. This technical design does not determine the legal classification of the service; confirm the operating model with Kenyan counsel and the relevant licensed PSP before live data or payments.

## MVP workflow

1. **Ingest** C2B confirmation callbacks through the configured Daraja callback endpoint. Persist the callback event and its idempotency key before treating the event as processed. Support statement import as a separate source.
2. **Validate** required identifiers, amount, shortcode and payload bounds. Resolve the shortcode to an active connection and reject conflicting transaction routing. A browser redirect is never proof of payment.
3. **Deduplicate** using a database-enforced unique provider transaction reference scoped to the correct provider/connection. Replayed callbacks must not create a second ledger entry or receipt.
4. **Match** by account reference/invoice/member identifier and expected amount. Record the match rule and result. Ambiguous and unmatched items go to the exception queue.
5. **Record** normalized payment facts and an append-only event/audit trail. Pending, success, failed, reversed, unmatched and unknown outcomes must remain distinct. Do not silently rewrite the event history.
6. **Reconcile** a bounded date range against provider statements or supported provider status/reconciliation APIs. For C2B, do not assume every callback can be independently status-queried; statement comparison is the fallback and settlement truth must be sourced from the provider.
7. **Resolve exceptions** with an authorized operator, reason/note, timestamp and actor. Do not physically delete reconciliation exceptions; mark them ignored/resolved with an audit trail.
8. **Notify** only after a verified successful payment state, with idempotent notification jobs and delivery status. SMS/WhatsApp delivery failure must not roll back a payment.
9. **Report** daily totals, unmatched items, duplicates, amount mismatches, reversals, unresolved exceptions and branch-level summaries with CSV export.

## Tenant security requirements

- Treat `mobiwave_workspace_id` as an untrusted locator, not an authorization credential.
- Require a valid Supabase access token and verify that the authenticated user is authorized for the workspace on every workspace-scoped API request.
- Never rely on client-provided workspace IDs alone when using the service-role database client.
- Keep service-role keys and Daraja secrets server-side.
- Scope transaction lookups and updates by both record ID and authorized workspace.
- Keep callback endpoints separate from merchant-authenticated endpoints; callbacks must use provider-appropriate validation, idempotency and routing controls.
- Keep raw callback payload access restricted, redact sensitive values from logs and define a retention policy.
- Preserve exception history. Manual resolutions must include a note and actor; high-risk adjustments should require a second approver.
- Rate-limit authenticated endpoints and protect cookie-authenticated state-changing requests against CSRF if cookie sessions are supported.

## Acceptance criteria

- [ ] Unauthenticated request with a forged workspace cookie is denied.
- [ ] Authenticated user cannot read or modify another owner's workspace.
- [ ] Duplicate callback delivery creates no duplicate transaction, ledger event or receipt.
- [ ] Unknown shortcode and transaction-routing conflict are rejected and recorded for operations review.
- [ ] A callback with missing/invalid identifiers or non-positive/non-finite amount is rejected.
- [ ] An unmatched payment creates an exception with a useful reason.
- [ ] An amount mismatch is never auto-resolved.
- [ ] Reconciliation rejects invalid periods and limits individual runs to 31 days.
- [ ] Statement import is idempotent and records the source file/import run.
- [ ] Exception resolution records who resolved it, when and why.
- [ ] Resolved/ignored exceptions cannot be physically deleted through the API.
- [ ] Receipt delivery is queued only after a verified successful state and can retry independently.
- [ ] Cross-tenant access, replay, duplicate and delayed-callback tests pass before pilot.
- [ ] Production pilot remains blocked until the PSP operating agreement, data-protection review and provider onboarding are confirmed.

## Current implementation note

This branch hardens workspace authorization used by cookie-based route handlers, requires authentication for workspace creation, and tightens reconciliation/exception endpoints. The branch still needs a full CI run and database-backed integration tests before merge. This document is an acceptance contract, not evidence that every checkbox has passed.
