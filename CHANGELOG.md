# Changelog

## 0.5.0 — GOAT + v4 feature merge

- Kept the stronger Paytm-aligned settlement/evidence/import/voice core from the GOAT code line.
- Integrated the separate v4 Vendor & Exceptions Desk as a sixth workbench section.
- Added PO/GRN/invoice matching, dated partial-payment ledger, MSME eligibility/date workflow aid, local follow-up approval, Kirana payout fixture and exception inbox.
- Hardened vendor interest: no amount is shown until the operator confirms a bank-rate input and dated principal events are complete; result is expressly illustrative, not a legal/accounting determination.
- Split failed-transaction TAT examples into specified UPI P2M T+5 and P2P T+1 categories; no generic ₹100/day UDIR/RGNB penalty.
- Merged duplicate capture handling with the active transaction dataset; grouped 3+ connected captures into one review candidate and stopped calling a candidate amount a confirmed overpayment when invoice total is absent.
- Made objection/resolution evaluation as-of aware so future events do not rewrite historical snapshots.
- Corrected Sarvam-105B V1 reasoning disable field to JSON null and kept Bulbul v4 Flash TTS `language_code` payload.
- Backend verification: **107 pytest tests pass**. Python compile and frontend TSX syntax transpilation pass. Full npm type-check/Vite build/browser E2E remains unverified because npm registry access was unavailable.

## 0.4.0 — Stage 2 GOAT hardening (retained)

- Reconciler uses integer paise and explicit source batch references; bounded capture-to-nodal timing analysis is exact-ID-only and does not assign batches.
- Added three-way dispute evidence leaves and blocked missing nodal amount, nodal source ID and payment-to-order gaps from appearing complete.
- Added optional `disputes.csv` to the canonical sample bundle.
- Added active-dataset duplicate-debit review, local idempotent approval and mock POS payment sync.
- Improved Paytm-style CSV preview/staging, Sarvam fallback, four-exhibit PDF and Windows launch scripts.

## Verification boundary

This is a local hackathon prototype using synthetic or operator-supplied files. No live Paytm, NPCI, bank, courier, ERP, Udyam or merchant POS integration, refund, money movement or dispute submission is enabled. Authentication, tenant isolation, PostgreSQL concurrency, production security and controlled merchant pilot remain future work.
