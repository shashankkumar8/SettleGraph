# SettleGraph — phase-wise roadmap from zero to a production-grade product

**Scope anchor:** the selected six-slide Stage 1 deck for Team Aliens / Track 3. This roadmap distinguishes what is already in the delivered local workbench from what still requires source evidence, credentials, security architecture or provider approval. It does not describe unavailable integrations as complete.

---

## Product definition to freeze

**SettleGraph is a cross-system merchant exception-resolution teammate.** It connects payment-provider and settlement records with the merchant's bank, POS/order, fulfilment and support evidence; calculates money with a deterministic integer-paise kernel; makes evidence relationships inspectable; and prepares the next operational step for a human.

### Core workflows

1. **Settlement explanation:** Why does the bank credit differ from the merchant's collection/settlement expectation? Which source rows, batch refs and adjustments explain it?
2. **Dispute evidence readiness:** Do nodal payment, POS/invoice and courier/delivery facts agree? What is missing or contradictory? Can a review packet be compiled?
3. **Counter-payment safety:** Does a UTR exactly match the currently connected authoritative source? Are two payments possibly attached to one order?
4. **Order recovery:** Has payment succeeded while the POS order remains pending? Is a safe idempotent sync available?
5. **Voice-assisted access:** Can a merchant ask or dictate the issue in Hindi/Hinglish and receive a grounded explanation?
6. **Vendor & Exceptions extension:** Can a supplier's PO/GRN/invoice/payment records be checked and a follow-up be staged for human review? This is a v4-derived adjacent module, currently synthetic and not part of the original core deck promise.

### Non-negotiable safety rules

- Currency is integer paise inside the kernel; the LLM never owns financial arithmetic.
- Exact source IDs establish relationships. Timestamps and fuzzy matches are supporting evidence, not a batch assignment.
- Unknown, missing or contradictory data remains unknown/review; it must not silently become zero, fraud or success.
- ASR is an intake suggestion. Identifiers and amounts need user/source confirmation.
- An approval request is not a payment action. Live refunds, dispute submissions and POS updates require explicit backend permissions, idempotency and provider-confirmed responses.
- Hashes prove captured-data integrity, not truth or upstream identity.

---

## Current project folder and file responsibilities

```text
SettleGraph_Team_Aliens_FINAL/
├── README.md                          # Run guide, working scope and API map
├── start_backend.ps1                  # Windows venv/dependency/API launcher
├── start_frontend.ps1                 # Windows npm/dev-server launcher
├── backend/
│   ├── .env.example                   # Server-only optional Sarvam configuration
│   ├── requirements.txt               # Python runtime/test dependencies
│   ├── main.py                         # FastAPI routes, request models, orchestration
│   ├── engine.py                       # Integer-paise reconciliation, graph, Merkle, proofs
│   ├── paytm_settlement_adapter.py      # Conservative Paytm-style CSV parser/normalizer
│   ├── sarvam_service.py                # Optional chat/ASR/TTS + edit-distance reference suggestions
│   ├── pdf_compiler.py                  # Four-exhibit PDF compiler
│   ├── seed_data.py                     # 140 capture-day payments + 3 isolated operations fixtures
│   ├── vendor.py                        # Synthetic PO/GRN/invoice, MSME/TAT workflow aids
│   ├── store.py                         # SQLite local persistence, approvals, audit chain
│   └── tests/
│       ├── conftest.py                 # Isolated test configuration/client
│       ├── test_engine.py              # Reconciliation, graph, paise and Merkle tests
│       ├── test_api.py                 # API contract and endpoint tests
│       ├── test_paytm_settlement_adapter.py # CSV header/paise/row validation
│       └── test_upgrade_features.py    # Staging, fallback, approval, POS, three-way Merkle, PDF
├── frontend/
│   ├── package.json                    # React/Vite/Lucide dependencies/scripts
│   ├── tsconfig.json                   # TypeScript compiler options
│   ├── vite.config.ts                  # Vite + React config
│   ├── index.html                      # Application document shell
│   └── src/
│       ├── main.tsx                    # React entry point
│       ├── App.tsx                     # Core operator workbench and six-section navigation
│       ├── VendorTab.tsx               # Merged v4 Vendor & Exceptions Desk
│       └── styles.css                  # Product-specific visual system/responsive styles
├── sample_data/                        # Synthetic CSV reports and sample ZIP
└── docs/
    ├── PROJECT_AUDIT.md                # Cross-file source and claim audit
    ├── IMPLEMENTATION_STATUS.md        # What passed and what was not verified
    ├── GAP_REGISTER.md                 # Current implemented/partial/open matrix
    ├── IMPLEMENTATION_AND_JUDGE_GUIDE.md # Architecture explanation and demo defence
    ├── DEMO_AND_JUDGE_QA.md            # Demo narrative and judge Q&A
    ├── V4_FEATURE_AUDIT.md              # Separate v4 feature comparison / merge decision
    ├── LIVE_READINESS_ROADMAP.md        # Production file map and live readiness gates
    └── PHASED_ROADMAP.md                # This roadmap
```

### Read the code in this order

1. `backend/seed_data.py` — first understand exactly what the synthetic scenario says.
2. `backend/engine.py` — integer-paise contract, matching invariants, residual and graph.
3. `backend/paytm_settlement_adapter.py` — how rupee strings are parsed and why payout batch is left unknown.
4. `backend/main.py` — how inputs become endpoints and outputs.
5. `backend/store.py` — persistence and idempotency semantics.
6. `backend/tests/` — tests prove expected behaviour and boundaries.
7. `backend/sarvam_service.py` — optional perception/orchestration adapter; no finance writes.
8. `backend/pdf_compiler.py` — how evidence data becomes the four-exhibit packet.
9. `frontend/src/App.tsx` — tab-by-tab UI to API wiring.
10. `frontend/src/styles.css` — the visual system.

---

## Phase 0 — Freeze requirements and source contracts

**Status: design locked for the local hackathon build; production contract remains open.**

Tasks:

1. Create a data dictionary for every imported field: provider name, source report version, meaning, currency, timezone, uniqueness, nullable state and source-row identifier.
2. Obtain redacted examples from each required system: Paytm transaction/settlement report, merchant bank statement, POS/order export, courier event export and dispute report.
3. Draw the real entity model: Merchant, Payment, SettlementLine, Adjustment, PayoutBatch, BankCredit, Order, FulfilmentEvent, Dispute, Investigation, Approval, ToolExecution and AuditEvent.
4. Define which IDs are authoritative in each system and how split settlement legs/refunds/reversals reference parents.
5. Define the cut-off timezone and business date from the provider's own specification. Never assume it is the laptop locale.
6. Maintain a rule registry with source URL/document, effective date, reason code, scope, state transition, due-time clock, responsible actor and tests.

Exit criteria:

- Every amount has a defined source and unit.
- Every graph edge has an authoritative or candidate evidence classification.
- No batch assignment is based only on timestamp or amount similarity.
- Product/legal review signs off the UDIR/RGNB terminology before any live workflow is coded.

## Phase 1 — Financial kernel and import adapters

**Status: local deterministic kernel, canonical ZIP import, Paytm-style CSV preview/staging and bounded two-pointer capture→nodal event analysis implemented.**

### File-level work

- `backend/engine.py`: retain Decimal→integer paise boundary, conservation equation, unknown-category review, exact ID linkage, bounded event analysis, duplicate detection and residual status. Add property/fuzz tests for sign/overflow/large values.
- `backend/paytm_settlement_adapter.py`: verify real column aliases from versioned redacted exports; record schema version; distinguish transaction-level UTR from payout-level UTR; support split flags/settlement legs only when source semantics are confirmed.
- `backend/main.py`: expose adapter preview, staged operator mapping, canonical ZIP import and validation error summaries.
- `backend/store.py`: store import metadata, schema version, file hash and commit status. Do not store unneeded PII.
- `sample_data/`: keep synthetic demo rows clearly labelled, separate from vendor exports.

### Implemented local event-window analyser and remaining production work

`backend/engine.py:analyse_cutoff_events()` now extracts capture and nodal event views from normalized rows, sorts them by timestamp, advances two bounded-window pointers and resolves pairs only through exact `pg_txn_id`. The baseline fixture has one cross-date event (₹1,850.00); the UI and PDF show matched/unmatched/ambiguous counts and event details. It requires `nodal_source_row_id` and never infers batch membership from time.

Remaining for a production-grade implementation:

- Ingest **independent** Stream A capture/Soundbox events and Stream B nodal settlement events from approved source reports/APIs.
- Confirm time zone, source clocks, cutoff semantics, stable identifiers and settlement status definitions with the provider.
- Model split settlements and multiple payout legs explicitly; do not coerce them into one settlement amount.
- Quarantine repeated IDs, missing UTR, late/missing callbacks, source conflicts and amount mismatches.
- Test before/after-midnight, late success, duplicate callbacks, partial settlements, missing UTR, split leg, clock skew and ±1 paise discrepancy against redacted authoritative examples.

Exit criteria:

- 100% row accounting to matched, unmatched or quarantined buckets.
- Reconciliation residual can be reproduced from source rows.
- No hidden fee-rate assumptions.

## Phase 2 — Evidence graph, dispute Merkle proof and deterministic policy

**Status: NetworkX graph + dataset Merkle + three-way synthetic dispute Merkle + break-the-case tests implemented. Full policy catalogue remains open.**

### Implemented now

- Dataset Merkle: every normalized source row becomes a leaf; root and inclusion proofs are returned.
- Dispute Merkle: three explicit leaves for nodal payment, POS/order invoice and courier delivery, with inclusion proofs.
- Policy lab: OTP, amount, courier status and duplicate-debit mutations determine deterministic review states.
- PDF: case dispute root/leaf hashes appear in Exhibit C.

### File-level extension

- `backend/engine.py`: add versioned canonical evidence schemas, leaf metadata, signature verification hooks and root/run versioning.
- `backend/main.py`: policy predicates and rule version selection; never send external actions based solely on a hash match.
- `backend/store.py`: immutable event history, previous/next state and signed/anchored root references.
- `backend/tests/test_upgrade_features.py`: each evidence mutation must change only the expected leaf/root and force a known FSM state.

### Real UDIR/RGNB policy requirements

- Use a rule registry based on current authoritative NPCI circulars and the provider's actual role/API permissions.
- Model distinct flows (e.g. customer complaint, remitting-bank chargeback, good-faith chargeback, merchant representment, failed-transaction auto-reversal). Do not merge reason codes or clocks into one generic “dispute”.
- Record the event that starts each clock, timezone, due date and required evidence type.
- Never generalise RBI failed-transaction compensation across all disputes.

Exit criteria:

- Each state transition maps to a versioned rule and test.
- Missing or contradictory sources block a submission-ready state.
- A clean demo only means “ready for human review”, unless the provider confirms actual submission.

## Phase 3 — Voice, intent and evidence compiler

**Status: optional Sarvam adapters, fallback and local PDF compiler implemented; live provider use unverified.**

### Voice path

1. Browser MediaRecorder captures audio with user permission.
2. Backend validates file size/content type and forwards to Saaras only when configured.
3. Transcript is returned with language/mode and shown to the operator.
4. Amounts, UTR/RRN, AWB and order IDs are bound to candidate source references via Levenshtein suggestion.
5. User confirms the candidate before any record lookup or case action.
6. Sarvam TTS or browser speech synthesis narrates backend-computed facts. TTS never recalculates them.

### Agent path

1. Classify the user's intent using a small set of allowed tools.
2. Backend validates tool name, parameter schema, actor and scope.
3. Tool executes deterministic read-only code.
4. Tool output is passed back as structured evidence; final response may summarise it.
5. Server policy rejects any requested financial write unless a separately authorised workflow exists.
6. When Sarvam fails, agent clearly labels the offline deterministic path; no imaginary live model is displayed.

### PDF path

- Include case/run ID, capture period, source file hashes, row IDs, explicit matching rules, expected/actual/residual, unknowns/conflicts, three-way dispute root and voice transcript source/mode.
- Keep statutory/legal form claims out until counsel/provider approves the exact form schema.

Exit criteria:

- Live Sarvam calls tested with valid credits/key on target Wi-Fi.
- Network/credit timeout exercises deterministic fallback.
- ASR reference misrecognition is caught by confirmation.
- PDF can be opened and checked on the demo laptop.

## Phase 4 — API, persistence and operator workbench

**Status: FastAPI + SQLite local store + React workbench implemented; API proxy, frontend error state, exact paise input and capped microphone capture added. Browser build remains to be verified on the target laptop.**

### Current UI sections

- Reconciliation and fault simulation.
- Evidence graph explorer.
- Policy / Break-the-case lab.
- Counter operations (duplicate-debit review, local mock POS sync).
- Investigations and audit.
- Raw CSV preview/staging and teammate/voice interactions.

### Production extensions

- PostgreSQL with schema migrations and transactions; worker queue with `SKIP LOCKED` if concurrency requires it.
- Authenticated merchant/operator identities, tenant-scoped queries and RBAC.
- Upload quarantine, antivirus/mime checks, CSV injection-safe export, file retention and PII minimization.
- Provider webhook signature validation, nonce/timestamp checks, replay protection, idempotency and retry policy.
- Audit head anchoring in immutable external storage.
- API rate limits, tracing, metrics, structured logs and alerting.
- React browser tests (Playwright), keyboard/accessibility tests and mobile responsive QA.

Exit criteria:

- Import -> validate -> reconcile -> graph trace -> investigate -> save/retrieve -> PDF works after browser refresh.
- Every visible action is backed by a tested server operation.
- Failure, no data, stale data, ambiguous match, forbidden action and provider timeout states are clear.

## Phase 5 — Secure provider adapters (only after written permission)

1. Secure provider onboarding and API contract review.
2. Sandbox integration with no money writes.
3. Read-only Paytm transaction/settlement lookups; compare source row totals.
4. Bank statement ingestion; verify payout UTR, split credits, reversals and value dates.
5. POS/courier read-only lookups and signed webhook simulation.
6. Provider-backed dispute status read and evidence requirement checks.
7. Human-approved, idempotent dispute submission only if an approved API and merchant role exist.
8. Refund API only with dual control/approval, beneficiary+amount checks, daily limits, webhook reconciliation and compensation plan.
9. Roll out behind feature flags and per-tenant allow-lists; start with read-only merchants.

Exit criteria:

- Integration contract tests, penetration test, operational runbooks, audit retention, rollback and business-owner sign-off.
- A successful API response is stored; it is never inferred from a UI toast.

## Phase 6 — Pilot and scale

- Pilot with a handful of merchants and their consented redacted data.
- Measure time-to-explain-payout, unmatched-source rate, support escalations, false UTR flags, dispute evidence completeness, duplicate-refund prevention and operator override rate.
- Track rule drift and provider export version changes.
- Monitor latency, availability, data freshness, cost, voice success and fallback frequency.
- Introduce multi-outlet/ERP integration only after security and reliability are proven.

---

## Immediate run checklist for the current local build

1. Extract the project ZIP to a short writable path, for example `C:\PaytmHackathon\SettleGraph_Team_Aliens`.
2. Start backend: `.\start_backend.ps1`.
3. Start frontend in another terminal: `.\start_frontend.ps1`.
4. Check `http://127.0.0.1:8000/api/health` and open `http://127.0.0.1:5173`.
5. Run `python -m pytest -q` inside `backend`; expect 107 tests.
6. Run `npm install` then `npm run build` inside `frontend` (the package registry timed out in this handoff environment; complete this on the target laptop).
7. Confirm the UI displays demo/synthetic status and external actions disabled.
8. Walk through reconciliation, source graph, Paytm CSV stage, Break-the-case, approval queue, local POS sync, PDF and optional voice.
9. If live Sarvam cannot be verified, present the deterministic fallback without implying a successful ASR/TTS call.
10. Do not use real refund/dispute/bank credentials during the judge demo.


## Separate v4 branch merge

The independent `SettleGraph_Team_Aliens_v4.zip` contributed the Vendor & Exceptions Desk. Its valuable PO/GRN/invoice, outstanding, TAT, Kirana payout and exception-inbox flows are integrated into `backend/vendor.py`, vendor routes in `backend/main.py`, `frontend/src/VendorTab.tsx` and `backend/tests/test_vendor.py`. The v4 archive was not used as the base because it did not retain all the GOAT settlement/import/evidence/voice hardening. Read `V4_FEATURE_AUDIT.md` for the feature-by-feature decision and `LIVE_READINESS_ROADMAP.md` for the fully connected production plan.
