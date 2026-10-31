# SettleGraph source audit and product decisions

Audit basis: the selected six-slide presentation, `SettleGraph_Original.txt`, the 55-page Gemini PDF/conversation, the uploaded ZIP variants and the runnable source in this package. The selected deck is treated as the intended promise; the code is treated as the evidence of what works.

## 1. ZIP/version choice

| Upload | Role in the history | Decision |
|---|---|---|
| `settlegraph_complete.zip` and duplicate `settlegraph_complete (1).zip` | Smaller earlier repo with a narrower core/test set | Do not use as the final demo base; retain only as historical reference |
| `SettleGraph_Complete_Conversation_Archive.zip` | Chronological LLM/build snapshots with MVP and Buildpack v2 | Use for design history, gaps and user requirements—not as the final runnable tree |
| `SettleGraph_Final.zip` | Most complete prior runnable base, including Paytm-style adapter, voice service, PDF compiler and split test suites | Chosen as the code base, then audited and extended |
| `Google Gemini.pdf` | Architecture walkthrough and prompts, but the frontend snippet at the end is truncated | Study guide only; never copy its truncated frontend code |
| `SettleGraph_Original.txt` | Original problem/solution, actors, test scenarios and design claims | Product context and requirements, subject to validation |
| Selected six-slide PPTX | Shortlisted product story and judge-facing promise | Product contract for this final build |

The Gemini conversation's claim that the original `SettleGraph_Final.zip` was “100% complete” should not be repeated. Its own gap register and code show partial preview-only import, local/synthetic policy, no live provider writes, and security/production gaps. The rebuilt project therefore retains its good deterministic core and explicitly records what is still absent.

## 2. Strong points of the selected idea

1. **Specific Paytm merchant pain, not a generic AI assistant.** The product story centres on payout opacity, disputed/delayed UPI payments, duplicate debit, fake receipt/UTR claims and weak links between payment, POS and delivery evidence.
2. **Correct separation of perception and decisions.** Sarvam ASR/TTS and optional chat assist with language and tool selection; integer-paise computation, matching, hash proofs and policy decisions remain deterministic backend code.
3. **Auditable explanation.** Source row IDs, exact match rules, reconciliation residuals, Merkle roots and downloadable exhibits make it possible to show why a result was produced.
4. **Judge-testable failure modes.** OTP, invoice and courier faults change the dispute evidence root and put the policy flow into a blocked/review state.
5. **Human control on money-impacting actions.** Duplicate-debit refunds are staged as local approval records; no model or UI button can send money.

## 3. Risks and demerits found in the source material

### Product and domain risks

- The Gemini/blueprint text mixes UDIR, RGNB, chargebacks, deemed acceptance and failed-transaction TATs. These are not one interchangeable policy. An authoritative, reason-code-level workflow catalogue is required before any live dispute operation.
- The materials cite an RBI ₹100/day compensation rule as though it were universally applicable to UDIR/RGNB disputes. The RBI failed-transaction framework has defined categories, event conditions and clocks; do not apply it to all representment cases.
- The uploaded descriptions conflict on RuPay CC on UPI rate assumptions (for example 2.00% versus 0.4%/other dated values). The code intentionally does not calculate assumed MDR. It reconciles provider-recorded commission/GST/adjustment rows only.
- A missing UTR from one local CSV is not a fraud verdict. Live counter verification needs a trusted switch/Paytm lookup.
- A perfect residual on a synthetic fixture does not prove that an actual merchant payout is fully explained.

### Engineering risks

- The latest local build now contains a bounded two-pointer capture→nodal event-window analyser. It sorts the two event views, advances lower/upper window pointers and pairs only exact transaction IDs; duplicate references, missing nodal source-row IDs and out-of-window events remain unresolved. This is built over capture and nodal fields in the normalized transaction records, not yet two independent provider event feeds. It reports cross-date timing but never assigns payout batch membership.
- Slide 3 promises PostgreSQL `SKIP LOCKED`. The local build currently uses SQLite for a self-contained single-workspace demo.
- Slide 3 names Tailwind CSS. The retained React workbench uses project CSS, not Tailwind utilities.
- The current source is not multi-tenant/authenticated and should not hold real merchant PII.
- Dispute cases are loaded from the optional `disputes.csv` and join only through a unique exact UTR. Missing nodal amount/source row or missing payment-to-order link cannot be filled from the gross amount or generic payment row ID. This intentionally creates a review/hold state instead of manufactured completeness.
- Duplicate-payment candidates require exact order, amount, distinct successful references and a 120-second window. Where both source rows expose payer identity the values must agree; the API never returns raw VPA values. When payer identity is not provided, the UI labels that limit rather than implying a payer match.
- The source Merkle root is not a digital signature and does not prove upstream source authenticity. Local SQLite audit chaining is not an immutable ledger.
- Sarvam live usage depends on valid credits, key, current API contracts and network. The code has fallback paths but no live endpoint test is claimed here.
- The newer Gemini paste correctly called out `.env` loading, network-failure fallback, import activation and live microphone capture as gaps. Those were addressed as local configuration/fallback, explicit *staging* (not falsely activating a partial source), and MediaRecorder input. Its proposed TTS payload change to `target_language_code` was not carried over: the current Sarvam TTS request contract uses `language_code`; a regression test locks that field.

## 4. Changes made in this Stage 2 build

- Added an explicit **staged Paytm-style CSV mapping** endpoint and UI. It stores operator-supplied mapping but does not mutate the active ledger or invent bank/adjustment data.
- Added persistent idempotent local human-approval queue for duplicate-debit review, with approve/reject recorded only as manual handoff.
- Added a local mock POS payment sync with an idempotency key.
- Made Sarvam `.env` loading explicit and process-environment-safe; improved agent fallback on provider/network failures; ASR failure does not fabricate a transcript.
- Added a **three-leaf dispute Merkle tree** for nodal payment, POS invoice/order and courier delivery, including inclusion proofs, fault-sensitive root and PDF output.
- Updated operator UI to surface the three-way proof, capture→nodal window metrics, cross-date event example and counter-operations paths instead of merely displaying a chatbot.
- Added API-base configuration, Vite local proxy, backend-unavailable retry screen, string-exact BigInt paise parsing for UTR checks, 28-second microphone stop and browser metadata preflight for >30-second audio uploads.
- Added ZIP/CSV hardening, source-backed duplicate-debit checks, payment-source validation before local POS sync and model-prose isolation in the Sarvam agent.
- Added regression coverage for cutoff time windows, repeated IDs, payer consistency, model-prose injection, optional dispute bundles, missing nodal fields and source mismatch; the full backend suite now passes 107 tests.

## 5. Claims to use in front of judges

Use:

- “The reconciliation kernel uses integer paise and explicit source references. It does not ask an LLM to do money math.”
- “The demo has a source-row Merkle tree and a separate three-way dispute evidence Merkle tree. These detect mutation of the evidence snapshot; they do not authenticate the provider.”
- “Our duplicate refund action is staged for human review; the hackathon build cannot move money.”
- “The current raw Paytm-style import is preview/stage. Canonical reconciliation requires the companion settlement, adjustment and bank evidence; optional dispute evidence is imported from `disputes.csv` and joined only by exact UTR.”
- “Our local demo is provider-isolated. A real Paytm/NPCI/POS adapter is a gated integration step, not a mocked success message.”

Avoid:

- “We are integrated with Paytm/NPCI.”
- “We automatically upload POD or win the chargeback.”
- “The local cutoff analyser pairs normalized capture/nodal event fields by exact transaction ID inside a bounded two-pointer window. The two event timestamps are currently carried on the same local transaction row; production needs independent authoritative event feeds. Timestamps never assign payout batches.”
- “The system proves a screenshot is fake without a live nodal source lookup.”
- “The RBI ₹100/day penalty applies to every UDIR/RGNB case.”
- “We have production-ready security or immutable audit.”

## 6. Data arithmetic of the included demo fixture

The synthetic fixture contains 143 payment rows in total: 140 rows on the selected capture date plus three isolated operational fixtures on a separate date. The selected capture date contains ₹50,000.00 gross. A ₹1,850.00 transaction is explicitly assigned to the next batch. For the selected payout, the sample adjustment rows are ₹90.00 MDR, ₹16.20 GST, ₹0.20 synthetic switch fee, ₹1,200.00 loan EDI, ₹125.00 Soundbox rental and ₹1,000.00 dispute hold. The selected bank credit is ₹45,718.60. Thus, ₹1,850.00 + ₹2,431.40 = ₹4,281.40 and ₹50,000.00 − ₹4,281.40 = ₹45,718.60.

All rates and fees in this example are explicit synthetic rows. In particular the ₹0.20 switch-fee fixture row is not asserted as a Paytm universal fee. The code reads recorded rows; it does not synthesize fee policy from instrument type.


## 7. Separate v4 ZIP audit and merge decision

`SettleGraph_Team_Aliens_v4.zip` was reviewed as a separate candidate branch. Its unique Vendor & Exceptions Desk was worth retaining: PO/GRN/invoice matching, partially paid vendor receivables, MSME payment-timeline aid, UPI failed-transaction TAT scenarios, Kirana payout fixture, exception inbox and deterministic Hinglish routing. The workbench now includes this as a sixth section.

The GOAT implementation remains the core because it preserves the stronger Paytm-aligned settlement, graph, Merkle, canonical ZIP import, Paytm-style CSV staging, voice, PDF and operational safety flows. v4's vendor interest and duplicate-capture assumptions were not copied unchanged: interest now requires dated principal events and an operator-confirmed rate and remains illustrative; duplicate captures are review candidates until an independent order total is available; and TAT is separated into the specified P2M/P2P categories.

See `V4_FEATURE_AUDIT.md` for the full module-by-module audit and `LIVE_READINESS_ROADMAP.md` for the roadmap from this local prototype to a controlled live deployment.
