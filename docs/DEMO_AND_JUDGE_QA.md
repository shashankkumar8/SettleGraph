# Demo script and judge questions — Stage 2 build

## Three-minute core demo (keep the selected deck as the main story)

1. **Problem (20 sec):** A merchant's collection/settlement report and bank credit do not appear to match. Several systems hold the reason: payment, adjustment, payout, bank, POS and courier records.
2. **Reconcile (30 sec):** Run the synthetic ₹50,000 example. Show the source-recorded deductions/shifted batch amount, integer-paise computation and ₹0.00 residual. Point to the two-pointer capture→nodal panel (exact IDs, one cross-date event, ₹1,850.00). Say every fee row is synthetic, not an automatic tariff calculation, and batch membership comes from explicit source IDs.
3. **Trace (25 sec):** Open the graph, select a payment/adjustment and read the source row and exact match rule.
4. **Paytm CSV (20 sec):** Preview the sample export, inspect alias mapping, stage it with explicitly operator-entered payout metadata, and show the active ledger is unchanged. For a canonical import demo, use the included four core reports plus optional `disputes.csv`; without that optional file the imported dispute list is cleared.
5. **Break-the-case (30 sec):** Evaluate a synthetic dispute. Toggle bad OTP/amount/courier data. Show three-way Merkle root/leaf change and review/blocked policy state.
6. **Counter operations (25 sec):** Stage duplicate-debit approval; approve/reject as local handoff only. Run idempotent local mock POS sync.
7. **Voice/PDF (30 sec):** Use live Sarvam only if tested with the team's key. Otherwise clearly identify the offline deterministic mode. Compile the four-exhibit review packet.

**Optional 30-second extension if judges ask about v4:** open Vendor & Exceptions. Show the synthetic PO/GRN/invoice and partial payment, demonstrate a missing-GRN or 60-day-term fault locking the follow-up, then show P2M T+5 vs P2P T+1. State the vendor data is a fixture, MSMED eligibility requires actual Udyam/activity verification, interest is an operator-confirmed illustration, and follow-up is only a local human-review record.

## Honest pitch

“SettleGraph is an evidence-first merchant operations teammate. It connects payment-provider data with merchant bank, POS/order, courier and support evidence; calculates settlement differences with deterministic integer-paise logic; makes evidence relationships inspectable; and stages sensitive actions for human review. This demo uses synthetic fixtures and local mock operations. It does not connect to live Paytm/NPCI or move money. The Vendor & Exceptions Desk is an additional synthetic module, not a live ERP or Udyam connection.”

## Judge questions

**Isn't this just Paytm's settlement report?**  
Paytm provides settlement reporting and APIs. SettleGraph's intended value is cross-system correlation and exception resolution across provider, bank, POS/order, courier and operator evidence. It complements the provider's ledger; it does not replace it.

**Where is the AI?**  
The optional Sarvam layer provides voice transcription/speech and tool selection. Deterministic backend tools do the money calculation, matching, integrity checks and policy gates. A live model call must be shown as live only if the configured key/network test succeeded; otherwise the UI labels the fallback.

**Where is the two-pointer cutoff algorithm?**  
`backend/engine.py:analyse_cutoff_events()` implements a bounded two-pointer window over sorted capture and nodal event views, paired by exact transaction ID. It reports cross-date, unmatched, duplicate and invalid references. In this local build the capture and nodal timestamps are fields on the same normalized transaction row, not two independent provider feeds. Production still needs separate source adapters, stable identifiers, verified timezone/cutoff semantics and clock-skew handling. Batch assignment remains explicit and is never inferred from time.

**Why integer paise?**  
₹1,234.56 is stored as 123456 paise; exact integer addition/subtraction avoids binary floating-point equality problems.

**Why is a hash not enough to prove source authenticity?**  
A Merkle tree only detects changes to the captured data relative to its root. A source signature or authenticated provider retrieval is required to know who supplied it.

**Does a missing UTR mean the customer used a fake screenshot?**  
No. `NO_MATCH_IN_LOADED_DEMO_DATA` is only absence in the currently loaded dataset. The real counter shield must call an authoritative Paytm/switch source with correct time, amount and scope.

**Does SettleGraph automatically defend UDIR/RGNB disputes?**  
No live submission occurs. The policy lab tests evidence readiness on synthetic cases and prepares a review packet. Real UDIR/RGNB workflows, roles, evidence deadlines and API permissions need a versioned authoritative rule set.

**Does the ₹100/day RBI penalty apply to every dispute?**  
No. It belongs to defined failed-transaction compensation cases with specific event triggers and TAT clocks. Do not generalise it to every UDIR/RGNB case. The current build does not calculate this universal penalty.

**Can a reviewer approve a refund in this UI?**  
They can record an approval/rejection for a manual handoff. No refund connector is implemented and no money moves.

**What happens if Sarvam is unavailable?**  
The API returns a labelled deterministic fallback. ASR does not invent a transcript. TTS may use the browser's Hindi speech synthesis.

**What did you merge from the separate v4 build?**  
We kept v4's Vendor & Exceptions Desk: PO/GRN/invoice matching, vendor outstanding timeline, Kirana payout example, UPI failed-transaction TAT views and the exception inbox. It is an adjacent module. The GOAT build remains the base for the stronger Paytm settlement/evidence/import/voice core. We corrected the vendor interest and duplicate-capture assumptions rather than copying the v4 code unchanged.

**Is the vendor interest amount a legal statutory demand?**  
No. The current workbench is a synthetic workflow illustration. It requires an operator-confirmed RBI Bank Rate input and dated partial-payment/credit/debit-note events, but it uses one rate and simplified monthly-rest handling. It is not a legal or accounting statement. A real claim needs authenticated Udyam/category/activity and supply evidence, rate history, full transaction ledger and legal review.

**Who qualifies for the MSMED delayed-payment workflow?**  
Do not assume every seller qualifies. Official MSEFC guidance applies the scheme to eligible Micro/Small manufacturing and service enterprises and excludes trading NIC 45–47 activity. The prototype only checks recorded fields; it cannot authenticate Udyam or decide a legal entitlement.

**Does RBI ₹100/day compensation apply to every chargeback?**  
No. The local TAT screen only demonstrates the defined UPI P2M confirmation-missing (T+5) and UPI P2P beneficiary-not-credited (T+1) categories from the RBI failed-transaction framework. It does not apply this to all UDIR/RGNB disputes or prove that the underlying transaction qualifies.

**Does the duplicate candidate show the refund amount?**  
No. It shows captures beyond the first within an exact order/amount/time/reference cluster. Without an independent POS invoice/order total, this is not a proven overpayment. The action stages a local review record only; no refund API exists.

**Does the Vendor Desk send a reminder to the supplier?**  
No. It stages a local approval record. Email, WhatsApp and ERP connectors are not implemented.

**What is needed for a real merchant pilot?**  
Approved provider and bank data access, verified POS/courier feeds, auth/tenant isolation, RBAC, audit anchoring, secure data retention, current NPCI/Paytm policy mapping, provider sandbox tests, security review and controlled rollout.
