# Real-world merchant and customer problem map

This document separates documented problems from plausible product opportunities. Do not present every opportunity as a Paytm-specific incident or a verified market statistic.

## Evidence base

1. Paytm's own settlement documentation describes net settlement as accepted payments less commission, GST and applicable deductions such as refunds, chargebacks, reversals, recoveries and device rental. It also documents settlement holds, delayed/pending settlement communication, bank-account failure reasons, and T+N settlement behaviour.
2. Paytm settlement reports expose transaction ID, order ID, transaction date, updated date, transaction type, status, amount, commission, GST, settled amount, settled date, UTR, split flag and payment mode. Transaction types include acquiring, chargeback, chargeback reversal, refund, refund reversal, recovery, recovery reversal and bank settlement.
3. Paytm's dispute documentation says the merchant is notified of a dispute and must provide appropriate evidence within the due date. Failure to respond or provide satisfactory proof can result in a LOST status and a debit. An upload response is not the final WON decision.
4. The Payments Council of India / Grant Thornton Bharat PIDF assessment (September 2024) surveyed 700 merchants across five states, with large representation from Tier III-and-below markets. It reported merchant concerns including slow acquiring-institution response, consumer-side fraud, transaction failures and weak connectivity. It also reported QR replacement and device/service support issues.
5. A 2026 Google Play review of Paytm for Business describes a merchant's difficulty getting a settlement-mode issue resolved and trouble raising a support ticket. This is an anecdote, not representative evidence.
6. A 2026 Reddit post describes a merchant whose customer paid through a supplied physical QR, but the displayed recipient name was not the shop's name. The post later says Paytm support helped resolve it. This is an anecdote; use it as an example of a QR-recipient verification problem, not proof of a systemic Paytm defect.
7. A 2025 Delhi news report described a QR-tampering case in which customer payments were diverted from a merchant. A 2026 Moneycontrol explainer describes fake UPI payment screenshots and the need for merchant-side confirmation. These support the broader risk of fake or redirected payment evidence.
8. RBI's failed-transaction TAT/compensation framework applies to specific incident categories and timelines. Do not generalise the ₹100/day compensation rule to every merchant dispute.

## Problems inside the current SettleGraph scope

### A. Gross collection vs net payout confusion

**Ground-level story:** A kirana owner sees ₹30,000 of successful payment notifications but the bank payout is smaller. They do not know which part is a fee, refund, chargeback, device rental, recovery, split payout or a transfer still pending.

**SettleGraph response:** ingest payment, settlement, adjustment and bank records; calculate the expected payout using source-reported line items; classify every included, excluded and unknown amount; show the evidence path.

**Do not do:** assume a fixed MDR, create a rental row that is absent from the report, or use timestamp alone to declare a T+2 shift.

### B. A settlement transfer is delayed or failed

**Ground-level story:** A merchant plans the next morning's supplier payment using the expected payout. The bank account is closed, frozen, dormant, invalid, at a limit, or the bank returns a technical failure. The merchant needs to know whether the problem is a normal holiday delay, a failed credit, missing bank details, KYC, or an account review.

**SettleGraph response:** distinguish `PENDING`, `FAILED`, `ON_HOLD`, `BANK_RETURNED`, `CREDITED` and `UNKNOWN`; display the provider's recorded reason and next required action; create a support case/checklist.

**Do not do:** promise a payout ETA unless the provider supplies it.

### C. Refund initiated but not received / partial refund ambiguity

**Ground-level story:** A customer returns one item from a multi-item order. The merchant initiates a ₹400 partial refund, but the customer sees no credit yet and contacts the shop repeatedly. Merchant's order system, payment provider and customer's bank show different states.

**SettleGraph response:** link refund → original payment → refund request/reference → provider refund status → bank credit when available. Show `INITIATED`, `PROCESSING`, `SUCCESS`, `FAILED`, `REVERSED` or `NOT_FOUND` only when supported by source evidence.

**Do not do:** initiate a second refund because the first one is merely delayed. Idempotency and existing-refund checks are mandatory.

### D. Chargeback / proof-of-delivery deadline

**Ground-level story:** An online seller receives a non-delivery dispute while delivery proof is spread across courier tracking, invoice, OTP event, WhatsApp messages and POS records. Missing the due date or uploading contradictory evidence can harm the case.

**SettleGraph response:** create a case timeline; collect available evidence; detect missing or contradictory records; prepare a source-linked packet; request human review; track the actual dispute lifecycle.

**Do not do:** calculate an unvalidated probability of winning, assume RGNB is merchant-triggered, or equate `UPLOADED_SUCCESS` with `WON`.

### E. Customer paid but merchant confirmation did not arrive

**Ground-level story:** A customer shows a debit / UTR while the shop's device is silent or the merchant app still says pending. The customer is asked to pay again, creating risk of a double debit if the first payment later confirms.

**SettleGraph response:** query the authoritative transaction source, identify `PENDING_TO_SUCCESS` or duplicate successful captures, preserve both references, and explain whether the order is safe to fulfil or requires review.

**Do not do:** treat a screenshot as authoritative or ask the customer to pay again merely because the merchant device did not beep.

### F. Fake payment screenshot or fake soundbox confirmation

**Ground-level story:** At a crowded counter, a customer presents a plausible payment success screen or spoofed audio. The shopkeeper releases goods before checking the actual merchant ledger.

**SettleGraph response:** search the merchant's own authenticated payment records using UTR/RRN + amount + time; show recipient identity where provider data supports it; classify as `NO_MATCH_IN_AVAILABLE_SOURCE` until an authoritative provider check is completed.

**Do not do:** say a payment is definitely fake just because it is absent from one local CSV. A screenshot image alone cannot authenticate a payment.

### G. Wrong or tampered QR / recipient mismatch

**Ground-level story:** A customer scans a QR sticker and the beneficiary name is not the shop's registered name. The customer may have paid another account; the merchant may not receive the money.

**SettleGraph response:** onboarding-time QR registry stores the merchant's approved VPA / merchant identity and QR fingerprint; periodic scan/verification can compare displayed beneficiary to the enrolled expected beneficiary; mismatch creates an urgent case and the merchant is told not to treat the payment as received.

**Do not do:** automatically reverse a UPI payment or claim a QR is safe from image appearance alone. Verify destination identity through a trusted provider/onboarding record.

## Additional real-world opportunities — backlog, not MVP scope

### H. Multi-outlet / parent-MID reconciliation

A chain has multiple stores whose settlements are aggregated to one parent account. Finance wants to trace one outlet's sale inside an aggregate payout. Paytm documents parent-level aggregation and split settlement. Extend the graph with `merchant_id`, `child_mid`, `vendor_id`, `split_leg` and allocation nodes.

### I. Marketplace/vendor split payout mismatch

A marketplace receives one customer payment, then money is split between multiple sellers and the platform. One vendor says their share is short. Model split instructions, fee allocation, vendor payout and bank credit separately. Never assume one payment = one payout.

### J. QR/device lifecycle and after-sales service

A merchant's QR is damaged, misplaced, replaced or the soundbox/POS is inactive. The merchant needs device inventory, serial number, deployment status, replacement request, technician visit and subscription billing trace. The PIDF assessment reports QR replacement within months and cites damage/misplacement and service quality as reasons.

### K. Supplier cash-flow pressure

A merchant receives digital sales but must pay a wholesaler in cash today. A failed or delayed settlement affects stock replenishment. Future SettleGraph could show confirmed vs expected incoming settlements and flag a cash-flow shortfall, but must not present unconfirmed money as available balance or provide credit decisions without a separate regulated workflow.

### L. Wrong UPI transfer / customer recovery journey

A customer sends money to the wrong VPA or merchant. UPI payments cannot simply be cancelled after authorisation; the customer may need to contact recipient bank/app and raise a dispute. A safe customer-service teammate can collect UTR, bank complaint reference, timestamps and status, then guide escalation. It cannot promise recovery or debit the recipient itself.

### M. Bank holidays, settlement cycles and dispute-cycle separation

A merchant expects a payout on a non-working day, or sees dispute adjustments at a different cycle from auth settlements. NPCI has specified separate UPI auth and dispute settlement cycles. Build a cycle-aware timeline from authoritative settlement calendar/data, not a generic `T+1` formula.

### N. Merchant support ticket with fragmented evidence

The merchant has called support multiple times and repeats the same story. SettleGraph can create a structured case bundle with merchant ID, date range, UTRs, report rows, previous ticket references and actions already attempted. This directly targets the reported issue-resolution friction.

### O. Duplicate vendor payment / duplicate refund / replayed webhook

Retries after timeout can repeat an action. Build idempotency keys, unique operation constraints and a durable action ledger. This is a cross-cutting safety control for every future write integration.

### P. Tax, fee and statement interpretation confusion

Merchants may confuse gross collections, taxable turnover, settlement net, GST on service fees, refunds and other tax deductions. SettleGraph can explain source-reported entries and export records to an accountant, but it should not make tax/legal conclusions without validated rule packs and professional review.

## Prioritisation

| Priority | Problem | Why |
|---|---|---|
| MVP | Payout mismatch, refund/chargeback/fee tracing, settlement delay classification, evidence case | Closest to submitted deck and supported by provider records |
| MVP extension | Payment confirmation ambiguity, duplicate payment, fake UTR local check | High visible customer/merchant pain and clear deterministic controls |
| P1 | QR recipient mismatch, partial refund lifecycle, supplier cash-flow visibility | Strong merchant value but needs additional trusted data sources |
| P2 | Multi-outlet / vendor split payouts, QR/device service management, customer wrong-transfer guidance | Valuable expansion; increases scope and integrations |

## Source links

- Paytm settlement reports: https://www.paytmpayments.com/docs/settlement-reports-on-dashboard
- Paytm settlement processing: https://www.paytmpayments.com/docs/settlement-processing-in-paytm
- Paytm settlement API: https://www.paytmpayments.com/docs/api/settlement-api/
- Paytm dispute lifecycle: https://www.paytmpayments.com/docs/disputes
- Paytm dispute action API: https://www.paytmpayments.com/docs/api/dispute-action-api
- Paytm settlement support: https://www.paytmpayments.com/docs/settlement-support/
- Paytm settlement failed help: https://business.paytm.com/support/my-settlement-is-repeatedly-failing
- Paytm hold help: https://business.paytm.com/support/why-is-my-settlement-on-hold-and-my-account-under-review-after-getting-activated
- Paytm refund management: https://www.paytmpayments.com/docs/refund-management/
- Paytm split settlement: https://www.paytmpayments.com/docs/split-settlement
- Paytm Soundbox agreement: https://business.paytm.com/master_offline_agreement_terms
- NPCI UPI ecosystem statistics: https://www.npci.org.in/product/upi/product-statistics
- NPCI RGNB circular: https://www.npci.org.in/uploads/UPI_OC_No_184_B_FY_2025_26_Addendum_to_OC_184_Modification_in_UPI_chargeback_rules_and_procedures_34dea7d620.pdf
- NPCI settlement cycle circular: https://www.npci.org.in/uploads/UPI_OC_No_222_FY_2025_26_Segregation_of_UPI_settlement_cycles_for_Auth_and_disputes_transactions_25534237a3.pdf
- RBI failed-transaction TAT: https://rbi.org.in/commonman/Upload/English/Notification/PDFs/CIRCULAR677EC931A7A65E4D99AA957D8E85BC0A2A.PDF
- PIDF Impact Assessment, PCI / Grant Thornton Bharat, September 2024: https://www.paymentscouncil.in/images/03.10.2024_PIDF%20Impact%20Assessment%20(1).pdf
- Paytm for Business Play Store review: https://play.google.com/store/apps/details?id=com.paytm.business
- QR tampering case (Times of India): https://timesofindia.indiatimes.com/delhi/nineteen-year-old-arrested-for-tampering-qr-codes-and-diverting-payments-from-chandni-chowk-shop/amp_articleshow/126139434.cms
- Fake payment screenshots explainer (Moneycontrol): https://www.moneycontrol.com/news/business/personal-finance/fake-payment-confirmation-screenshots-how-merchants-can-verify-real-transactions-13896421.html
- 2026 customer UPI payment not reflected on gateway anecdote (Reddit): https://www.reddit.com/r/UPI/comments/1ukar5z/has_anyone_faced_a_situation_where_a_upi_payment/
- 2026 merchant QR recipient mismatch anecdote (Reddit): https://www.reddit.com/r/UPI/comments/1vwxgtc/paytm_sent_me_the_wrong_qr_and_my_customers/
