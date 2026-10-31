# SettleGraph — live-readiness roadmap

**Status date:** 31 October 2026  
**Current release:** 0.5.2 merged build  
**Product scope:** Paytm-aligned merchant payout, evidence and counter-operations core, with Vendor & Exceptions Desk as an adjacent extension.

This roadmap separates the locally working prototype from a genuinely connected product. “Live” means authorised merchant source systems are securely connected, data is current and traceable, results are reconciled against independent evidence, and every external action is authorised and acknowledged by its provider. A running React page or API returning HTTP 200 is not enough.

## 0. Current release — what exists today

| Capability | Local implementation | Real-provider connection? |
|---|---|---|
| Settlement reconciliation | Integer-paise engine, explicit batch IDs, bank/payout UTR matching, adjustment buckets and residual | No; built-in fixtures or local uploads |
| Cutoff explanation | Bounded two-pointer event-window analysis using exact transaction IDs; cross-date, unmatched and ambiguous events | No; event fields are carried in normalized local rows, not two independent live feeds |
| Evidence graph | NetworkX nodes/edges with source IDs and match rules | No |
| Dataset / dispute Merkle | Source-row integrity tree and three-leaf nodal/POS/courier proof | No source authentication; hashes fingerprint captured fields |
| Dispute policy lab | Deterministic synthetic states and fault injection | No NPCI/Paytm submission |
| Duplicate capture | Active-dataset cluster detection and human review staging | No live payment lookup or refund |
| POS sync | Idempotent local mock order update | No real POS update |
| Fake UTR check | Exact lookup in current local dataset | No switch lookup; a miss is not fraud proof |
| Paytm-style import | CSV preview, operator mapping/staging and canonical ZIP import | No Paytm API connection or verified provider contract |
| Voice / agent | Optional Sarvam HTTP adapters and deterministic/read-only fallback | Not live-tested with the team's key in this handoff |
| Vendor & Exceptions | PO/GRN/invoice/partial-payment fixture, eligibility/timeline workflow, TAT examples, exception inbox | No ERP, Udyam, supplier portal, bank, email or WhatsApp connection |
| Evidence PDF | Local four-exhibit review packet | Not a statutory submission |

## Phase 1 — prove the local release on the target Windows laptop

**Goal:** establish a repeatable, judge-safe demo from a clean unzip.

### Actions

1. Extract `SettleGraph_Team_Aliens_FINAL.zip` into a new writable folder. Do not mix it with older `SettleGraph_Final`, GOAT or v4 directories.
2. Install Python 3.11+ and Node.js 20+. Create the backend venv and install `backend/requirements.txt`.
3. From `frontend`, install dependencies and run the real production build. The `build` script runs TypeScript project build and Vite bundling.
4. Start the API and UI from the project root in separate PowerShell windows.
5. Test the browser on desktop and mobile widths using synthetic data only.
6. Configure the team's Sarvam key on the backend only; test one short Hindi ASR, one bounded tool-selection request and one TTS response. Then test the labelled fallback with network disabled or an invalid key.
7. Confirm the PDF opens and Hindi text is legible with the Windows font configuration.

### Commands

From separate PowerShell terminals at the project root:

```powershell
.\start_backend.ps1
```

```powershell
.\start_frontend.ps1
```

Then run:

```powershell
.\verify_project.ps1
```

Expected backend result in this handoff: **111 pytest tests passed**. Frontend source syntax transpilation passes, but a complete npm type-check/Vite build and browser walk-through remain unverified until completed on the target machine with npm registry access.

### Browser checklist

- [ ] `/api/health` reports `demo_mode: true`, live provider flags false, money-movement and dispute-submission flags false.
- [ ] All six sections load: Settlement, Evidence Graph, Policy & Safety, Vendor & Exceptions, Counter Operations, Investigations & Audit.
- [ ] Baseline settlement and shortfall fault update correctly.
- [ ] Cross-date event analysis lists exact source references and never silently assigns a batch by timestamp.
- [ ] CSV preview, mapping and staging are visibly distinct from canonical ledger activation.
- [ ] ZIP import with and without `disputes.csv` behaves as documented; failed validation leaves active data unchanged.
- [ ] OTP/invoice/courier fault changes dispute Merkle root and locks policy state.
- [ ] Duplicate cluster stages one local review record; no refund API is called.
- [ ] POS sync changes only the local mock order and is idempotent.
- [ ] Vendor interest estimate stays blank until rate is entered and explicitly confirmed.
- [ ] Vendor missing GRN/objection/PO mismatch flags lock follow-up staging.
- [ ] UPI P2M T+5 and P2P T+1 are distinct and labelled as category-specific calculations.
- [ ] Sarvam live/fallback states are truthful; failed ASR never creates a transcript.
- [ ] Four-exhibit PDF opens and states source/fixture status and evidence limitations.

**Exit gate:** two clean-start runs by two team members, with no manual database editing and no hidden successful external action.

## Phase 2 — sign real data contracts before writing connectors

**Goal:** make source semantics explicit before connecting provider endpoints.

| Source | Obtain (with merchant consent) | Must establish |
|---|---|---|
| Paytm for Business | Versioned redacted transaction, settlement and adjustment exports; sandbox/API docs if available | Transaction IDs, UTR meanings, batch IDs, split legs, reversals/refunds, status meanings, timezone, cutoff and schema version |
| Merchant bank | Redacted statement/CSV/API sandbox | UTR/reference format, debit/credit direction, value date vs posting date, split credits, reversals and statement completeness |
| POS/OMS | Order/invoice/payment export or API contract | Stable order/payment IDs, invoice total, adjustments, fulfilment state and duplicate/cancellation semantics |
| Courier/WMS | Shipment events and signed delivery-proof APIs | AWB, event history, OTP verification evidence, event time, actor and source verification mechanism |
| Dispute provider | Current NPCI/Paytm process and API contract | Rail, reason code, actor, deadlines, allowed evidence, state transitions, retries and response codes |
| Vendor/ERP | PO, line items, GRN, invoice, notes, dated bank receipts | Supplier identity, Udyam proof/effective date, category/activity, acceptance/objection, payment terms and dated events |

### Data-contract files to add

```text
backend/contracts/
  common.py                 # source IDs, source clock, timezone, currency, provenance
  paytm_settlement_v1.py    # versioned report schema and source semantics
  bank_statement_v1.py     # bank row/UTR/date/value-date contract
  pos_order_v1.py           # order/invoice/payment schema
  courier_event_v1.py      # shipment/OTP evidence schema
  dispute_event_v1.py      # versioned rail/reason/state/deadline contract
  vendor_documents_v1.py   # PO/GRN/invoice/notes/Udyam references
```

These are future deliverables; do not say these files already exist.

**Exit gate:** source-to-canonical data dictionary signed by merchant/data owner; every field has type, unit, timezone, null semantics and trust class; redacted sample files test the mapping.

## Phase 3 — production data pipeline and reconciliation correctness

**Goal:** turn the local CSV prototype into a verified ingestion service.

| Target file | Work |
|---|---|
| `backend/adapters/paytm.py` | Approved read-only client or verified export parser; token rotation, paging, rate limits, schema version and retries |
| `backend/adapters/bank.py` | Statement/API normalizer; posted/value dates, split credits, UTR validation and reversals |
| `backend/adapters/pos.py` | Read-only payment/order/invoice adapter with stable reference map |
| `backend/adapters/courier.py` | Verified delivery event adapter; minimise OTP storage |
| `backend/ingestion/jobs.py` | Idempotent import jobs, checkpoints, source file IDs, replay and retry state |
| `backend/ingestion/quarantine.py` | Unknown schema, repeated IDs, malformed rows, contradictory timestamps and invalid currency quarantine |
| `backend/engine.py` | Keep pure integer-paise kernel; add split settlement legs, parent refund edges, partial reversal and property/fuzz tests |
| `backend/reconciliation/run.py` | Explicit match phases; exact reference first; candidate-only fuzzy hints; persisted decisions and operator overrides |
| `backend/graph/build.py` | Typed provenance edges with source, method and confidence class |
| `backend/tests/integration/` | Provider fixtures; source drift, duplicate webhook, partial batch, missing row and clock-skew tests |

### Two-pointer cutoff requirement

The existing analyser is a bounded local event-window algorithm. Production must run it across two **independently ingested** feeds: (A) capture/Soundbox/payment initiation and (B) nodal/provider settlement events. Use provider-defined timezone/cutoff semantics and stable transaction IDs. Window proximity cannot override a missing/contradictory ID and must never assign the payout batch. Support partial/split settlements, retries, late status flips and parent-child refunds.

**Exit gate:** reconciliation accuracy and false-match rate measured on representative redacted data; every result traces to original rows; unresolved residuals remain visible.

## Phase 4 — formal policy and Vendor Desk correctness

**Goal:** use versioned rules rather than hard-coded demo assumptions.

### UDIR / RGNB / dispute workflow

Build a versioned rule catalogue only from current authoritative Paytm/NPCI scheme documents and provider contracts. Every rule must specify rail, reason code, actor, accepted state, deadline clock, evidence requirement, action, response mapping, effective date and reference. Keep UDIR, RGNB, representment and RBI failed-transaction TAT separate. Obtain legal/compliance approval before external actions.

### RBI failed-transaction TAT

Current local logic covers two named UPI categories from the RBI 2019 framework only. Production must include all applicable transaction categories/rails, the correct clocks and event evidence, responsible actor, actual reversal records and exception handling. A date calculator alone cannot decide entitlement; transaction type and failed-transaction conditions must be verified.

### MSME Vendor Desk

Current local fixture has one synthetic PO/GRN/invoice/partial-payment flow. Before merchant use:

- authenticate Udyam registration and preserve its evidence securely;
- verify Micro/Small status, registration/effective date and eligible manufacturing/service activity;
- preserve delivery/acceptance date and written objection evidence with source IDs;
- enforce Section 15 payment terms and 15-day acceptance/objection semantics against counsel-reviewed test cases;
- ingest dated partial payments, credit notes and debit notes;
- implement Section 16 calculations using relevant RBI Bank Rate history, 3x rate and monthly rests; never use the local single-rate illustration as a legal claim;
- create any follow-up notice for human approval, with exact documents and no automatic send.

The MSMED statutory structure includes a 15-day written objection/acceptance concept, a maximum 45-day agreed payment period, and Section 16 compound interest with monthly rests at three times the RBI Bank Rate. Ministry MSEFC guidance limits this delayed-payment mechanism to eligible Micro/Small manufacturing/service enterprises and excludes trading NIC 45–47 activity. Actual eligibility and facts still require case-by-case verification.

**Exit gate:** signed compliance/rule review; tests cover edge dates, partial payment schedule, month-end rest, changing RBI rate, late/unresolved objections and ineligible supplier.

## Phase 5 — durable architecture, identity and security

**Goal:** protect actual merchant and customer records.

### Target architecture

- React/TypeScript UI with authenticated session and tenant context.
- FastAPI services with typed contracts and explicit adapter interfaces.
- PostgreSQL with tenant-scoped access, migrations and transaction boundaries. Use `SELECT … FOR UPDATE SKIP LOCKED` only for worker queue claims that need concurrent processing; do not add it as a decorative deck checkbox.
- Encrypted object storage for original reports, manifests and generated packets; versioning and retention rules.
- Durable job queue and outbox for webhook/action retries with idempotency and replay controls.
- Secrets manager/KMS for provider credentials and signing keys; no keys in repo, frontend build, logs or unencrypted local database.
- Append-only audit retention with externally anchored hash checkpoints. A local hash chain alone cannot detect tail truncation.
- Observability: request IDs, structured redacted logs, metrics, traces, alerts and runbooks.

### Target files to add or refactor

```text
backend/
  auth.py                 # identity/session validation
  tenancy.py              # tenant context and row scoping
  rbac.py                 # roles, dual control and action permissions
  db/                     # models, migrations, transaction scope
  adapters/               # approved provider integrations
  contracts/              # versioned data schemas
  policies/               # versioned dispute/TAT/MSME catalogue
  ingestion/              # validation, quarantine, jobs, replay
  actions/                # approval, outbox, idempotency, provider acknowledgements
  audit/                  # append-only log and external anchoring
  config.py               # environment config and secret references
  tests/security/         # tenant isolation, auth, replay, upload, RBAC
frontend/src/
  auth/                   # login/session handling
  features/               # settlement, dispute, operations, vendor
  shared/                 # typed API client, error boundary, components
```

### Security checklist

- Threat model cross-tenant leakage, fraudulent uploads, malicious CSV formulas, compromised keys, webhook replay and approval coercion.
- MIME/content inspection, size/zip-bomb/path traversal limits, virus scan, CSV formula neutralisation and safe PDF/HTML escaping.
- PII minimisation: mask VPA/account identifiers; never log full OTP/VPA/card/account credentials; define lawful basis, retention and deletion.
- Authentication, tenant scopes, role checks, maker-checker dual control, transaction limits and step-up auth for money-impacting actions.
- Idempotency bound to tenant + provider + action + canonical payload hash; provider response persisted and reconciled before completion.
- Penetration test, SBOM/dependency and secret scans, backup/restore and disaster-recovery drill.

**Exit gate:** independent security sign-off and evidence for access control, tenant isolation, replay protection, upload safety, key management, audit and recovery.

## Phase 6 — Sarvam and agent experience

**Goal:** voice helps the merchant without letting a probabilistic model author financial facts or execute sensitive operations.

1. Confirm model/credit entitlement, endpoint version, request size, supported audio formats and rate limits from official Sarvam docs/account.
2. Keep credentials server-side. Enforce per-tenant budgets, request timeouts, concurrency limits and cost metrics.
3. ASR yields an editable transcript. IDs, dates and amounts become a structured draft and are matched against source records; fuzzy candidates require human confirmation.
4. Tool use remains allow-listed, schema-validated and read-only by default. Tool results include source IDs and computation version.
5. The deterministic backend formats financial answers; the model can explain but cannot add unsupported totals or policy claims.
6. TTS speaks only validated backend answers. Browser fallback and typed path remain.
7. Evaluate noisy-market Hindi/Hinglish, accents, UTR digit confusion, negative cases and network drops with consented recordings.

**Exit gate:** measured task success, reference-binding precision/recall, no unauthorized tool call, cost ceiling, fallback tests and user confirmation audit.

## Phase 7 — provider actions, only after formal approval

Start read-only. Do not enable refunds or dispute submission merely because an API route exists.

Every write action needs written provider permission/contract, verified merchant authority, role/tenant context, policy/evidence validation, human maker-checker approval, amount/beneficiary bounds, idempotency, replay protection, request signing, audit event, provider acknowledgement, final status reconciliation, safe retry/compensation strategy, kill switch and per-merchant allow-list.

Suggested order: provider case-status read → sandbox order/payment sync → sandbox evidence upload → controlled live read-only pilot → approved low-risk write action → refund initiation last with dual control and independent reconciliation.

**Exit gate:** an action is marked complete only after provider acknowledgement and reconciliation of the resulting ledger event.

## Phase 8 — merchant pilot and operations

Pilot with a small merchant group using consented/redacted data and one provider version. Track residuals, unresolved rows, exact/candidate match rates, false matches, time-to-explain payout, support escalations, duplicate-review precision, prevented duplicate refunds, evidence completeness, deadlines, voice correction/fallback rate, vendor collection days, eligibility overrides, uptime, latency, provider errors and cost per tenant.

Do not market recovery percentages, money saved or dispute-win rates until a pilot measures them.

## Definition of “live and fully functional”

A controlled live merchant pilot is ready only when all are true:

- [ ] Clean production build and browser/accessibility tests pass.
- [ ] Each source integration is authorised, contract-tested, versioned and independently reconciled.
- [ ] Imported payments, bank credits, adjustments, orders, delivery and disputes preserve source IDs, hashes and timezone semantics.
- [ ] No unmatched/ambiguous row is silently auto-resolved; residual/provenance remains explainable.
- [ ] Policy rules have current authoritative references, effective dates, reason-code tests and compliance sign-off.
- [ ] Vendor eligibility, acceptance, due-date and interest are legally validated against real test cases and RBI rate history.
- [ ] Authentication, tenant isolation, RBAC, dual approval, encryption and immutable audit pass security review.
- [ ] Sarvam live/fallback paths pass multilingual evaluation with cost and privacy controls.
- [ ] External actions require approval and are marked complete only after provider acknowledgement.
- [ ] Incident, rollback, support, backup/restore and data-retention runbooks are exercised.

Until this gate is satisfied, describe this release as a **local, test-backed hackathon prototype with synthetic fixtures and local file import**, not as a live Paytm integration.

## Regulatory / API source references used for this roadmap

These are reference starting points, not a substitute for checking the current effective document before a live implementation:

- Reserve Bank of India, DPSS.CO.PD No.629/02.01.014/2019-20, 20 September 2019 — Harmonisation of Turn Around Time and customer compensation for failed transactions: <https://rbi.org.in/commonman/Upload/English/Notification/PDFs/CIRCULAR677EC931A7A65E4D99AA957D8E85BC0A2A.PDF>
- India Code, Micro, Small and Medium Enterprises Development Act, 2006 — sections 2(b), 15 and 16: <https://www.indiacode.nic.in/bitstream/123456789/5872/1/a2006-27.pdf>
- Ministry MSEFC scheme guidelines — eligibility scope for the delayed-payment mechanism: <https://ramp.msme.gov.in/ramp/pdf-documents/scheme-guidelines/msefc.pdf>
- Sarvam official API docs — verify current Saaras, Bulbul and Chat API request/response fields, supported limits and model entitlements at implementation time: <https://docs.sarvam.ai/>


For actual credentials, provider access requirements, endpoint setup and integration acceptance criteria, read `docs/INTEGRATION_SETUP_GUIDE.md`.
