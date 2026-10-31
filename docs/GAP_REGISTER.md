# Gap register — SettleGraph v0.5.2

**Basis:** selected Stage 1 deck, GOAT build, separate `SettleGraph_Team_Aliens_v4.zip`, source review and current code/tests. “Done” means implemented in the local prototype and tested where practical. It never implies a real provider connection.

| Requirement | Local status | What exists in this build | Production work still open |
|---|---|---|---|
| Fixed-point paise arithmetic | **Done locally** | Decimal string ingestion to integer paise; integer residual arithmetic; signed-int64 bounds | Property/fuzz tests on approved provider samples; define source rounding conventions |
| Payout / settlement / bank reconciliation | **Done for explicit references** | Exact payout batch ID, batch ID and payout UTR matching; multiple bank rows; known/unknown adjustment categories | Real export validation, split legs, reversals/refunds, value dates, partial credits and independent bank feed |
| Bounded two-pointer cutoff event analysis | **Done over normalized event fields** | Sorted capture/nodal event views, bounded window, exact transaction ID pairing, cross-date/unmatched/ambiguous output | Independent authoritative event feeds, provider timezone/cutoff semantics, stable IDs, clock skew and partial settlements |
| Paytm-style CSV adapter | **Partial** | Alias parser, Decimal normalization, file/row SHA-256, preview and explicit staging | Confirm schema/version against real merchant exports and APIs; split-settlement support |
| Canonical ZIP import | **Done for local contract** | Atomic validation of four core CSVs; optional `disputes.csv`; failed import does not replace active dataset | Production ingestion job, malware scanning, object storage, schema evolution and source signature/verification |
| Paytm CSV activation | **Partial by design** | Operator mapping stored as a staged record; active canonical ledger is not silently mutated | Verified bank-credit and adjustment sources; validated commit transaction across all related records |
| NetworkX evidence graph | **Done for available references** | Source-backed edges with match rule and source row references | Additional typed refund/chargeback/courier relationships and source confidence/provenance classifications |
| Dataset Merkle tree | **Done locally** | Source-row leaves, root and inclusion-proof endpoint | External anchoring, signing keys, version pinning and stale-packet invalidation |
| Three-way dispute Merkle | **Done for synthetic case** | Nodal payment, POS/invoice and courier delivery leaves; inclusion proofs; fault-sensitive root; PDF output | Provider-authenticated records and canonical versioned evidence schemas |
| UDIR/RGNB policy FSM | **Synthetic only** | OTP/amount/courier conflicts and duplicate-debit review paths; external submission disabled | Authoritative versioned reason-code/state/action catalogue; compliance approval; live provider sandbox tests |
| RBI failed-transaction TAT | **Limited local scenario** | UPI P2M confirmation-missing T+5 and UPI P2P beneficiary-not-credited T+1 date examples; potential ₹100/day only in those named categories | Verify actual failed-transaction condition, actor, event timestamps and applicable current rules; no generic UDIR/RGNB penalty |
| Sarvam Chat/ASR/TTS | **Partial, optional, live unverified** | Key-gated Saaras v4, Bulbul v4 Flash and Sarvam-105B adapters; deterministic fallback; backend allow-list | Team key/credits and target network verification, entitlement/limit testing, monitoring and per-tenant budget |
| Voice entity binding | **Suggestion only** | Levenshtein candidates and explicit confirmation; no automatic financial join | More robust confidence calibration and source-bound confirmation |
| Four-exhibit PDF | **Done locally** | Four-section review packet; reconciliation, UTR/bank, order/dispute and voice sections; Merkle evidence when supplied | Validate Windows font/rendering, archival retention and provider-approved submission schema |
| Duplicate capture detection | **Done as candidate/review workflow** | Active dataset, exact order/amount/distinct successful refs/time window, payer consistency; multi-capture clusters grouped; no independent invoice total means no overpayment assertion | Trusted POS invoice/order total and provider payment status/reversal lookup; pilot false-positive measurement |
| Duplicate refund | **Not enabled** | Candidate can create local `DUPLICATE_CAPTURE_REVIEW`; response states no refund API/external action | Provider permission, exact case semantics, maker-checker, limit/beneficiary validation, idempotency and independent reconciliation |
| POS payment sync | **Local mock only** | Local mock order updated idempotently after checking exact payment source reference | Merchant POS sandbox, signed event/webhook, replay handling and provider acknowledgement |
| Fake UTR shield | **Local lookup only** | Exact reference check against loaded dataset | Authoritative Paytm/NPCI switch lookup; missing local match is not fraud proof |
| Vendor PO/GRN/invoice | **Synthetic fixture** | PO, GRN, invoice, dated payment, notes and mismatch toggles in Vendor Desk | Vendor ERP/document ingestion, OCR/manual verification, line-item and tax treatment, source-of-truth contracts |
| MSME eligibility | **Recorded-field aid only** | Udyam status, enterprise size and activity checks; missing/unsupported values lock legal timeline | Authenticate Udyam, registration date, NIC/activity and supply-date eligibility; legal approval |
| MSMED acceptance / due timeline | **Local timeline aid** | 15-day written objection/acceptance handling and 45-day agreed-term cap | Validate dates/documents against actual case, counsel-reviewed cases and effective legal amendments |
| MSMED interest | **Illustrative only** | Requires operator-confirmed rate and fully dated principal-changing events; partial payment events affect balance; monthly-rest approximation | Official RBI rate history, statutory calculation implementation, principal/payment appropriation and legal/accounting validation |
| Vendor follow-up | **Local approval only** | Stages local approval record with evidence hash; no notice/message sent | ERP/email/WhatsApp connector, legal-approved template, recipient verification and maker-checker |
| Kirana payout | **Synthetic fixture** | ₹80,000 gross, ₹76,500 bank, ₹2,500 documented, ₹1,000 unresolved | Replace with redacted merchant source rows and evidence references |
| Exception inbox | **Partial local aggregation** | Settlement residual, vendor receivable, duplicate candidate and approval counts | Durable case ownership, prioritisation SLAs, escalation workflow and live source updates |
| Hinglish intent router | **Small deterministic helper** | Known local intents mapped to backend-computed snapshots | Multilingual evaluation and optional model-assisted intent with schema validation; no financial arithmetic in model |
| Authentication / tenant isolation | **Open** | Local operator/demo mode only | Identity, tenant context, RBAC, dual control and row-level access tests |
| PostgreSQL / `SKIP LOCKED` | **Open** | SQLite local persistence and idempotency | PostgreSQL schema/migrations, transactions, queue worker and concurrency tests |
| Immutable audit | **Partial local** | SQLite audit chain and tamper check | Externally anchored/WORM audit, key lifecycle and retention controls |
| Production deployment / observability | **Open** | Local Windows start scripts | Cloud deployment, secrets, CI/CD, metrics/traces, alerts, backup/restore and incident runbooks |
| Frontend production build/browser E2E | **Open verification** | App, VendorTab and main TSX source syntax transpilation passes | `npm install`, `npm run build`, Playwright/browser, responsive/accessibility test on target laptop |

## Current verification

- Backend test suite: **114 passed** in the current working tree.
- Python compile checks: passed.
- TypeScript syntax transpilation for `App.tsx`, `VendorTab.tsx`, `main.tsx`: zero syntax diagnostics. This is not a full type-check.
- Full npm production build and browser E2E: not verified because package registry access failed in this handoff environment.
- No live Paytm, NPCI, bank, POS, courier, ERP, Udyam or Sarvam API call is claimed.

For the separate v4 merge rationale see `V4_FEATURE_AUDIT.md`. For the phased plan to authorised production integrations see `LIVE_READINESS_ROADMAP.md`.


## v0.5.2 operational hardening

- Upload body reads are bounded in chunks for ZIP (10 MB), CSV (5 MB) and audio (10 MB) endpoints before downstream parsing. ZIP expansion has separate per-file, total-uncompressed and compression-ratio checks.
- `GET /api/integrations/status` and the workbench Integration Readiness panel show configuration/connection status separately; secrets are never included.
- CORS accepts explicit bare HTTP(S) origins only; wildcard and malformed origins are rejected.
- `verify_project.ps1` now exits non-zero/incomplete when frontend dependencies are missing; it no longer prints a green completion message after skipping the frontend build.
- Current backend regression suite: **114 passed**. The full frontend production bundle and browser E2E remain unverified until dependencies are installed on the target laptop.
