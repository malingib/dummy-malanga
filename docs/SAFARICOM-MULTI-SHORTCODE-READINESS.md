# MobiWave M-Pesa Multi-Shortcode Readiness

## Purpose

MobiWave provides a tenant-isolated payment integration layer for merchants using independent Safaricom M-Pesa PayBills and Tills. Each merchant connection is represented as a first-class connection and routed by shortcode before payment processing.

## Technical model

```text
Safaricom callback
      |
      v
MobiWave callback endpoint
      |
      +--> normalize + validate payload
      |
      +--> resolve shortcode + environment
      |
      +--> verify active connection
      |
      +--> idempotency check
      |
      +--> record callback event
      |
      +--> process payment
      |
      +--> persist payment ledger
      |
      +--> attach connection/workspace routing
      |
      +--> mark callback processed
      v
Merchant workspace
```

## Isolation controls

- Every M-Pesa connection belongs to one workspace.
- A callback is resolved by shortcode and runtime environment.
- Multiple active connections for the same shortcode/environment are rejected.
- Payment transactions carry workspace, connection, shortcode and account-type routing metadata.
- Cross-tenant transaction routing conflicts are rejected.
- Callback events use connection-scoped idempotency keys.
- Credentials are encrypted server-side and never returned to the browser.
- MobiWave-managed credentials remain disabled unless explicitly enabled by deployment configuration.

## Callback controls

- Payload-size limit.
- Required shortcode validation.
- Required transaction identifier validation.
- Positive numeric amount validation.
- Unknown/inactive shortcode rejection.
- Duplicate callback handling.
- Callback event persistence before processing.
- Failed processing is retained with an error state.
- Callback health is exposed per connection and per workspace.

## Merchant onboarding

1. Merchant provides business details.
2. Merchant adds an M-Pesa connection.
3. MobiWave verifies the connection.
4. MobiWave registers/configures callbacks where authorized.
5. Merchant performs a test payment in the appropriate environment.
6. Connection becomes ready.
7. Merchant can add additional PayBills/Tills without changing the core payment architecture.

## Credential modes

### Merchant credentials

Default and supported mode. The merchant's authorized Safaricom/Daraja credentials are stored encrypted by MobiWave and used only for the merchant's connection.

### MobiWave-managed credentials

The software supports this architecture behind a deployment feature flag, but it must remain disabled until Safaricom formally confirms that MobiWave may use an authorized integration credential model across independent merchant shortcodes.

## Production approval questions for Safaricom

MobiWave should obtain written confirmation on:

1. Whether one MobiWave integration application/credential set may be authorized to interact with multiple independent merchant PayBills/Tills.
2. Required merchant KYC and authorization evidence.
3. Whether callback registration may be performed centrally by MobiWave for participating merchants.
4. Required contractual/integrator/partner arrangement.
5. Production credential ownership and rotation requirements.
6. Required security controls, audit retention and incident reporting.
7. Supported C2B callback registration version and production endpoint requirements.
8. Any restrictions on STK Push versus C2B when operating as a managed integration platform.
9. Required callback availability/SLA and IP/network controls.
10. Approved process for onboarding and offboarding merchant shortcodes.

## Current MobiWave readiness

Implemented in the application:

- Multi-connection data model.
- Connection API and dashboard.
- Encrypted credential storage.
- Environment-aware shortcode resolution.
- C2B validation endpoint.
- C2B confirmation endpoint.
- Idempotency and duplicate handling.
- Payment ledger routing.
- Reconciliation exception lifecycle.
- Callback health metrics.
- Activation journey.
- Audit-friendly callback event records.
- Automated callback rule tests and CI verification.

Not claimed as complete:

- Safaricom production approval.
- Production credentials.
- Production callback registration for real merchant accounts.
- Safaricom authorization for MobiWave-managed multi-merchant credentials.

## Operational target

The production system should treat every shortcode as an independently auditable payment connection while presenting merchants with one MobiWave operational interface. Technical failures should become actionable merchant states such as `connection required`, `verification failed`, `callback setup`, `payment test`, `ready`, or `attention required` rather than exposing Daraja implementation details unnecessarily.
