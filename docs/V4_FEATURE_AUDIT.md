# SettleGraph v4 ZIP — feature audit and merge decision

**Audit date:** 31 October 2026  
**Compared builds:** `SettleGraph_Team_Aliens_v4.zip` and the prior `SettleGraph_Team_Aliens_GOAT.zip`  
**Final code line:** SettleGraph Team Aliens v0.5.2

## Executive decision

The v4 archive is a **separate feature branch, not a replacement for the GOAT build**. It adds a worthwhile Vendor & Exceptions workbench, so its unique business workflows have been retained in the final merge. The stronger Paytm settlement/evidence/import/voice core from GOAT remains the baseline because v4 did not preserve all of that hardening.

The product should still be pitched in the order promised by the selected six-slide deck:

1. Paytm-aligned settlement and payout exception explanation.
2. Source-linked evidence graph and three-way dispute evidence readiness.
3. Counter-payment / duplicate-capture review and safe order recovery.
4. Hindi/Hinglish voice and bounded agent assistance.
5. **Vendor & Exceptions Desk as an adjacent extension**, not as a replacement for the shortlisted Paytm merchant-operations story.

## What v4 contributed

| v4 addition | Value | Final merge decision | Current scope |
|---|---|---|---|
| Vendor Desk UI (`VendorTab.tsx`) | Gives the merchant a second operations surface beyond Paytm payout support | **Retained and integrated** as the sixth workbench section | React view calling local API routes |
| PO → GRN → invoice review | Catches quantity/value and document mismatches before requesting payment | **Retained** | Synthetic invoice/PO/GRN fixture with deterministic comparison |
| Partial-payment / vendor outstanding view | Makes the payment ledger and outstanding balance visible | **Retained and hardened** | Dated synthetic payment/credit/debit-note rows; integer paise |
| MSME delayed-payment timeline | Useful for Indian Micro/Small supplier workflows | **Retained with legal guardrails** | Eligibility shown only from recorded fields; operator must verify Udyam, activity, supply date, objection and contract evidence |
| Interest estimate | Provides a useful cash-flow signal | **Modified materially** | No calculation unless the operator confirms a rate and dated principal events are complete; output is labelled illustrative, not a legal account |
| Vendor follow-up staging | Gives the operator a review handoff | **Retained** | Local approval record only; no email/WhatsApp/ERP message is sent |
| Duplicate-capture / double-debit candidates | Useful merchant/customer pain point | **Merged with GOAT detector** | Uses active transaction data, exact order/amount/status/reference/time-window constraints and payer consistency where available |
| Failed UPI TAT scenario | Useful and directly relevant to merchant/customer experience | **Retained with RBI category split** | Separate P2M confirmation-missing and P2P beneficiary-not-credited clocks; synthetic date calculation only |
| Kirana payout scenario | Makes the settlement mystery easy to explain to judges | **Retained as a labelled fixture** | ₹80,000 gross / ₹76,500 bank / ₹2,500 documented / ₹1,000 unresolved; no fee rate is inferred |
| Exception inbox | Provides one prioritised operational queue | **Retained and connected** | Current settlement residual, vendor receivable and duplicate candidates; fixture status shown |
| Hinglish intent router | Makes a local interaction demo accessible | **Retained as deterministic routing** | Maps a small known vocabulary to backend-computed values; it is not presented as an LLM or broad language understanding |

## What was unsafe or overstated in v4 and was not copied as-is

### 1. Vendor interest was too simple to present as a statutory number

A flat rate applied to the remaining invoice balance for the entire overdue period can ignore partial payments, notes and the dates on which principal changes. The merged code now:

- uses dated payments and debit/credit-note events;
- suppresses the estimate when a principal-changing row has no date;
- requires a bank-rate input and an explicit operator confirmation in the UI;
- applies a simplified monthly-rest illustration to dated events;
- states that it is **not a legal/accounting determination** and that a single input rate cannot represent historical rate changes.

Do not call the result “the exact statutory interest due”. A production calculation needs the actual rate history, validated source events, legal interpretation and reconciliation of how every payment is appropriated.

### 2. MSMED eligibility cannot be inferred merely from a vendor name

The local fixture records a Udyam Micro/Small manufacturing supplier. The app cannot authenticate the Udyam certificate, registration date, activity/NIC code, date of supply or whether the particular supply qualifies. It therefore exposes an eligibility note and keeps real claims locked behind source verification.

The relevant statutory workflow is not universal to all merchants/suppliers. Ministry guidance on the MSE delayed-payment mechanism restricts it to Micro/Small manufacturing and service enterprises and excludes trading activity under NIC 45–47. The code is a workflow aid, not a legal eligibility opinion.

### 3. RBI ₹100/day compensation is not a generic dispute penalty

v4's TAT concept is retained, but the code distinguishes the specified RBI UPI failed-transaction categories:

- UPI P2M: customer account debited, merchant location not receiving transaction confirmation — T+5;
- UPI P2P: account debited but beneficiary account not credited — T+1.

The local calculation displays a **potential** amount only for these named categories and clearly says it does not verify the underlying RBI conditions or payment of compensation. It does not apply the rule to all UDIR/RGNB/chargeback disputes.

### 4. Duplicate captures do not prove an overpayment on their own

Two successful captures for one order inside a time window are a candidate requiring review. Without an independently sourced order/invoice total, it is not safe to label the second amount as an overpayment or prefill an actual refund. The merged API therefore shows “captures beyond first — not confirmed overpayment”, with human review only.

Three captures are grouped into one connected candidate cluster rather than three overlapping refund suggestions. If payer identities are both present and disagree, the candidate is suppressed from the straightforward duplicate view.

### 5. Synthetic scenarios are not provider data

The Kirana payout, vendor PO/GRN/invoice, failed-UPI dates and starter duplicate records are fixtures. There is no live Paytm, bank, ERP, vendor, Udyam, NPCI, POS or courier integration in this package. No email, WhatsApp message, claim, refund or money movement is sent.

## Why GOAT remains the core

The GOAT build retained more complete settlement reconciliation, bounded capture→nodal timing analysis, canonical ZIP import, staged Paytm-style CSV adapter, source-row Merkle proofs, three-leaf dispute proof, PDF compilation, local idempotency, safer voice/agent fallbacks, and stronger tests. v4's valuable vendor desk is merged into that base, rather than allowing the smaller v4 project to regress those capabilities.

## Final navigation

- Main code: `backend/engine.py`, `backend/main.py`, `backend/store.py`, `backend/paytm_settlement_adapter.py`, `backend/pdf_compiler.py`, `backend/sarvam_service.py`.
- Vendor extension: `backend/vendor.py`, vendor routes in `backend/main.py`, `backend/tests/test_vendor.py`, `frontend/src/VendorTab.tsx`.
- Frontend: `frontend/src/App.tsx`, `frontend/src/VendorTab.tsx`, `frontend/src/styles.css`.
- Current status: `IMPLEMENTATION_STATUS.md` and `GAP_REGISTER.md`.
- Live work plan: `LIVE_READINESS_ROADMAP.md`.
