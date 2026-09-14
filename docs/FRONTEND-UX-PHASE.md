# MobiPay Frontend & UX — Phase 6

## Objective

Turn the existing React/Vite merchant application into a production-grade payments operations console. The frontend should make payment state, operational health, reconciliation and merchant configuration understandable without exposing unnecessary implementation detail.

## UX principles

- Payments first: money movement and payment state are the primary visual hierarchy.
- Operational clarity: pending, failed, reversed and reconciliation exceptions must be immediately distinguishable.
- Restrained visual system: neutral surfaces, strong typography, limited accent colour and no decorative gradients.
- Progressive disclosure: common actions stay simple; technical detail is available on detail pages and developer tools.
- Responsive operations: transaction search, payment detail and critical actions remain usable on small screens.
- Safe production actions: production environment state is visible and payment actions must respect the backend PSP boundary.
- Accessible controls: keyboard focus, semantic labels, readable status text and reduced-motion support are required.

## Delivery slices

### Phase 6.1 — Application shell

- Navigation hierarchy and SVG icon system.
- Responsive sidebar and mobile navigation.
- Environment selector and visible production context.
- Notification/account affordances.
- Consistent page hierarchy and spacing.

### Phase 6.2 — Dashboard

- Collection, payment volume, success-rate and attention metrics.
- Payment activity visualization.
- System/payment health.
- Recent payment operations.
- Loading, empty and error states.

### Phase 6.3 — Payment operations

- Search and filters.
- Transaction detail and payment lifecycle timeline.
- STK Push request workflow.
- Receipt/reference visibility.
- Operational status and failure handling.

### Phase 6.4 — Reconciliation

- Matched/unmatched/exception states.
- Reconciliation runs.
- Exception investigation workflow.
- Clear operational ownership and next actions.

### Phase 6.5 — M-Pesa operations

- Connection readiness.
- Sandbox/production distinction.
- Activation/configuration journey.
- Callback and payment health.

### Phase 6.6 — Developer and merchant administration

- API keys and scopes.
- Webhooks and delivery status.
- API activity.
- Merchant profile, users, notifications and security.

## Current implementation

Phase 6.1 is implemented on `main`. The application shell now uses a consistent SVG icon system, clearer navigation grouping, a production environment indicator, notification affordance and refined responsive visual hierarchy.

The existing payment/data components remain intact while the shell is improved incrementally. This avoids a high-risk rewrite of working payment workflows.

## Verification gate

Each frontend slice must pass:

```bash
npm --prefix frontend install
npm --prefix frontend run build
```

The repository CI remains the final merge gate. UI changes must not weaken the backend PSP boundary, tenant isolation, payment idempotency or secret-handling controls.
