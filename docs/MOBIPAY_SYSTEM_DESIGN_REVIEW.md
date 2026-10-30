# MobiPay System Design Review — Competitive & Architecture Gap Analysis

Source: `liquidslr/system-design-notes` @ `~/.opensrc/repos/github.com/liquidslr/system-design-notes/main`
MobiPay baseline: `README.md:1`, `docs/PSP-OPERATING-MODEL.md:1`, `PRODUCTION_READINESS.md:1`, `lib/regulatory.ts:1`, `server/routes/v1/payments/stk/route.ts:1`

## 1. MobiPay Current Architecture (Verified)

- **Runtime:** React 19+Vite (5173) proxy `/api` → standalone Node API :4000 (`README.md:7`, `PRODUCTION_READINESS.md:7`). Neon PostgreSQL (direct `pg` connection), signed workspace/product sessions, Daraja `lib/mpesa.ts:15`.
- **Surfaces:** `/api/mpesa/*`, `/api/payments/*`, `/api/transactions/*`, `/api/developer/*`, `/api/sms/*`, `/api/v1/payments/*` (`README.md:122`).
- **Operating model:** `partner_psp` gate `lib/regulatory.ts:8` — prod blocked unless `MOBIPAY_OPERATING_MODE=partner_psp && PSP_LICENSE_STATUS=verified && PSP_PROVIDER_ID` (`docs/PSP-OPERATING-MODEL.md:24`). Tech control, not legal auth.
- **Present strengths:** `Idempotency-Key` header validation + `payment_idempotency_keys` table with `request_hash` check `server/routes/v1/payments/stk/route.ts:11-26`, callback dedup via `payment_webhook_events.idempotency_key` `server/routes/mpesa/stk/callback/route.ts:14-16`, HMAC-signed webhooks `lib/webhooks.ts:14` with exponential backoff `30*2^(attempt-1)` max 3600s capped at 8 attempts `lib/webhooks.ts:16`, C2B validation/confirmation split, `payment_transactions` ledger.

## 2. System-Design Notes — MobiPay-Relevant Chapters Distilled

### Chapter 26: Payment System `26. Payment System/README.md:1` (331 lines) — **CORE**
Functional: pay-in (buyer→merchant via PSP) + pay-out (merchant→sellers via Tipalti-like). Non-functional: reliability, reconciliation. Estimation: 1M/day ≈ 10 TPS (low DB focus).

Design to adopt:
- **Tables:** `payment_events(checkout_id PK, is_payment_done)` + `payment_orders(payment_order_id PK, checkout_id FK, amount string, status NOT_STARTED|EXECUTING|SUCCESS|FAILED, ledger_updated, wallet_updated)`. Use `string` for amount, `payment_order_id` as PSP idempotency key.
- **Flow:** `Payment service → risk check → Payment executor → PSP → Card schemes → Ledger + Wallet`. Store PSP token first, then hosted page.
- **Hosted page workflow** `hosted-payment-page-workflow.png`: token registration → redirect `?tokenID=&payResult=` → async webhook. Avoids PCI storage.
- **Reconciliation:** Nightly PSP settlement file vs internal `ledger`+`wallet` (`settlement-report.png`). Classify mismatches: auto-adjustable / manual / investigate. Your `server/routes/admin/reconcile/route.ts:10-35` currently only auto-reconciles `failedTransactions` with `bill_ref_number && msisdn && amount>0` and has double-count bug `matched++` twice — needs full settlement-file ingestion.
- **Async:** Single-receiver (queue once) vs multiple-receiver (fanout to ledger/wallet/notifications) — use latter for payment side-effects.
- **Failed payments:** `failed-payments.png` retry queue (retriable) → dead-letter queue (terminal) for debugging.
- **Exactly-once:** at-least-once via retry (`retry-mechanism.png`: immediate/fixed/incremental/exponential + `Retry-After` header) + at-most-once via idempotency-key (UUID → unique DB constraint, `idempotency-example.png`). PSP nonce prevents double-charge.
- **Consistency:** Reconciliation + exactly-once; avoid replica lag: primary reads or Raft/Paxos (CockroachDB/YugabyteDB).
- **Security:** HTTPS, encryption+integrity, cert pinning, multi-region replication, rate limit+firewall, tokenization, PCI, AVS/CVV/behavioral.

### Chapter 27: Digital Wallet `27. Digital Wallet/README.md:10` (421 lines)
Target 1M TPS (2M legs) → single PG ~1k TPS needs 2000 nodes, optimize per-node.

Evolution: Redis `map<user_id,balance>` sharded `hashCode%N` + Zookeeper config → 2PC (coordinator SPOF, lock contention) → **TC/C** (reserve Try, then Confirm/Cancel compensating txs — parallelizable) vs **Saga** (linear, orchestration preferred, compensating rollbacks).

Then **Event sourcing**: command FIFO (Kafka) → deterministic state machine → events FIFO → state (balance). Non-deterministic commands → deterministic events. Benefits: reproducibility, replay from 0, audit.

Performance: local disk append + `mmap` + in-memory cache, RocksDB LSM (write-optimized) or SQLite, periodic HDFS snapshots.

Reliability: only event log needs durability → Raft leader/followers (>50% quorum). Distributed: sharded Raft groups + TC/C or Saga orchestrator + phase_status table (`id, try_status, second_phase, status, out-of-order flag`), CQRS read replicas + reverse proxy polling → push.

### Chapter 04: Rate Limiter `04. Rate Limiter/Readme.md:7` (132 lines)
Algorithms: Token Bucket (burst, refill rate), Leaking Bucket (stable FIFO), Fixed Window (edge spike `fixed-window-issue.png`), Sliding Window Log (accurate, memory heavy), Sliding Window Counter (hybrid). Redis + Lua/sorted sets for distributed race, gateway placement `architecture.png`, multi-DC eventual consistency.

**Action for MobiPay:** `PRODUCTION_READINESS.md:32` says WAF/rate limiter external — implement token bucket at Node middleware or reverse proxy, per-workspace + per-IP, return `429 + Retry-After`.

### Chapter 10: Notification System `10. Notification System/Readme.md:5` (142 lines)
Scale: 10M push, 1M SMS, 5M email/day. Flow: trigger services → notification server (validation + metadata fetch) → message queue → workers → APNS/FCM/Twilio. Add: templates, settings opt-out, rate limit, dedup by event ID, DB persistence + retry, event tracking (open/click). Dequeue horizontally.

**Action:** Your `payment_notification_events` + `payment_sms_templates` + `queueWebhook()` already aligns; add `notification_settings` opt-out and per-user rate limit.

### Chapter 19: Distributed Message Queue `19. Distributed Message Queue/README.md:8` (588 lines)
Topics/partitions/brokers, offsets, consumer groups (one offset per group, one consumer per partition for ordering), WAL segments (seq HDD appends, split segments), immutable message structure, batching. High-level: producers/consumers + brokers + data/state/metadata storage + coordination (Zookeeper). Used for log aggregation + traditional queue.

**Action:** Replace direct `await` webhook calls with queue-backed `payment_webhook_deliveries` executor — your current `lib/webhooks.ts:9` is sync DB poll; need broker-style partition by `workspace_id`.

### Supporting chapters
- **06 Key-Value Store (262)** — Dynamo/BigTable for ledger, strong consistency PG vs tunable.
- **07 Unique ID (100)** — Twitter Snowflake / Flickr ticket servers for `CheckoutRequestID`.
- **05 Consistent Hashing (99)** — virtual nodes for partition lookup when sharding.
- **20 Metrics Monitoring (424)** — for `GET /health|/ready` and dashboard stats `server/routes/dashboard/stats/route.ts`.
- **24 S3 Object Storage (447)** — for settlement files, receipts.

## 3. Palpluss Deep Dive — https://palpluss.com

Scraped 2026-09-17 via `webfetch`.

**Positioning:** *Programmable M-Pesa — no Daraja config, no OAuth juggling, no callback chaos. One API call.*

- **Base:** `https://api.palpluss.com/v1`, HTTPS/JSON, **HTTP Basic** `Authorization: Basic YOUR_API_KEY`, envelope `{success, data, requestId}` + error `{message, code, details}` (`docs.palpluss.com`).
- **Endpoints:** `POST /v1/payments/stk` `{phone:254712..., amount:100, accountReference:ORDER-001}` → instant STK prompt; `POST /v1/payments/b2c`, bulk disbursements, `GET /transactions`, channels (Paybill/Till routing), webhooks `paid|fail|timeout` with signed payloads + IP whitelist.
- **DX:** Typed SDK `await client.stkPush({amount})`, dashboard `console.palpluss.com`, guides <5min, 99.9% uptime, <200ms avg, `60 req/min` per key, KES15 free credit.
- **Pricing:** Service wallet pre-funded, deducted **at initiation** (not settlement):
  - STK: `KES 1-9 FREE`, `KES 10+ KES 3 flat` any amount (10 → 1M same)
  - B2C per recipient: 1-49:6, 50-499:12, 500-999:18, 1k-1499:23, 1.5k-2499:30, 2.5k-3499:33, 3.5k-4999:40, 5k-7499:50, 7.5k-9999:55, 10k-14999:65, 15k-19999:85, 20k-34999:110, 35k-49999:150, 50k-149999:170, 150k-249999:200, 250k+ 2%
  - Wallet: separate from customer funds, full deduction log, low-balance alerts, monthly invoicing not needed (pre-fund).

**Model:** Hosted PSP-aggregator — you pay wallet fees, they absorb Daraja ops. Direct competitor to MobiPay's self-hosted partner_psp approach.

## 4. mSpace Deep Dive — https://mspace.co.ke/mpesa

Scraped 2026-09-17.

**Provider:** MSpace Solutions Ltd, Kilimani Elysee Plaza 2nd Floor + Kampala Ham Towers, 5000+ businesses, channels SMS/Email/WhatsApp/USSD/Shortcode/Service Desk + URL shortener.

- **Model:** **Direct** Safaricom integration — *no middleman markup, no aggregation, data on your servers*. You bring existing Paybill/Till.
- **Live Now:** C2B collections, STK Push prompt-to-pay, Paybill C2B callback, Transaction API (pull lists + verify), unified dashboard (SMS+Email alongside payments), instant **branded SMS** confirmation to payer on every C2B (Bulk SMS engine, included free), Full REST via existing MSpace API key.
- **Coming Soon:** B2C disbursements, B2B, Airtel Money (waitlist).
- **Pricing:** Setup **KES 8,000 + VAT = 9,280 once** (Daraja registration + shortcode linkage + webhook config + go-live). Recurring: **1% ≤KES 3,000, KES 30 flat >3,000** invoiced monthly, no per-call API fees, no hidden charges. Safaricom C2B payer tariff extra. B2C/B2B pricing TBA.
- **Auth:** MSpace API key, portals `cportal.jsp`/`bportal.jsp`, `ussdportal.mspace.co.ke`.

**Contrast:** mSpace is cheapest for volume C2B if you own Paybill and want data sovereignty + bundled SMS; Palpluss is cheapest flat-fee for high-ticket STK and for B2C now.

## 5. Competitive Gap Analysis

| Dimension | MobiPay Today | Palpluss Advantage | mSpace Advantage | Gap to Close (per notes Ch26/27) |
|---|---|---|---|---|
| **Time to Pay** | Needs Daraja creds + `initiateStkPush` `lib/mpesa.ts:29` with passkey/timestamp/password, sandbox vs prod URL | <5min, token handling hidden, <200ms | Direct but requires `KES 9280` setup + shortcode you own | Add hosted onboarding wizard + encrypted credential vault + health `server/routes/mpesa/health/route.ts` |
| **Fee Model** | PSP agreement variable | KES3 flat STK, wallet pre-fund | 1%/30 flat, no markup | Define merchant pricing facade; adopt service wallet pattern for sandbox fees |
| **B2C/Bulk** | Not yet (C2B/STK only `lib/mpesa.ts:39`) | Live bulk audited runs | Waitlist | Implement pay-out executor + ledger double-entry Ch26 before B2C, else out of scope per `docs/PSP-OPERATING-MODEL.md:48` |
| **Webhooks** | `queueWebhook` UPSERT `lib/webhooks.ts:8`, `deliverWebhook` HMAC `v1=` + backoff 30*2^n `lib/webhooks.ts:16` — good but sync poll, no broker | Signed + IP whitelist, instant events | Not described | Add Ch19 broker partitions, consumer groups, DLQ, observability; fix `payment_webhook_events` missing workspace link until txn found `server/routes/mpesa/stk/callback/route.ts:28` |
| **Notifications** | `payment_notification_events` + template query `server/routes/mpesa/stk/callback/route.ts:34` — opt-in per workspace | — | Instant branded SMS free | Add Ch10 templates + settings opt-out + queue decoupling before SMS `sendPaymentReceipt` blocks callback |
| **Reconciliation** | `POST /admin/reconcile` counts `getFailedTransactions()` + `getDuplicateTransactionCount()` `server/routes/admin/reconcile/route.ts:10`, double `matched++`, no settlement file | Automatic | Dashboard reports + auto reconcile | Implement Ch26 settlement-file ingestion + 3-way ledger/wallet/PSP diff + finance manual queue |
| **Idempotency** | Strong for `/v1/payments/stk` via DB `server/routes/v1/payments/stk/route.ts:11` + callback dedup `server/routes/mpesa/stk/callback/route.ts:14`; weak for `/api/payments/stk` `server/routes/payments/stk/route.ts:1` (no key) | `requestId` envelope, PSP nonce | Transaction API idempotent | Add gateway Ch04 rate limit + require `Idempotency-Key` on all money-moving POSTs, fix amount type to `string` Ch26 |
| **Scaling** | Neon PostgreSQL single primary, no sharding | Managed | Managed | Plan Ch05 virtual nodes + Ch27 sharded Raft if >10 TPS Ch26 estimate exceeded |
| **Compliance** | `partner_psp` gate Ch26 hosted-page principle correctly avoids card storage | Claims Uptime SLA, encryption, signed payloads | Claims direct Safaricom, no aggregation | Add PCI/tokenization note even for M-Pesa, Ch26 security checklist |

## 6. Recommended Roadmap (Priority Order)

**P0 — Close correctness gaps (Ch26):**
1. Fix `server/routes/admin/reconcile/route.ts:30` double count and implement settlement file upload/compare (PSP csv → internal `payment_transactions` + future ledger).
2. Require `Idempotency-Key` on `server/routes/payments/stk/route.ts` like `server/routes/v1/payments/stk/route.ts:11` does.
3. Change `amount: number` to string in API + DB to avoid float precision (Ch26 caveat).
4. Harden `server/routes/mpesa/stk/callback/route.ts:14` to store `workspace_id` via shortcode lookup before transaction update, not after.

**P1 — Reliability (Ch10, Ch19, Ch04):**
5. Move `lib/webhooks.ts:15` fetch to background worker with queue table retention 2 weeks (Ch19) + expose `/api/developer/webhooks/deliveries` retry UI.
6. Add Redis sliding-window counter rate limiter at `server/http.ts` (60/min like Palpluss) + CORS allowlist already in `PRODUCTION_READINESS.md:19`.
7. Decouple SMS: queue `payment_notification_events` then worker calls `mobiwave-sms.ts`, add per-workspace throttle.

**P2 — Competitive parity:**
8. Add channel routing (Paybill/Till selector) like Palpluss `Manage channels` and mSpace dashboard.
9. Implement B2C payout executor gated by `docs/PSP-OPERATING-MODEL.md:48` licensed approval, with Ch26 payout flow + Tipalti pattern and Ch27 TC/C for wallet-to-wallet if wallet added.
10. Define merchant pricing mirroring best of both: Palpluss-style flat `KES 3` facility fee + mSpace-style transparency page; keep mSpace instant SMS as benchmark.

**P3 — Scale & audit (Ch27):**
11. Introduce event sourcing for `payment_transactions` — append-only `payment_ledger` with debit/credit double entry, snapshot to object storage (S3-like Ch24), replayable.
12. Add metrics `server/routes/dashboard/stats/route.ts` alerts per Ch20, and S3 storage for receipts.

---
*Teams should treat Ch26's hosted payment page principle as satisfied for M-Pesa (no card storage) but still apply tokenization and HTTPS pinning for Daraja calls.*
