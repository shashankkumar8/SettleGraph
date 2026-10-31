# Changelog

## 0.5.2 — Reliability and integration-readiness hardening

- Added bounded chunked upload reads for ZIP, CSV and audio endpoints. ZIP expansion also has per-file, total-uncompressed-size and compression-ratio limits.
- Added `/api/integrations/status` and an operator-facing Integration Readiness panel. A configured API key is explicitly distinguished from a successfully tested provider connection.
- Tightened CORS parsing to explicit bare HTTP(S) origins only; wildcard, URL paths and duplicate origins are rejected.
- Updated `verify_project.ps1` so it exits with an incomplete result when frontend dependencies are missing instead of reporting successful completion after skipping the build.
- Pinned direct frontend dependency versions and made `npm run build` execute TypeScript type-checking before Vite bundling.
- Added CORS regression coverage. Backend test suite: **114 passed**.
- The npm dependency install timed out in this environment. Full TypeScript project type-check, Vite production build and browser E2E remain unverified and must be run on the target Windows laptop.

## 0.5.1 — Paytm workbench and vendor exception workflows

- Retained deterministic integer-paise settlement reconciliation, explicit batch references, evidence graph, dataset/dispute Merkle proofs and Break-the-Case policy lab.
- Added the Vendor & Exceptions Desk: PO/GRN/invoice workflow, dated partial payments, MSME timeline aid, UPI TAT scenarios, duplicate-capture review and a synthetic Kirana payout example.
- Hardened vendor interest: it remains an explicitly illustrative calculation and requires operator-confirmed bank-rate input plus dated principal-changing events.
- Split failed-transaction TAT examples into the specified UPI P2M T+5 and P2P T+1 categories; no generic ₹100/day UDIR/RGNB penalty.
- Made vendor objection/resolution evaluation as-of aware and grouped connected multi-capture cases into a single review candidate.
- Kept Sarvam-105B V1 reasoning disabled with JSON null and the Bulbul v4 Flash `language_code` payload.

## 0.4.0 — Stage 2 local prototype hardening

- Reconciler uses integer paise and explicit source batch references; bounded capture-to-nodal timing analysis is exact-ID-only and does not assign batches.
- Added three-way dispute evidence leaves and blocked missing nodal amount, nodal source ID and payment-to-order gaps from appearing complete.
- Added optional `disputes.csv` to the canonical sample bundle.
- Added active-dataset duplicate-debit review, local idempotent approval and mock POS payment sync.
- Improved Paytm-style CSV preview/staging, Sarvam fallback, four-exhibit PDF and Windows launch scripts.

## Verification boundary

This remains a local hackathon prototype using synthetic or operator-supplied files. No live Paytm, NPCI, bank, courier, ERP, Udyam or merchant POS integration, refund, money movement or dispute submission is enabled. Authentication, tenant isolation, PostgreSQL concurrency, production security and a controlled merchant pilot remain future work.

## 0.5.3 — Merchant UI and provider diagnostics
- Reworked the application into a light, Paytm-inspired but independently branded merchant-finance workspace.
- Removed Team Aliens / Track 3 labels from the merchant-facing application chrome.
- Added responsive white surfaces, Paytm-blue actions, Inter typography, 8px cards, improved forms/tables/status states and compact mobile navigation.
- Added an explicit credit-consuming Sarvam chat + TTS connectivity test endpoint and component-level result display.
- Added real ASR test-state reporting when an audio sample is transcribed.
- Added tests for successful opt-in provider diagnostics, missing API key and invalid empty test selection.
- Kept real Paytm, bank, POS, courier, ERP, refund and dispute-submit integrations disabled until authorised access is supplied.
