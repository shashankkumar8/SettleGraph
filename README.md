# SettleGraph — Team Aliens

**Evidence-first merchant operations workbench** · Paytm Build for India AI Hackathon 2026 · Team 275

SettleGraph connects merchant-side payment, settlement, adjustment, bank, order and delivery evidence so an operator can understand payout discrepancies, inspect suspicious counter payments, prepare dispute evidence and stage sensitive decisions for human review. It is a deterministic financial-operations workbench, not a chatbot wrapper.

> **Honest runtime boundary:** the included fixtures are synthetic. The app runs locally and supports uploaded local CSVs / ZIP bundles. There is no live Paytm, NPCI, bank, courier or merchant POS connection, no real refund execution, and no real dispute submission. Do not use it to make live financial decisions or upload unredacted customer data.

## What is actually functional in this build

### Settlement reconciliation

- Monetary input is converted with `Decimal` into integer paise. Reconciliation and residual calculations use integers, not binary floating-point.
- The engine requires explicit `payout_batch_id`, `batch_id` and exact payout UTR references. It does **not** infer payout-batch membership from the clock or assume that any particular fee rate applies to a payment instrument.
- Debit/credit adjustments are grouped from source rows. Unknown categories, invalid references and missing rows remain visible as review conditions.
- Multiple bank rows may contribute when they match the selected batch and authoritative payout UTR.
- The output distinguishes `RECONCILED`, `UNEXPLAINED_VARIANCE`, `NEEDS_REVIEW` and `INCOMPLETE_OR_UNMATCHED`.
- A bounded two-pointer capture→nodal event analyser pairs exact transaction IDs inside a configurable `[-15m, +36h]` window, reports cross-date events and exposes unmatched/ambiguous references. It requires a nodal source-row reference; missing nodal amount evidence is labelled unavailable rather than assumed equal.

### Evidence graph and two different Merkle uses

- The NetworkX evidence graph connects records only where a source reference supports an edge and surfaces the match rule/source row.
- The dataset integrity Merkle tree fingerprints source rows and exposes individual inclusion proofs.
- The dispute Merkle tree contains three leaves: `NODAL_PAYMENT`, `POS_ORDER_INVOICE` and `COURIER_DELIVERY`. Its root changes when a hashed field changes. Each leaf has a verifiable proof.
- SHA-256/Merkle proves consistency with the captured bytes/fields only. It does not prove a source system is genuine, complete or truthful.

### Break-the-case policy lab

- The synthetic dispute workbench can corrupt the OTP, alter invoice amount, contradict courier status or stage a duplicate-debit scenario.
- The policy engine deterministically returns a review state. Contradictions lock the policy gate. A clean synthetic case is only marked **ready for human review**.
- `external_submission_enabled` is always false. There is no hidden live dispute endpoint.

### Counter operations

- Duplicate-debit check stages an idempotent local approval record. Approve/reject changes the local approval state only; it never calls a refund API. Detection uses exact order ID + integer-paise amount + distinct successful references within 120 seconds; if both payer identifiers are present they must agree. The raw VPA is never returned, and absent payer identity is explicitly labelled unavailable.
- Paid-but-pending order sync operates against a local mock POS order, with an idempotency key. It does not call a merchant POS.
- Fake UTR checks query the currently loaded demo/imported dataset only. `NO_MATCH_IN_LOADED_DEMO_DATA` is not proof of fraud and is not a Paytm switch lookup.

### Vendor & Exceptions Desk (merged from the separate v4 branch)

- The sixth workbench section provides a vendor receivable example connecting purchase order, GRN, invoice, dated payments/notes and outstanding balance.
- MSMED timing is shown only from recorded supplier/GRN fields. Udyam status, category, activity/NIC code, relevant registration/supply date and source documents are not authenticated by this local fixture.
- The 15-day objection/acceptance and 45-day agreed-term timeline is presented as a workflow aid. Any legal eligibility or claim still needs source verification and legal review.
- The interest output is **illustrative only**. It stays blank until an operator enters and explicitly confirms a bank-rate input and every principal-changing event has a date. The current single-rate model is not a legal/statutory interest statement.
- UPI failed-transaction examples distinguish P2M merchant-confirmation-missing (T+5) from P2P beneficiary-not-credited (T+1). The ₹100/day calculation is a potential scenario for the specified category only; it does not establish that the underlying transaction qualifies.
- The Kirana payout figures and starter vendor invoice are synthetic fixtures. The vendor follow-up button creates a local approval record only; no email, WhatsApp or ERP action is sent.
- The Hinglish query helper is a small deterministic intent router, not general-purpose AI.

See `docs/V4_FEATURE_AUDIT.md` for the detailed merge decision and `docs/LIVE_READINESS_ROADMAP.md` for the path to authorised integrations.

### Import, Sarvam and evidence packet

- Canonical ZIP import validates four core reports before changing the active local dataset; an optional `disputes.csv` can supply case-level POS/courier evidence. The active bundle and dispute list persist in SQLite. If `disputes.csv` is omitted, imported dispute cases are cleared rather than carrying stale fixture cases into a new dataset.
- Raw Paytm-style CSV preview normalises supported column aliases into integer paise and displays which fields were mapped.
- The explicit mapping workflow stores a **staged source record** with operator-supplied capture date, batch ID, payout UTR and payout date. It does not silently turn that one report into a full ledger: bank credits and adjustment completeness still need to be supplied/verified in the canonical bundle.
- Optional Sarvam Chat Completion may select from a backend allow-list of read-only tools. It cannot compute money or execute a sensitive action. The agent uses `sarvam-105b` with reasoning disabled and a short output budget to conserve credits; SaaS/API errors fall back to deterministic tools. Saaras v4 ASR and Bulbul v4 Flash TTS are key-gated. Offline fallback is explicitly labelled; no transcript is fabricated when ASR is unavailable.
- Reference binding uses edit-distance candidates only. Ambiguous or noisy references require user confirmation.
- Four-exhibit PDF includes reconciliation, UTR/bank evidence, order/dispute evidence and voice transcript/absence. For a dispute case it also includes the three-way Merkle root and leaf hashes. It is a local review packet, not a statutory/legal filing or provider submission.

## Important implementation choices versus the pitch deck

The selected deck is the product contract, but a hackathon prototype must not pretend that unavailable provider data or APIs exist. Three implementation choices are deliberate:

1. **No timing-only payout assignment.** `analyse_cutoff_events()` is implemented as a bounded two-pointer event-window analysis over the normalized capture and nodal timestamps, pairing only exact transaction IDs and reporting cross-date, unmatched and ambiguous events. In this local import model both event fields are carried on the same transaction row; production still needs two independently sourced provider feeds and a verified timezone/cutoff contract. Neither timestamps nor proximity assign payout batches: only explicit source batch references do.
2. **SQLite local store, not PostgreSQL `SKIP LOCKED`.** SQLite keeps the demo self-contained and is used for local persistence/idempotency. PostgreSQL worker locking, multi-tenant transactions and concurrent job processing remain a deployment phase.
3. **CSS workbench, not Tailwind utility styling.** The existing React/TypeScript workbench is retained and improved rather than replacing it with a generic dashboard. The interaction is API-driven; the visual system uses project CSS.

These deltas are listed in `docs/PROJECT_AUDIT.md` and `docs/GAP_REGISTER.md`; they are not hidden.

## Live demo deployment (Render)

The project is deployed as two Render services:

- **Frontend:** [SettleGraph Web App](https://settlegraph-frontend-shashank.onrender.com)
- **Backend API:** [SettleGraph API](https://settlegraph-api-shashank.onrender.com)
- **API health endpoint:** [\u002fapi/health](https://settlegraph-api-shashank.onrender.com/api/health)
- **Render Blueprint:** [render.yaml](render.yaml)

The frontend is a React/Vite static site. The backend is a FastAPI web service. The frontend is configured to call the backend through `VITE_API_BASE_URL`, and backend CORS is configured through the `CORS_ORIGINS` environment variable in the Blueprint.

**Deployment limitations:** the backend currently uses SQLite on Render's free service filesystem. Render's free instance filesystem is ephemeral, so uploaded datasets, local approvals and history must not be treated as durable and may be lost when the service restarts or redeploys. The free web service may also spin down after inactivity, causing a delay on the first request. The app remains a synthetic-data prototype; deployment does not add live Paytm, bank, NPCI, POS or courier integrations, nor does it enable real refunds or dispute submissions.

## Windows quick start

Prerequisites: Python 3.11+ and Node.js 20+. Internet is needed for the first dependency installs.

1. Open PowerShell in the project root:

   ```powershell
   .\start_backend.ps1
   ```

   The script creates `backend/.venv`, installs `backend/requirements.txt`, and launches the API at <http://127.0.0.1:8000>. API docs are at <http://127.0.0.1:8000/docs>.

2. Open a second PowerShell terminal in the project root:

   ```powershell
   .\start_frontend.ps1
   ```

   Open <http://127.0.0.1:5173>. In development, Vite proxies `/api` to the local FastAPI service. Set `VITE_API_BASE_URL` only when pointing the frontend at a separately hosted API.

3. Run backend tests:

   ```powershell
   cd backend
   .\.venv\Scripts\Activate.ps1
   python -m pytest -q
   ```

   **Verified in this handoff: 107 backend tests pass.** Python compile checks pass. Global TypeScript 5.8.3 syntax transpilation reports no diagnostics for `App.tsx`, `VendorTab.tsx` and `main.tsx`. The full project type-check/Vite production build and browser smoke test remain unverified because npm registry access failed in this environment; see `docs/IMPLEMENTATION_STATUS.md`.

## Additional product modules and production roadmap

The original shortlisted deck remains the main product story. The Vendor & Exceptions Desk is a useful adjacent module merged from the separate v4 ZIP; it must not be described as a live Udyam/ERP/bank integration.

- [v4 ZIP feature audit and merge decision](docs/V4_FEATURE_AUDIT.md)
- [Live-readiness roadmap, source contracts and file-by-file phases](docs/LIVE_READINESS_ROADMAP.md)
- [Current implementation status](docs/IMPLEMENTATION_STATUS.md)
- [Gap register](docs/GAP_REGISTER.md)
- [Implementation and judge guide](docs/IMPLEMENTATION_AND_JUDGE_GUIDE.md)

## Optional Sarvam setup

Create `backend/.env` from `backend/.env.example` and set the key there, or set process environment variables before starting the API. Never put the key in React code, commit it, or include it in screenshots/demo recordings.

```powershell
Copy-Item backend/.env.example backend/.env
notepad backend/.env
```

Set:

```dotenv
SARVAM_API_KEY=YOUR_KEY
SARVAM_CHAT_MODEL=sarvam-105b
SARVAM_ASR_MODEL=saaras:v4
SARVAM_TTS_MODEL=bulbul:v4-flash
SARVAM_TTS_SPEAKER=shubh_enhi_ads
```

The `.env` loader reads `backend/.env` when the backend imports the Sarvam adapter and does not overwrite variables already set in the process environment. Create/edit the file **before** starting the backend; restart the backend after changing the key or model settings. Test live chat, ASR and TTS on the target network; live provider operation is **not** claimed as verified here. Microphone capture requires browser permission and a secure context (localhost is supported). If the Sarvam network request fails, the agent falls back to the deterministic local path; speech playback can use browser speech synthesis. ASR failure returns no transcript.

## Canonical import bundle

Upload a ZIP with these UTF-8 CSVs (they may be inside a folder in the ZIP):

| File | Required columns |
|---|---|
| `transactions.csv` | `pg_txn_id,source_row_id,gross_paise,capture_ts,status,payout_batch_id` |
| `adjustments.csv` | `adjustment_id,source_row_id,type,amount_paise,direction,batch_id` |
| `settlement_batches.csv` | `batch_id,payout_utr,payout_date,source_row_id` |
| `bank_credits.csv` | `bank_row_id,batch_id,transfer_utr,credit_paise,credit_date,source_file` |
| `disputes.csv` | Optional: `case_id,disputed_paise,utr_rrn,order_id,order_status,invoice_amount_paise,invoice_source_row_id,awb,courier_status,otp_verified,courier_source_row_id` |

Amounts in the canonical bundle are integer paise: `450000` means ₹4,500.00. Optional identifiers such as `utr_rrn`, `order_id`, `reference_id`, `description`, `settlement_reference`, `nodal_settled_ts`, `nodal_amount_paise` and `nodal_source_row_id` are retained. The import requires a target capture date and batch ID. `disputes.csv` is optional: each case is linked only by a unique exact UTR to one loaded payment row; absent or ambiguous links remain unresolved, and the parser never fuzzily joins an evidence case. Validation is atomic: a bad bundle does not replace the active dataset.

For a raw Paytm-style export, use **Preview** first, inspect the header mapping, then use **Stage mapped export** only after matching its capture date, payout batch ID and payout UTR against the appropriate settlement report and bank statement. The stage endpoint is not ledger activation.

## Suggested live demo sequence

1. Start the API and workbench. Open Overview and show the synthetic fixture watermark.
2. Run the ₹50,000 gross example. It reconciles against ₹45,718.60 bank credit with ₹4,281.40 of explicit synthetic adjustments/shifted transactions and zero residual. Highlight that every fee row is a synthetic source row, not a rule applied by the code.
3. Open Evidence Graph and select a source node. Explain the edge's explicit matching reference.
4. Change the bank credit by ₹100 and rerun. Show the 10,000-paise unexplained residual.
5. Open Import and preview the Paytm-style CSV. Stage it with an operator-entered mapping. Show that the active ledger did not silently change.
6. Open Policy Lab. Evaluate clean delivery evidence, then corrupt OTP or invoice amount. Show the three-way Merkle root/leaf proof and policy gate changing.
7. Open Counter Operations. Stage duplicate-debit review; approve or reject it as a local handoff decision. Then sync the local demo POS order with its idempotency key.
8. Use the teammate/voice panel. State which mode is active—live Sarvam or deterministic offline fallback. Do not claim an ASR transcript unless the API returned it.
9. Download the four-exhibit PDF and explicitly call it a local evidence packet, not a live dispute upload.

## API map

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | Local service state and explicit external-integration flags |
| `GET/POST /api/demo/reconcile` | Reconcile fixture and run deterministic fault simulations |
| `POST /api/import-zip` | Validate/persist the canonical four-report bundle |
| `POST /api/import/paytm-csv/preview` | Validate and preview raw Paytm-style CSV |
| `POST /api/import/paytm-csv/stage` | Persist explicit operator mapping without changing active ledger |
| `GET /api/import/staged-paytm-exports` | List staged raw exports |
| `GET /api/import/status` | Active mode/date/batch/row counts |
| `GET /api/integrity/merkle` | Dataset Merkle root, leaves and row inclusion proof |
| `GET /api/graph/overview`, `GET /api/graph/trace/{node_id}` | Evidence graph and source-linked trace |
| `POST /api/agent/investigate`, `POST /api/agent/chat` | Deterministic investigation and optional Sarvam read-only tool selection |
| `POST /api/voice/transcribe`, `/api/voice/bind-reference`, `/api/voice/speak` | Optional ASR, reference candidates and TTS |
| `POST /api/disputes/{case_id}/evaluate` | Synthetic dispute policy and three-way Merkle proof |
| `POST /api/operations/duplicate-debits/check` | Create/retrieve idempotent local approval record |
| `GET /api/approvals`, `POST /api/approvals/{id}/decision` | Local approval queue and manual-handoff decision |
| `GET /api/operations/pos-orders`, `POST /api/operations/orders/{id}/sync` | Local mock POS order and idempotent sync |
| `POST /api/evidence-packet/compile`, `GET /api/evidence-packet.pdf` | Four-exhibit PDF output |
| `GET /api/investigations`, `/api/audit`, `/api/audit/verify` | Local case history and hash-chain status |

## Production gates — do not skip

- Authentication, tenant isolation, RBAC, secure secret storage, encryption at rest/in transit, PII masking/retention and rate limits.
- PostgreSQL schema/migrations, concurrency controls and durable externally anchored audit roots.
- Verified source adapters for actual Paytm merchant settlement reports, bank statements, POS/order and courier evidence, including split/reversal/refund semantics.
- Independent, authoritative capture and nodal event-feed adapters with stable IDs, timezone semantics, clock-skew handling, split-settlement legs and verified batch contracts. The local two-pointer analyser operates only on normalized event fields and does not claim independent upstream feed provenance.
- An authoritative versioned UDIR/RGNB reason-code and workflow catalogue reviewed against current NPCI/Paytm documents. The current policy lab is synthetic.
- Provider contracts, approved credentials, sandbox tests, allow-listed APIs, webhook signature validation, replay protection and human authorisation before any money/dispute write.
- Browser build, responsive/keyboard/accessibility checks and a real target-laptop microphone/network smoke test.

See `docs/PROJECT_AUDIT.md`, `docs/IMPLEMENTATION_STATUS.md`, `docs/GAP_REGISTER.md` and `docs/PHASED_ROADMAP.md` before the final presentation.
