# MobiPay Frontend and User Journey Review

Date: 2026-09-17

## Scope

Source-level review of the React/Vite application across the shell, overview, payments, payment details, customers, M-Pesa activation and connections, reconciliation, SMS, developer tools, settings, responsive rules, accessibility attributes, loading states and error paths.

The rendered-browser portion could not be completed because `agent-browser` is not installed in this environment. Findings below are verified from the frontend source and are not a claim of visual or WCAG conformance.

## Overall verdict

The application has a coherent operational shell, a sensible route structure, consistent loading/empty/status primitives, and good foundations for payment traceability. The next quality leap is workflow clarity and trust: every screen should describe the same payment boundary, expose the real connection state, and make recovery actions explicit.

## Highest-impact findings

### P0 — M-Pesa onboarding contradicts the intended managed-provider model

`MpesaConnectionsOperations` presents Consumer key, Consumer secret and Passkey fields, while the surrounding activation experience says MobiWave handles the managed workflow. This makes the primary onboarding promise unclear and blocks the “merchant does not provide Daraja credentials” journey.

Evidence: `frontend/src/MpesaConnectionsOperations.tsx:17` and `frontend/src/MpesaActivationJourney.tsx:42-45`.

Recommendation: make the connection method explicit. The default path should be “Connect through MobiPay partner” with KYC/shortcode authorization and a review state. Keep “Bring your Daraja credentials” as an advanced/fallback path only when the backend is configured for it. Do not expose a managed option until its backend executor is actually wired; the current API rejects or cannot verify a managed connection without credentials.

### P0 — Environment selector can create false confidence

The global Sandbox/Production selector is stored only in the Zustand UI store. It is not persisted, loaded from the active M-Pesa connection, or passed into payment requests. The production banner therefore changes the interface language without proving that the backend is using the selected environment.

Evidence: `frontend/src/store.ts:10-15`, `frontend/src/App.tsx:79-90`, `frontend/src/api.ts:36-47`.

Recommendation: derive environment from the active connection or workspace, make it read-only unless switching is a deliberate backend operation, and show the selected shortcode/provider boundary beside every money-moving action.

### P1 — Overview health is hardcoded

The dashboard always reports M-Pesa, callbacks, SMS and webhook health as Connected/Healthy/Ready regardless of API state. This is dangerous in a payment product because the most prominent operational signal can be wrong.

Evidence: `frontend/src/MerchantOperations.tsx:21`.

Recommendation: use the existing readiness, connection and delivery queries; show Unknown/Needs attention when data is unavailable. Link each failed health item to its repair surface.

### P1 — Payment lifecycle summary is incomplete

The new overview lifecycle computes Processing as total minus successful minus failed, but reversed and unmatched states are not represented. Activity also uses the currently fetched rows rather than a server-side period aggregate.

Evidence: `frontend/src/MerchantOperations.tsx:11` and `frontend/src/MerchantOperations.tsx:22`.

Recommendation: expose server-side counts for pending, completed, failed, reversed and unreconciled payments, with a clear time range and last-updated timestamp.

### P1 — Payment initiation needs a safer operator flow

The STK modal accepts free-form phone input, does not show the selected receiving connection, has no explicit duplicate-submit protection in the UI, and leaves the user with a generic “sent” message rather than a link to the created payment and its pending state.

Evidence: `frontend/src/MerchantOperations.tsx:23`.

Recommendation: normalize and preview the phone, show amount/shortcode/description before submission, require an idempotency key generated per intentional attempt, then route to payment detail with “Waiting for customer” and a retry-safe recovery path.

### P1 — Pending payment detail can report a misleading result

The detail view polls STK status independently while the ledger status remains pending. A provider query failure or temporary result can be interpreted as a failure message even though the payment record is still pending.

Evidence: `frontend/src/PaymentDetailOperations.tsx:11-21`.

Recommendation: distinguish `provider_status`, `ledger_status` and `reconciliation_status`; never display a terminal failure until the payment record itself is terminal. Add “last checked” and a manual refresh action.

### P1 — Reconciliation is discoverable but not yet operationally complete

Runs are always rendered with a successful status, there is no run detail, no progress or last-run summary, and no settlement-file workflow. Exception review has useful actions but no visible transaction drill-down.

Evidence: `frontend/src/FinalizationOperations.tsx:133-170`, `:174-240`.

Recommendation: add run states, timestamps, matched/unmatched totals, settlement period, exception links and a clear “what changed” result after a run.

## Route-by-route journey review

1. **App shell and navigation — Good foundation**

   Clear grouping into Workspace, Operations and Platform; responsive sidebar exists; breadcrumb and environment context are useful. Improve brand consistency (`MobiWave` vs `MobiPay`), add a real notification destination, add a 404 route, and preserve visible environment context on mobile.

2. **Overview — Needs operational truth**

   Summary cards, activity, health and recent payments form a good hierarchy. Hardcoded health, incomplete lifecycle counts, no date-range control and no last-updated state reduce trust. The “Needs attention” card should link directly to failed/unmatched work.

3. **Payments — Good basic task path, weak recovery**

   Search, status filtering, recent activity and payment detail are present. The list is capped at 100 with no pagination/export/date range. Row navigation is mouse-oriented and needs keyboard support. The request modal needs connection context, validation, duplicate protection and a post-submit route.

4. **Payment detail — Strongest journey conceptually**

   Timeline, provider status polling, receipt and notification history are the right mental model. Separate provider/ledger states, show stale/polling state, and ensure SMS delivery is not shown as complete merely because the payment completed.

5. **Customers — Useful derived view, limited confidence**

   Automatic customer grouping is low-friction. Totals currently aggregate payment rows without clearly excluding failed/reversed records; there is no customer detail, date range, pagination or export. Label this as payment-derived activity until a customer model exists.

6. **M-Pesa activation — Good staged structure, conflicting surfaces**

   The activation journey has understandable stages and actionable next steps. The separate legacy `MpesaOperations` implementation in `FinalizationOperations.tsx:278-382` creates drift even though the active route uses `MpesaActivationJourney`. Consolidate to one flow. Prevent production test actions from appearing when the backend cannot support them.

7. **M-Pesa connections — Highest-friction onboarding**

   Multi-shortcode tables and status fields are valuable. “Configure” is ambiguous, credential fields are not conditionally explained, save can create a draft that predictably fails at verify, and there is no clear connection authorization or provider selection. Make setup method, shortcode ownership, environment and next action explicit.

8. **Reconciliation — Good exception vocabulary, incomplete finance workflow**

   Runs/exceptions tabs, filtering, notes and resolution actions are a solid base. Add real statuses, transaction context, evidence, audit history, bulk triage and settlement-period controls.

9. **SMS — Clear start, missing lifecycle controls**

   Delivery and template tabs are easy to understand, and placeholders are documented. Templates have no edit, activate, delete, preview, character counter or variable validation. Delivery has no retry action or filtering. Add a phone preview and explain provider status separately from delivery status.

10. **Developer tools — Capable but risky**

    API keys, webhooks, delivery history and a playground are appropriately grouped. Fixed scopes, no copy action for one-time secrets, no revoke/disable confirmation, limited webhook events, and a live STK Push button in the playground need attention. Add scope selection, explicit destructive confirmations, copy feedback, request/response metadata, idempotency display and a production safety gate.

11. **Settings — Functional, not yet self-explanatory**

    Business profile, notifications and workspace status are sensible. Toggles lack `aria-pressed` and supporting descriptions; webhook URL remains visible when webhooks are disabled; there is no unsaved-change warning or saved confirmation. Add dirty-state detection, save feedback and a read-only explanation for regulated fields.

## Cross-system accessibility and interaction findings

- Modal dialogs have `role="dialog"`, but no focus trap, Escape handling, focus restoration or explicit `aria-labelledby`.
- Clickable payment rows are not keyboard-focusable and have no Enter/Space behavior.
- Tab groups use visual active state but generally lack `aria-selected` and tab/panel relationships.
- Toggle buttons do not expose pressed state.
- Statuses include text, which is good; continue not relying on color alone.
- Loading, error and empty states are present in many routes, but query errors are not consistently rendered in Developer tools.
- Tables are horizontally scrollable on small screens, but there is no mobile alternative for high-value row actions.
- The mobile header hides the environment selector, which removes safety context at the smallest viewport.

## Recommended delivery order

1. Resolve M-Pesa operating model in the UI and backend: partner-managed versus merchant credentials.
2. Make environment, shortcode and provider connection authoritative and visible.
3. Replace hardcoded health with live states and repair links.
4. Harden STK initiation and payment detail around idempotency, pending states and recovery.
5. Consolidate duplicate M-Pesa activation implementations.
6. Complete reconciliation run/exception workflows.
7. Add modal, keyboard, tab and toggle accessibility behavior.
8. Improve developer safety and SMS template lifecycle.
9. Add pagination, date ranges, exports and mobile table alternatives.

## Verification status

- TypeScript check: passed (`npm run lint`)
- Frontend production build: passed (`npm run build:frontend`)
- M-Pesa callback tests: passed (`npm run test:mpesa`)
- Rendered screenshot audit: blocked; `agent-browser` is unavailable in the environment
