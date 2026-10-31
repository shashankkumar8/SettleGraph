# SettleGraph 0.6 — Full Functional Audit & Technical Gap Analysis

**Date:** 2026-10-31  
**Auditor:** Senior Product Engineer & Fintech Architecture Lead  
**Target Build:** SettleGraph Merchant Workspace v0.5.3 → v0.6 Upgrade  
**Repository Working Directory:** `SettleGraph_Merchant_Workspace_v0.5.3`  
**Runtime Boundary:** Synthetic merchant operational datasets; local SQLite persistence; explicit external provider guardrails.

---

## 1. Executive Summary

This functional audit systematically inspects all backend endpoints, data models, state persistence, frontend components, and user workflows in the existing SettleGraph v0.5.3 codebase. 

The application possesses strong foundational backend logic:
- Deterministic integer paise financial calculations with `Decimal` conversions.
- Atomic CSV and ZIP canonical bundle validation.
- SQLite persistence for active datasets, staged imports, human approvals, and hash-chained audit trails.
- 117 passing automated backend pytest tests.

However, several critical functional, visual, and architectural gaps exist that prevent it from being a demonstration-ready, interactive merchant fintech workspace:
1. **Absence of an Executive Merchant Command Centre:** No unified overview dashboard with macro KPIs (TPV, Net Expected, Bank Received, Discrepancy, Reconciliation Rate %, Exception Counts) and interactive financial charts.
2. **Missing Interactive Settlement Graph:** The current "Evidence Graph" consists merely of an HTML `<select>` dropdown and a static 3-box linear chain (`div.path-flow`). There is no interactive node-and-edge graph visualization with zoom, pan, hover tooltips, node detail panels, entity filtering, connection highlighting, or direct investigation launching.
3. **Incomplete Investigation Workflow:** Investigations in SQLite are write-only rows (`id, status, residual_paise, note, source_node_id, snapshot_sha256`). There is no mechanism to view investigation detail drawers, update investigation status, append follow-up operator notes, approve/reject resolution proposals, or reopen cases.
4. **Reconciliation Studio Usability:** Lacks drag-and-drop file upload with visual drop states, column mapping previews, dedicated matched vs. unmatched transaction views, and transaction-level match failure reasoning.
5. **Absence of Structured 3-Scenario Demo Mode:** Scenario testing is limited to manual checkbox toggles rather than judge-ready preset scenarios (Scenario A: Normal Settlement, Scenario B: Settlement Discrepancy, Scenario C: Conflicting/Missing Evidence) with one-click transitions and guided walkthrough steps.
6. **Navigation & Persistence on Refresh:** Tab selection is held in transient React state without URL hash routing, meaning any page reload resets the operator to the first tab.

---

## 2. Feature-by-Feature Functional Audit Matrix

| Feature / Screen Component | Implemented? | Actually Works? | Persists Data? | Backend Connected? | Currently Simulated? | Functional Status & Known Deficiencies |
|---|:---:|:---:|:---:|:---:|:---:|---|
| **Health Check & Service Flags** (`GET /api/health`) | Yes | Yes | Memory / Env | Yes | Yes (flags) | Fully operational. Accurately reports synthetic mode, disabled money movement, and Sarvam configuration status. |
| **Merchant Dashboard / Command Centre** | Partial | Partial | Yes (SQLite) | Yes | Yes | Only 4 basic metric tiles in "Settlement run". No KPI cards for TPV, Net Settlement, Reconciled %, or Pending Exceptions. No interactive visual charts. |
| **Interactive Settlement Graph** | Incomplete | Broken / Missing | No | Partial | Yes | **Critical Gap**: Backend calculates NetworkX graph, but frontend only renders an HTML `<select>` and a static 3-box horizontal flowchart. No canvas/SVG graph, no zoom/pan, no node filtering, no edge labels, no node search. |
| **Reconciliation Engine** (`POST /api/demo/reconcile`) | Yes | Yes | Yes (SQLite) | Yes | Yes | Works reliably. Converts decimal currency to integer paise. Aggregates bank credits and calculates residual accurately. |
| **Canonical ZIP Import** (`POST /api/import-zip`) | Yes | Yes | Yes (SQLite) | Yes | Real files parsed | Fully functional. Validates 4 required CSVs (transactions, adjustments, settlement_batches, bank_credits) + optional disputes. |
| **Raw Paytm CSV Preview & Stage** (`POST /api/import/paytm-csv/*`) | Yes | Yes | Yes (SQLite) | Yes | Real CSV parsed | Works. Extracts transaction amounts into integer paise and stages without changing the active ledger. Missing interactive custom column mapping. |
| **Matched vs Unmatched Transaction Analysis** | Partial | Partial | Yes | Yes | Yes | Reconciler flags unassigned transactions, but UI only shows a single paginated table of 12 rows with text search. No matched/unmatched/discrepancy tabbed filtering. |
| **Investigation Creation** (`POST /api/investigations`) | Yes | Yes | Yes (SQLite) | Yes | Yes | Creates row in `investigations` table and logs audit event. |
| **Investigation Workspace & Lifecycle** | Incomplete | Incomplete | Partial | Partial | Yes | **Critical Gap**: No endpoint or UI to update investigation status (OPEN, IN_PROGRESS, RESOLVED, REJECTED), append operator follow-up notes, approve/reject resolution, or reopen cases. |
| **Evidence Linking & Merkle Integrity** (`GET /api/integrity/merkle`) | Yes | Yes | Yes (SQLite) | Yes | Yes | Merkle tree builds leaf hashes for transactions, adjustments, batches, and bank credits. Inclusion proofs verify. |
| **Dispute Policy Lab** (`POST /api/disputes/{id}/evaluate`) | Yes | Yes | Yes (SQLite) | Yes | Yes | 3-way Merkle tree (Nodal + POS + Courier). Deterministic fault injection (OTP, amount, courier status). External submission correctly disabled. |
| **Duplicate Payment Detection & Approval Queue** | Yes | Yes | Yes (SQLite) | Yes | Yes | Detects exact order ID + paise amount within 120s. Staged approval record stored idempotently. Approve/Reject decisions recorded locally. |
| **Mock POS Order Sync** (`POST /api/operations/orders/{id}/sync`) | Yes | Yes | Yes (SQLite) | Yes | Yes | Mock POS state changes from PAYMENT_PENDING to PAID idempotently. |
| **Vendor & Exceptions Desk** (`/api/vendor/*`, `VendorTab.tsx`) | Yes | Yes | Yes (SQLite) | Yes | Yes | 3-way PO/GRN/Invoice match, MSMED Act 15/45-day calculation, RBI bank rate toggle, Kirana breakdown, RBI failed TAT calculator. |
| **Sarvam AI & Voice Interface** | Yes | Key-gated | Audit log | Yes | Fallback active | When `SARVAM_API_KEY` is absent, falls back to deterministic tools and browser speech synthesis. Audio upload requires key; fails with raw error if not set. |
| **Audit Trail & Cryptographic Chain** (`GET /api/audit/verify`) | Yes | Yes | Yes (SQLite) | Yes | Yes | SHA-256 linked audit hash chain verifies internal consistency from genesis hash. |
| **Four-Exhibit PDF Generation** (`POST /api/evidence-packet/compile`) | Yes | Yes | Ephemeral | Yes | Yes | Generates 4-exhibit PDF with ReportLab. |
| **Navigation & Routing** | Partial | Partial | No | N/A | Frontend state | Single-page state tabs. Reloading drops selected tab and state. No URL hash/query sync. |
| **Demo Mode & Scenario Switcher** | Incomplete | Incomplete | Partial | Yes | Yes | Manual simulation toggles exist, but no explicit 3-scenario selector (Scenario A, B, C) with guided walkthrough. |
| **Error & Empty States** | Partial | Partial | N/A | Yes | N/A | Errors displayed as banner alerts; missing skeleton loading and rich interactive empty states. |
| **Mobile & Responsive Layout** | Partial | Partial | N/A | N/A | CSS | Functional desktop sidebar; needs improved mobile drawer, responsive data tables, and touch-friendly controls. |

---

## 3. Detailed Technical Deficiencies by Phase

### Phase 2: Functional & Backend Gaps
1. **Investigation Management Endpoints Missing:**
   - Only `POST /api/investigations` exists.
   - Missing:
     - `GET /api/investigations/{id}`: Detailed view including linked transaction, evidence sources, timeline, and decision history.
     - `POST /api/investigations/{id}/notes`: Add operator notes with timestamps.
     - `POST /api/investigations/{id}/decision`: Record APPROVE_RESOLUTION or REJECT_RESOLUTION with operator signature.
     - `POST /api/investigations/{id}/reopen`: Reopen resolved investigations.
     - `PATCH /api/investigations/{id}/status`: Change status (OPEN, UNDER_INVESTIGATION, RESOLVED, REJECTED).
2. **Graph Overview Nodes Incomplete:**
   - `/api/graph/overview` currently returns only 5 node types: `settlement_batch`, `payment`, `settlement_line`, `adjustment`, `bank_credit`.
   - Missing from the graph: `merchant`, `order`, `dispute_evidence`, `exception`, `investigation`, `operator_decision`.
   - To deliver the promised "Merchant to Decision" graph, these entities and their directional edges must be included.
3. **Database Schema Limitations:**
   - `investigations` table in SQLite does not have fields for `updated_at`, `closed_at`, `assigned_to`, `decision`, `decision_by`, `decision_note`, `notes_json`.
   - Adding these columns (with backward-compatible migrations) will enable full persistence across restarts.

### Phase 3 & 4: Command Centre & Visual Analytics
1. **Lack of Executive Metrics:**
   - Merchants need an immediate glance at Total Payment Volume, Expected Payout, Actual Bank Credit, Net Variance, Reconciliation Rate %, and Open Exceptions.
2. **Missing Charts:**
   - No graphical representation of payout trends, expected vs. received amounts, transaction volume distribution, or exception ageing.
   - Existing UI relies entirely on plain HTML tables and 4 metric boxes.

### Phase 5: Settlement Graph Signature Experience
1. **Current State:**
   - `App.tsx` lines 668-682 render a `<select>` dropdown and a 3-box DOM list.
2. **Required Upgrade:**
   - An interactive HTML5 Canvas / SVG Node-Edge graph visualization.
   - Node styling per entity type (Merchant = Navy, Batch = Blue, Payment = Indigo, Bank = Emerald, Exception = Amber/Red, Investigation = Purple).
   - Pan, zoom, node drag, reset view, and search box highlighting.
   - Click node to open a slide-over Detail Drawer with full metadata and direct actions ("Investigate Exception", "Trace Bank Path", "View Raw Source Row").

### Phase 6: Reconciliation Studio
1. **Upload & Mapping:**
   - Currently, file upload is a basic file input button without drag-and-drop feedback.
   - No interactive preview allowing users to inspect matched columns vs unmapped columns.
2. **Reconciliation Analysis:**
   - Need clear segmentation: Matched (100%), Unmatched Reference (0%), Amount Discrepancy, Late Shifted Batch.
   - Detailed per-transaction explanation of why a match succeeded or failed.

### Phase 7: Investigation Workspace
1. **Interactive Case Resolution:**
   - Operators need a dedicated Investigation Workspace with an active case viewer, evidence timeline, side-by-side transaction vs bank comparison, and approval action controls.
   - Full persistence so any refreshed page retains all decisions.

### Phase 8: AI & Voice Interface Integrity
1. **Honest Fallback:**
   - If Sarvam API key is not configured, the UI must clearly state "Voice AI: Not Configured (Using Offline Fallback)" and offer immediate keyboard text search without broken audio requests.
   - Live microphone recording must have permission state handling and timer limit.

### Phase 10: Judge-Ready Demo Mode
1. **3 Guided Scenarios:**
   - Scenario A: **Normal Settlement** (Clean reconciliation, ₹0 residual, 100% matched).
   - Scenario B: **Settlement Discrepancy** (₹100 bank credit shortfall, explicit fee variance, exception flagged).
   - Scenario C: **Missing / Conflicting Evidence** (Unassigned late row, contradictory courier status or duplicate payment).
2. **One-Click Switcher:**
   - Preset buttons at the top of the app allowing judges to instantly toggle between Scenarios A, B, and C with explanatory toasts and zero configuration.

---

## 4. Remediation Plan

1. **P0 (Backend & Schema):**
   - Extend `store.py` with full investigation lifecycle methods (`get_investigation`, `update_investigation_status`, `add_investigation_note`, `decide_investigation`, `reopen_investigation`).
   - Add corresponding FastAPI endpoints in `main.py`.
   - Enrich `/api/graph/overview` to include Merchant, Order, Exception, Investigation, and Decision nodes and edges.
   - Ensure integer paise arithmetic and backward compatibility with existing tests.

2. **P1 (Reconciliation & Investigation UI):**
   - Build Reconciliation Studio with drag-and-drop file upload, column mapping preview, matched/unmatched tabs, and transaction detail drawer.
   - Build Investigation Workspace with full case timeline, notes history, and decision buttons.

3. **P2 (Interactive Settlement Graph):**
   - Build high-performance, interactive SVG/Canvas Settlement Graph component with node physics/hierarchical layout, zoom, pan, hover tooltips, entity filters, search, and detail drawer.

4. **P3 (Merchant Command Centre & Analytics):**
   - Build Executive Dashboard with KPI cards, interactive SVG financial charts (settlement trend, expected vs actual, payment channel breakdown, exception distribution).

5. **P4 (Demo Mode & Polish):**
   - Add 3-scenario demo switcher (Scenario A, B, C) with reset confirmation modal.
   - Integrate toast system, global search, and URL hash routing.

6. **P5 (Verification):**
   - Run backend tests (117+ tests).
   - Run frontend typecheck and build.
   - Verify persistence across browser reloads.

