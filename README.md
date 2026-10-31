# SettleGraph 0.6 — Merchant Settlement Intelligence Platform

**Evidence-backed merchant settlement intelligence & exception-resolution platform** · Independent fintech workbench

SettleGraph connects merchant-side payment, settlement, fee adjustment, bank statement, POS order and courier delivery evidence so an operator can understand payout discrepancies, reconcile fragmented accounts, investigate exceptions with explainable graph reasoning, and record auditable human decisions.

> **Key Differentiator:** *"From fragmented settlement records to connected, explainable and auditable merchant investigations."*
>
> **Honest Runtime Boundary:** Built-in fixtures are synthetic. The workbench runs locally with SQLite persistence and supports uploaded local CSVs and ZIP bundles. There is no live Paytm, NPCI, core bank, courier, or POS connection, no autonomous refund execution, and no live dispute submission. It assists human operators; it does not make financial decisions autonomously.

---

## What is Functional in SettleGraph 0.6

### 1. Interactive Merchant Command Centre
- **6-Metric Executive KPI Grid:** Real-time visibility into Total Payment Volume (TPV), Net Expected Payout, Actual Bank Statement Credit, Outstanding Residual Gap, Reconciliation Rate %, and Open Exceptions.
- **7-Day Settlement Trend Financial Chart:** Interactive SVG visualization comparing gross volume, net expected, and confirmed bank credits over time with hover tooltips.
- **Payment Channel Breakdown:** Distribution and percentage share across UPI Direct, RuPay Credit Cards, Netbanking, and Wallets.
- **Exception Root-Cause Intelligence & Ageing:** Categorized anomaly tracking (Bank Shortfall, Cutoff Variance, MDR Fee Discrepancy, Disputed Delivery) with `<24h`, `24–48h`, and `>48h` ageing analysis.
- **Quick Operations Bar:** 1-click access to all core modules.

### 2. Signature Feature: Interactive Settlement Graph
- **Connected Multi-Tier Graph:** Visualizes directional relationships across:
  `Merchant → Settlement Batch → Payment → Order → Settlement Line → Fee Adjustment → Bank Credit → Evidence → Exception → Investigation → Operator Decision`.
- **Interactive Canvas Engine:** Smooth drag-to-pan, wheel zoom, zoom controls (`+`, `−`, reset), and auto-centering.
- **Entity Type Filtering:** Instant filtering pills across 10 entity categories.
- **Visual Highlight for Anomalies:** Unassigned transactions, unknown fees, and open disputes are highlighted with warning borders and dashed relations.
- **Slide-Over Node Detail Drawer:** Click any node to inspect metadata, copy reference IDs, trace the shortest NetworkX path to bank credit, or launch an investigation directly from the node.
- **Instant Search & Jump:** Real-time node search by Transaction ID, Order ID, UTR, or Batch ID.

### 3. Reconciliation Studio
- **Drag-and-Drop Ingestion:** Drag and drop canonical 4-report ZIPs or raw Paytm merchant CSV exports with animated drop states.
- **Visual Reconciliation Flow Pipeline:** Step-by-step arithmetic bridge:
  `Captured Volume → Batch Gross − Debit Adjustments = Expected Net vs Bank Credit → Reconciliation Verdict`.
- **Raw Paytm CSV Normalization:** Converts decimal currency strings to integer paise and previews column mapping before staging.
- **Tabbed Transaction Analysis:** Segmented tables for All, Matched (139), Unassigned / Missing Reference (4), Shifted Cutoff, and Fee Adjustments.
- **Transaction Detail Drawer:** Displays exact gross, commission, GST, net, nodal timestamp, and match failure diagnosis.

### 4. Investigation Workspace & Decision Workflows
- **Case Register:** Persisted in SQLite `investigations` table with status filters (`ALL`, `OPEN`, `RESOLVED`, `REJECTED`).
- **4-Part Evidence Checklist:** Verifies Payment PG record, Settlement Batch reference, Bank Statement credit, and Dispute Merkle proof.
- **Operator Notes Timeline Feed:** Append timestamped follow-up notes that persist immediately across page refreshes.
- **Operator Resolution Decision:** Staged `APPROVE_RESOLUTION` or `REJECT_RESOLUTION` decisions with rationale notes.
- **Case Reopening:** Ability to reopen resolved investigations if new bank statements or evidence emerge.
- **Cryptographic Audit Chain:** Every investigation, note, and decision is hashed into a SHA-256 linked local audit chain.

### 5. Judge-Ready 3-Scenario Demo Mode
- **Top Demo Banner:**
  - **Scenario A (Normal Settlement):** 100% matched payments, ₹0 residual, clean reconciliation baseline.
  - **Scenario B (Settlement Discrepancy):** Injects ₹100 bank credit shortfall and ₹10 MDR fee delta; highlights unexplained variance in graph and metrics.
  - **Scenario C (Conflicting Evidence):** Injects unassigned late cutoff transaction and unclassified fee adjustment; requires operator investigation.
- **Reset Demo Data Action:** Cleanly restores the baseline dataset with a safety confirmation modal.
- **Refresh Persistence:** URL hash routing preserves the active tab and all SQLite records across browser reloads.

### 6. Dispute Policy Lab & Counter Operations
- **3-Way Merkle Dispute Verification:** Binds Nodal, POS Invoice, and Courier delivery proofs into verifiable leaf and root hashes.
- **Controlled Fault Injection:** Corrupt OTP, alter invoice amount, contradict courier status, or simulate duplicate debit.
- **Duplicate Debit Shield:** Idempotent detection of identical order ID + paise amount within 120s; stages proposal for human review.
- **Mock POS Order Sync:** Changes local mock POS order state from `PAYMENT_PENDING` to `PAID` idempotently.
- **Vendor & Exceptions Desk:** 3-way PO/GRN/Invoice match, MSMED Act 15/45-day calculation, RBI illustrative bank rate toggle, Kirana decomposition, and RBI failed TAT monitor.
- **Merchant AI Teammate & Voice:** Read-only tool loop. When Sarvam is configured, supports Hindi/Hinglish chat and Saaras ASR; when unconfigured, falls back to deterministic local tool execution without claiming live model output.

---

## Technical Constraints & Data Integrity

- **Integer Paise Calculations:** All monetary arithmetic uses integer paise with Python `Decimal`. Binary floating-point math is strictly avoided.
- **Authoritative References:** Payout batches and bank linkages require explicit, source-recorded reference IDs; membership is never inferred from timestamps alone.
- **Human Authority:** The platform does not make financial decisions or execute money movement autonomously.

---

## Quick Start (Windows)

## Live demo deployment (Render)

The project is deployed as two Render services:

- **Frontend:** [SettleGraph Web App](https://settlegraph-frontend-shashank.onrender.com)
- **Backend API:** [SettleGraph API](https://settlegraph-api-shashank.onrender.com)
- **API health endpoint:** [/api/health](https://settlegraph-api-shashank.onrender.com/api/health)
- **Render Blueprint:** [render.yaml](render.yaml)

The frontend is a React/Vite static site. The backend is a FastAPI web service. The frontend is configured to call the backend through `VITE_API_BASE_URL`, and backend CORS is configured through the `CORS_ORIGINS` environment variable in the Blueprint.

**Deployment limitations:** the backend currently uses SQLite on Render's free service filesystem. Render's free instance filesystem is ephemeral, so uploaded datasets, local approvals and history must not be treated as durable and may be lost when the service restarts or redeploys. The free web service may also spin down after inactivity, causing a delay on the first request. The app remains a synthetic-data prototype; deployment does not add live Paytm, bank, NPCI, POS or courier integrations, nor does it enable real refunds or dispute submissions.

---

Prerequisites: Python 3.11+ and Node.js 20+.

### 1. Launch Backend API
```powershell
.\start_backend.ps1
```
- API Base: [http://127.0.0.1:8000](http://127.0.0.1:8000)
- OpenAPI Documentation: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

### 2. Launch Frontend Workbench
```powershell
.\start_frontend.ps1
```
- Open [http://127.0.0.1:5173](http://127.0.0.1:5173) in your browser.

### 3. Verify Project Integrity
```powershell
powershell -ExecutionPolicy Bypass -File .\verify_project.ps1
```
Runs:
1. Backend python compile check (`compileall`).
2. Backend pytest regression suite (**121 passed tests**).
3. Frontend TypeScript transpilation (`npm run typecheck`).
4. Frontend production build (`npm run build`).

---

## API Map (v0.6)

| Method & Route | Purpose |
|---|---|
| `GET /api/health` | Service state, external flags, and Sarvam configuration status |
| `GET /api/dashboard/stats` | Executive KPI figures, 7-day trend, channel share, and ageing |
| `POST /api/demo/scenario/{id}` | Instant 1-click activation of Demo Scenario A, B, or C |
| `GET /api/demo/reconcile`, `POST /api/demo/reconcile` | Deterministic reconciliation calculation and fault simulation |
| `POST /api/demo/reset` | Restore baseline synthetic source reports |
| `GET /api/graph/overview` | Full multi-tier connected evidence graph (450+ nodes & edges) |
| `GET /api/graph/trace/{node_id}` | NetworkX shortest path trace from source node to bank credit |
| `GET /api/investigations`, `POST /api/investigations` | List and create persisted investigations |
| `GET /api/investigations/{id}` | Retrieve comprehensive investigation detail and notes |
| `POST /api/investigations/{id}/notes` | Append operator follow-up note to investigation |
| `POST /api/investigations/{id}/decision` | Record operator resolution decision (`APPROVE` / `REJECT`) |
| `POST /api/investigations/{id}/reopen` | Reopen resolved case for re-audit |
| `POST /api/import-zip` | Ingest and validate canonical 4-report ZIP bundle |
| `POST /api/import/paytm-csv/preview` | Preview raw Paytm merchant CSV with paise column mapping |
| `POST /api/import/paytm-csv/stage` | Stage mapped export without altering active ledger |
| `GET /api/integrity/merkle` | Dataset Merkle root and per-record inclusion proofs |
| `POST /api/disputes/{case_id}/evaluate` | 3-way Merkle evaluation with controlled fault injection |
| `POST /api/operations/duplicate-debits/check` | Scan active payments for duplicate debit candidates |
| `GET /api/approvals`, `POST /api/approvals/{id}/decision` | Local approval queue and manual handoff decisions |
| `POST /api/operations/orders/{id}/sync` | Idempotent mock POS order sync |
| `POST /api/evidence-packet/compile` | Compile 4-exhibit review PDF |
| `GET /api/audit`, `GET /api/audit/verify` | SHA-256 linked cryptographic audit chain verification |

---

## Documentation Index

- [Full Functional Audit (Phase 1)](docs/FUNCTIONAL_AUDIT.md)
- [Implementation Report & Feature Classification](docs/IMPLEMENTATION_REPORT.md)
- [Judge & Live Demonstration Guide](docs/DEMO_GUIDE.md)
- [Live Readiness Roadmap & Production Contracts](docs/LIVE_READINESS_ROADMAP.md)
- [API Credentials & Integration Setup Guide](docs/INTEGRATION_SETUP_GUIDE.md)
