# SettleGraph 0.6 — Judge & Live Demonstration Guide

**Demonstration Duration:** ~3 to 5 minutes  
**Target Audience:** Judges, Fintech Architects, Engineering Evaluators, Product Leads  
**Key Positioning:** *"From fragmented settlement records to connected, explainable and auditable merchant investigations."*  
**Theme:** Paytm-inspired visual language (`#00BAF2`), deterministic integer paise arithmetic, zero autonomous money movement, evidence-backed human review.

---

## 1. Quick Start for the Judge

1. **Verify Backend is running:**
   ```powershell
   # If not already running:
   .\start_backend.ps1
   ```
   Backend service: [http://127.0.0.1:8000](http://127.0.0.1:8000) · OpenAPI Docs: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

2. **Verify Frontend is running:**
   ```powershell
   # If not already running:
   .\start_frontend.ps1
   ```
   Frontend workbench: [http://127.0.0.1:5173](http://127.0.0.1:5173)

3. **Verify automated tests (optional 10-second proof):**
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\verify_project.ps1
   ```
   Expected result: **121 passed pytest tests + clean TypeScript typecheck + production build**.

---

## 2. 3-Minute Live Demonstration Walkthrough Script

### Step 1: Merchant Command Centre (0:00 - 0:45)
1. Open [http://127.0.0.1:5173#dashboard](http://127.0.0.1:5173#dashboard).
2. **Point out the Top Demo Banner:**
   - Clearly states: *"Synthetic Merchant Operational Dataset · No Live Money Movement"*.
   - Features 3 preset audit scenarios: **Scenario A (Clean)**, **Scenario B (Discrepancy)**, **Scenario C (Conflicting Evidence)**.
3. **Walk through the 6 Executive KPI Tiles:**
   - **Total Payment Volume (TPV):** ₹52,999.00 across 143 payments.
   - **Expected Settlement:** ₹45,718.60 for Batch `BATCH-2026-10-27`.
   - **Actual Bank Credit:** ₹45,718.60 matching HDFC statement UTR.
   - **Outstanding Variance:** ₹0.00 (Reconciled).
   - **Reconciliation Rate:** 90.85% (4 unassigned cutoff rows shifted to other batches).
   - **Pending Exceptions:** 12 categorized items.
4. **Interactive Financial Visualizations:**
   - Hover over points on the **7-Day Settlement Trend Area Chart** to demonstrate daily volume vs expected net vs confirmed bank credits.
   - Explain the **Payment Instrument Share** showing UPI Direct dominance (91.5%) vs RuPay Credit Cards (8.5%).
   - Show the **Exception Ageing** analysis (`<24h`, `24–48h`, `>48h`).

---

### Step 2: Inject Discrepancy — Scenario B (0:45 - 1:15)
1. Click the **Scenario B (₹100 Shortfall)** pill in the top banner.
2. Watch the toast notification appear:
   *`"Scenario B activated: Settlement Discrepancy. Bank credit is short by ₹100.00 and MDR debit fee is increased by ₹10.00..."`*
3. Notice how the **Outstanding Variance** card instantly turns red with **₹110.00 UNEXPLAINED VARIANCE**, and the Trend Chart flags the shortfall.
4. Emphasize to the judge:
   *"SettleGraph doesn't guess or sweep variance under the rug. It calculates exact integer paise discrepancies and builds an evidence graph to explain why."*

---

### Step 3: Signature Feature — Interactive Settlement Graph (1:15 - 2:15)
1. Click the **Settlement Graph** tab in the sidebar (or press `Ctrl+K` and type `PTM-TXN-1001`).
2. **Interact with the Graph Canvas:**
   - Drag to pan across the hierarchical layout.
   - Use the mouse wheel or `+` / `−` controls to zoom in and out.
   - Notice the distinct entity color coding:
     * **Merchant** (Dark Navy `#0f172a`)
     * **Settlement Batch** (Paytm Blue `#00baf2`)
     * **Payment** (Indigo `#1d4ed8`)
     * **Orders** (Purple `#6d28d9`)
     * **Bank Credits** (Emerald `#047857`)
     * **Fee Adjustments** (Amber `#b45309`)
     * **Dispute Evidence** (Teal `#0f766e`)
     * **Exceptions** (Crimson `#b91c1c` with dashed relation lines)
     * **Investigations & Decisions** (Magenta & Slate)
3. **Select a Node:**
   - Click on node `ADJ-EDI-01` or `BATCH-2026-10-27`.
   - See connected nodes highlighted in cyan; unrelated nodes gently dim.
   - The **Slide-Over Detail Drawer** smoothly opens on the right.
4. **Demonstrate Path Tracing & Direct Case Opening:**
   - Click **Trace Path to Bank**: The backend computes the shortest NetworkX path (`ADJ-EDI-01` → `BATCH-2026-10-27` → `BANK-ROW-0001`).
   - Click **Open Investigation**: Prefills the case creation form and opens the investigation workspace directly from the graph node!

---

### Step 4: Reconciliation Studio (2:15 - 3:00)
1. Click the **Reconciliation Studio** tab.
2. Point out the **Visual Reconciliation Pipeline**:
   *`Captured (₹52,999.00) → Batch Gross (₹50,000.00) − Debit Fees (₹4,281.40) = Expected Net (₹45,718.60) vs Bank Statement → Verdict`*
3. Show the **Drag & Drop Ingestion Zone**: Accepts standard 4-report ZIP bundles or raw Paytm exports.
4. Filter between tabs:
   - **Matched (139):** Reconciled with batch and statement.
   - **Unassigned / Missing (4):** Unassigned payments flagged for human cutoff review.
   - **Shifted Cutoff:** Transactions assigned to next day's batch.
5. Click on any transaction row:
   - The **Transaction Detail Drawer** opens showing exact gross paise, commission, GST, nodal timestamp, and match diagnosis.

---

### Step 5: Investigation Workspace & Refresh Persistence (3:00 - 3:45)
1. Click the **Investigations & Decisions** tab.
2. Select an active investigation from the left register.
3. Review the **4-Part Evidence Checklist**:
   - Payment Transaction Record (Verified)
   - Settlement Batch Assignment (Verified)
   - Bank Statement Credit (Shortfall identified)
   - Dispute Merkle Proof (Calculated)
4. **Add an Operator Follow-up Note:**
   - In the note input, type:
     *"Spoke with Paytm merchant desk; batch adjustment discrepancy confirmed."*
   - Click **Add Note**. Watch it instantly append to the chronological notes timeline.
5. **Record an Operator Decision:**
   - In the decision rationale box, type:
     *"Approved for manual ledger credit note adjustment."*
   - Click **Approve Resolution**.
   - Watch the investigation badge turn green: **RESOLVED (APPROVE_RESOLUTION)**.
6. **The Ultimate Proof: Browser Refresh Test (Persistence):**
   - Press **F5** or click the browser's reload button.
   - Point out that:
     1. The application returns to the **exact same tab** (`#audit`) thanks to URL hash routing.
     2. The investigation remains in **RESOLVED** state.
     3. The newly added operator note is **completely preserved** in SQLite!
     4. The cryptographic audit trail has recorded the decision with SHA-256 integrity!

---

### Step 6: 4-Exhibit PDF Review Packet (3:45 - 4:15)
1. Click **Compile 4-Exhibit PDF Packet**.
2. Download and open `SettleGraph_Four_Exhibit_Evidence_Packet.pdf`.
3. Show the 4 exhibits:
   - Exhibit A: Settlement Reconciliation Bridge
   - Exhibit B: Bank Statement & UTR Verification
   - Exhibit C: 3-Way Dispute Merkle Proof (Nodal + POS + Courier)
   - Exhibit D: Operator Audit Decisions & Voice Transcript Log

---

### Step 7: Reset Demo & Conclusion (4:15 - 4:45)
1. Click **Reset Demo Data** in the top banner.
2. A confirmation modal appears preventing accidental data destruction.
3. Click **Reset to Baseline**.
4. The system cleanly returns to Scenario A with ₹0 residual.
5. **Closing Statement:**
   *"SettleGraph v0.6 bridges the gap between fragmented bank statements, payment gateways, and merchant POS systems into an explainable, interactive settlement intelligence platform."*

---

## 3. Judge FAQ & Technical Talking Points

**Q1: Is SettleGraph making real money transfers or refunds?**  
*Answer:* No. SettleGraph is an evidence-first review and intelligence workbench. It strictly stages proposals for human approval. Autonomous money movement is disallowed by design.

**Q2: How are financial calculations handled?**  
*Answer:* Exclusively in integer paise with Python `Decimal` conversions. Floating-point arithmetic is never used for financial calculations to prevent rounding drift.

**Q3: How does the Settlement Graph work?**  
*Answer:* The backend constructs a directed NetworkX graph connecting Merchant, Batches, Payments, Orders, Adjustments, Bank Credits, Disputes, Exceptions, Investigations, and Decisions based on verified reference IDs. The frontend renders this dynamically via SVG with zoom, pan, entity filtering, and path tracing.

**Q4: How does Sarvam AI fit into this?**  
*Answer:* Sarvam AI is key-gated and strictly read-only. When configured, it powers Hindi/Hinglish chat and voice queries. However, no LLM is ever allowed to calculate currency or execute transactions. When unconfigured, the system gracefully falls back to deterministic local tool execution.

