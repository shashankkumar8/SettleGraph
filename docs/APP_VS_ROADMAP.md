# Submitted deck vs. current build vs. production target

## 1. Submitted six-slide deck

The presentation commits to a merchant settlement/dispute teammate with fixed-point paise logic, settlement/evidence graph, SHA-256 evidence tree, Sarvam voice, UDIR/RGNB workflows, fake-UTR/counter safety, duplicate-debit review, POS sync and a human gate around money movement.

## 2. What this Stage 2 code actually runs

- Deterministic integer-paise reconciliation over a synthetic 143-row dataset (140 capture-day rows and 3 separate operational fixtures).
- Explicit batch and payout UTR matching; no batch assignment from timestamp alone.
- Bounded two-pointer capture→nodal event analysis by exact transaction reference, with cross-date/unmatched/ambiguous evidence shown in the workbench.
- NetworkX source-linked evidence graph.
- Dataset row Merkle tree and a separate three-way dispute Merkle tree.
- Four-exhibit PDF with case-level Merkle root/leaf hashes.
- FastAPI local import, preview/staging, investigation, approval, audit and policy endpoints.
- SQLite local persistence.
- Sarvam adapters for optional read-only tool selection, ASR and TTS, with labelled fallback paths; live network use remains unverified.
- React/TypeScript operator workbench with reconciliation, evidence, policy and counter operations.
- Duplicate-debit approval and POS sync work against local synthetic records only.

## 3. Deck alignment and implementation deltas

| Deck item | Current build | Production target |
|---|---|---|
| int64 paise kernel | Implemented/tested locally | hardened validation/property testing |
| two-pointer event-window analyser | Implemented over normalized capture/nodal fields with exact ID pairing; does not assign batches | independent authoritative event feeds, stable IDs, timezone/cutoff contract, split legs |
| Paytm CSV intake | parser preview + operator mapping stage | versioned adapter verified against source exports/APIs |
| Bipartite/evidence graph | NetworkX evidence graph over current source references | typed graph across payment legs, orders, settlements, bank, disputes, courier |
| SHA-256 evidence | dataset Merkle + three-way dispute Merkle in synthetic case | signed upstream evidence and externally anchored roots |
| UDIR/RGNB FSM | synthetic fault/policy state lab; no legal result | authoritative versioned reason-code/role/deadline rules |
| Auto POD upload | no provider write exists | only authorised API, exact payload, human control and provider-confirmed response |
| Refund gate | local idempotent approval record; no refund execution | provider-backed multi-party approval/limits/idempotency |
| Sarvam voice | optional API adapters, no live call verified | target environment integration test and safe offline runbook |
| Data persistence | SQLite single local workspace | PostgreSQL, tenant isolation, backups and audit anchor |
| PostgreSQL SKIP LOCKED | not implemented | worker-level queue locks when concurrency needed |
| React/Tailwind | React 18 + TypeScript + Vite; project CSS | styling framework choice and production browser QA |
| Playwright | not included/verified | browser end-to-end test suite |

## 4. Product positioning

Paytm provides its own settlement reports and settlement-related APIs. Do not pitch SettleGraph as filling a complete absence of settlement reporting. Its defensible proposition is:

**SettleGraph is a cross-system evidence and exception-resolution teammate that connects provider records with a merchant's bank, POS/order, fulfilment/courier and support records, then prepares the next safe operator action.**

## 5. Frozen engineering decisions

1. No arithmetic or financial permission logic in an LLM.
2. Use source-reported commissions, GST, fees, refunds and adjustments; never invent them from a generic fee table.
3. Explicit payout IDs/UTRs/authoritative report references establish settlement membership; timestamps only provide context/candidate windows.
4. Missing source evidence is unknown/incomplete, not fraud.
5. Hash roots indicate integrity of captured fields, not truth or authenticity.
6. `READY_FOR_HUMAN_REVIEW` is not `POD_UPLOADED`, “dispute won” or a live NPCI status.
7. Approval decisions do not move money until a separately authorised provider adapter exists.
8. Synthetic/local/live state must be visible to the operator.
