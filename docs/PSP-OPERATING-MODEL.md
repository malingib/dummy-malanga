# MobiPay Licensed PSP Operating Model

## Purpose

MobiPay is designed to provide merchant-facing payment software while initially operating **under an appropriately licensed payment service provider (PSP) partner**. The software must not be presented as an independent PSP merely because it can technically connect to M-Pesa.

## Operating boundary

| Area | MobiPay | Licensed PSP / regulated partner |
|---|---|---|
| Merchant portal and payment UX | Owns | Oversight where required |
| API, dashboards and integrations | Owns | Technical/operational requirements |
| Payment orchestration | Operates within partner-approved scope | Approves/controls regulated scope |
| Customer funds / settlement | Must not independently hold regulated funds unless separately authorized | Owns regulated settlement responsibility |
| KYC/AML obligations | Collects/supports required merchant information | Regulatory responsibility as agreed |
| Safaricom/Daraja connectivity | Operates only within authorized arrangement | Provides/approves regulated access where applicable |
| Reconciliation tooling | Owns software and operational workflow | Settlement and regulated reconciliation responsibility |
| Disputes / chargebacks / complaints | First-line software workflow | Regulatory escalation and final responsibility where applicable |
| Transaction limits | Enforces configured limits | Defines/approves limits for regulated service |

The commercial agreement must explicitly allocate regulatory responsibility, settlement ownership, customer-funds handling, transaction limits, KYC/AML duties, reporting, incident response and audit rights.

## Production gate

Production payment initiation is disabled unless all of the following are configured server-side:

- `MOBIPAY_OPERATING_MODE=partner_psp`
- `PSP_LICENSE_STATUS=verified`
- `PSP_PROVIDER_ID` identifies the approved partner
- the partner agreement and technical onboarding are complete outside the application
- the selected M-Pesa environment is approved for the merchant use case

The application gate is a technical control. It does **not** itself establish legal or regulatory authorization.

## Supported payment capabilities

The platform can expose, subject to partner approval:

- M-Pesa STK Push
- C2B validation and confirmation
- merchant collections
- payment status APIs
- transaction reconciliation
- developer API keys
- signed webhooks and delivery tracking
- payment notifications

Additional rails should be enabled only after the relevant licensed partner confirms that they are within the approved operating model.

## Partner onboarding checklist

Before production enablement, obtain and record:

1. Licensed PSP legal entity and license/authorization reference.
2. Signed commercial and technical agreement.
3. Settlement account and settlement timing.
4. Customer-funds ownership and safeguarding model.
5. KYC/AML responsibilities and escalation process.
6. Approved transaction limits and risk rules.
7. Safaricom/Daraja integration authorization and callback requirements.
8. API credentials and credential-rotation procedure.
9. Incident-management and support contacts.
10. Reconciliation and settlement file/report format.
11. Dispute/refund process.
12. Data-protection and audit-retention requirements.
13. SLA, uptime and maintenance windows.
14. Offboarding and merchant migration procedure.

## Merchant contract language principle

MobiPay should describe itself as a **payment technology/orchestration platform operating with a licensed PSP partner**, unless and until MobiWave itself has the applicable authorization to provide the regulated service independently.

Avoid statements that imply MobiWave independently accepts, safeguards, settles or holds customer funds where the regulated responsibility actually belongs to the licensed partner.

## Technical separation

The application keeps regulated-partner configuration server-side. The browser must never receive PSP credentials, Daraja secrets, settlement credentials or privileged service-role credentials.

The API remains responsible for authentication, authorization, idempotency, callback processing, ledger persistence and audit-friendly operational records. The licensed PSP remains the regulated counterparty for the services assigned to it under the agreement.

## Current status

**Software:** ready for partner integration and sandbox validation.

**Regulatory position:** partner-dependent; production must remain blocked until the licensed PSP arrangement is verified.

**Safaricom production approval:** not claimed by this repository.
