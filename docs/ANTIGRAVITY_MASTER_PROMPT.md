# Antigravity Master Prompt — SettleGraph v0.5.3 polish and live-readiness

You are modifying the existing SettleGraph repository extracted from `current SettleGraph v0.5.3 repository (or the exact current source folder selected by the user). Work **in this project only**. Do not merge GOAT, v4, FINAL, GOAT build, or any other archive. Do not create another wrapper or rewrite the product from scratch. Preserve the deterministic financial engine and existing API contract unless an audited defect requires a versioned change.

## Mission

Deliver a production-quality, responsive merchant-finance workbench with a clean Paytm-inspired visual direction based on `docs/DESIGN_SYSTEM.md` and the user-supplied tokens: `#00baf2` primary, white surfaces, `#17191c` text, Inter, compact hierarchy and 8px corners. SettleGraph must remain an independent product. Do not use the Paytm logo, copy proprietary content, or imply official Paytm affiliation. Remove Team Aliens / Track 3 from all user-facing app chrome, page titles and metadata; those belong in pitch materials, not the merchant workspace.

## Non-negotiable safety and correctness

1. Financial calculations stay in the Python backend, integer paise only. Do not use JavaScript floating-point for financial computation.
2. Batch membership must come from explicit source records/mappings; never infer settlement batches from timestamp proximity or amount similarity.
3. Never label a missing local UTR as fraud. Never infer delivery from payment success.
4. SHA-256 / Merkle proves integrity relative to captured input, not authenticity, source completeness or legal truth.
5. AI/ASR can interpret a user query or select an allow-listed read-only tool. It cannot calculate, invent, approve or execute financial actions. Model-generated prose must not override backend values.
6. Refund, transfer, Paytm/NPCI dispute submit, bank write, external POS write and vendor email/WhatsApp send remain disabled unless the user provides an authorised provider contract, credentials and approval policy. Do not build pretend live integrations.
7. Never commit `.env`, API keys, MID, JWTs, UTR/customer VPA, real bank statements or raw personal data.
8. Use synthetic or explicitly redacted fixtures for tests.

## Phase 0 — inspect before editing

- Inventory the repository and identify the existing backend modules, React screens, all API routes, test suites, environment variables and current demo fixtures.
- Run `python -m pytest -q`, `python -m compileall -q backend`, and `npm run build` before changes if dependencies are available. Record the baseline.
- Trace each screen action to its API endpoint and persistence path. Identify controls that do nothing, stale hard-coded values, unhandled errors, missing loading states and contradictory statuses.
- Do not say a test passed unless you ran it and observed the exit status.

## Phase 1 — visual and UX implementation

- Follow the root `design.md` and `docs/DESIGN_SYSTEM.md` together; the root `design.md` is the portable, tool-readable design contract. Use a light white/neutral canvas, a fixed but responsive workspace navigation, Paytm-blue primary actions, compact money-first metric cards, orderly tables, 8px corners, legible Inter typography, subtle borders and restrained shadows.
- Keep the SettleGraph logo/wordmark. Remove hackathon team/track labels from the app shell and metadata.
- Design for desktop, tablet and 320px mobile. Check horizontal overflow, table scrolling, long IDs, form labels, dialogs/panels, microphone controls and navigation.
- Add clear empty/loading/error/success/offline/demo/imported/staged states. Ensure colour is not the only state indicator.
- Make every button functional. Do not add decorative controls without real behaviour. Add keyboard focus, labels, accessible button names and reduced-motion support.
- Add real charts only where sourced data supports them; no made-up KPIs or visual filler.

## Phase 2 — Sarvam integration verification

The existing adapters use these documented models and routes; check current official docs before changing payloads:

- Saaras v4: `POST https://api.sarvam.ai/speech-to-text`, multipart audio; browser microphone cap 28 seconds, synchronous REST should be under 30 seconds. Long audio needs a separate batch lifecycle; do not pretend the synchronous endpoint supports it.
- Bulbul v4 Flash: `POST https://api.sarvam.ai/text-to-speech`, `text`, `language_code`, `model=bulbul:v4-flash`, `speaker` must be a valid lowercase v4 persona (the documented default can be omitted), `speech_sample_rate`, codec and pace. Maximum request text 2,500 characters.
- Sarvam-105B chat: `POST https://api.sarvam.ai/v1/chat/completions` with the `api-subscription-key` header. Use low/no reasoning for short tool-selection turns (`reasoning_effort: null`) and an explicit output budget. V1 supports Sarvam-105B. Do not switch to `/v2` without updating and testing the request contract.
- All Sarvam Model APIs and Token Factory share one API key and credit balance. Test deliberately, not in loops.

Use official documentation only: https://docs.sarvam.ai/api/getting-started/models, https://docs.sarvam.ai/api-reference/text-to-speech/convert, https://docs.sarvam.ai/api/api-guides-tutorials/speech-to-text/overview, https://docs.sarvam.ai/api/token-factory/chat-completions.

Implementation requirements:
- Keys remain backend-only. Load from `backend/.env` or managed secrets. Never expose through `VITE_*`.
- Keep explicit test endpoints and individual ASR/TTS/chat status. Key configured is not connected. Test state must be truthful and include timestamp/model.
- ASR transcript is untrusted and editable; all IDs/amounts must be confirmed against the active source ledger. Levenshtein results remain candidates requiring human confirmation.
- TTS audio should play, expose errors and use browser speech synthesis only as a clearly labelled fallback. Revoke object URLs and microphone tracks.
- Chat may select only server allow-listed read-only tools. Validate tool names and schemas again server-side, bound the number of calls, reject malformed JSON, and render the final answer from tool outputs rather than LLM-created financial prose.
- Sanitize provider errors; never echo API keys or raw private response payloads to the browser.
- Add mock-based tests for successful provider calls, 4xx/5xx, timeout, invalid JSON, empty transcript/audio, missing key and fallback behaviour. Do not call the live provider during automated tests.

## Phase 3 — feature completeness audit

For every module, provide a verification matrix with UI action → API route → engine/service → persistence → expected outcome → test. Cover:

- Settlement ZIP import, atomic validation, raw Paytm-style CSV preview/staging, explicit batch mapping, reconciliation, unknown adjustments, bank UTR joins, residual explanation and midnight event analysis.
- Evidence graph trace, source references, Merkle tree/root/row proof and evidence packet PDF.
- Policy state machine and Break-the-Case fault toggles; conflicts must lock external actions.
- Counter fake-reference checks, duplicate capture candidates, human review, mock POS sync and idempotency.
- Vendor PO/GRN/invoice/payments, as-of MSME eligibility/due-date estimate, TAT monitor, exception inbox and deterministic Hindi/Hinglish ledger intents.
- Investigations persistence, audit verification, integrations readiness and API health.

Fix defects, not business boundaries. Keep all synthetic examples visibly labelled. Legal/regulatory outputs must state source/rule version, as-of date, eligibility assumptions and when human/legal review is required.

## Phase 4 — data, security and reliability

- Validate Pydantic request schemas, string lengths, numeric ranges, timezone-aware timestamps and date ordering.
- Add bounded request/response sizes, upload chunk limits, ZIP decompression/file-count/path-traversal controls, MIME/signature checks and clear validation errors.
- Ensure CORS is explicit and environment-specific. Never use wildcard origins with credentials. Keep local host binding by default.
- Ensure database writes are atomic and idempotent, errors do not leave partial imports, and process restart restores persisted state as documented.
- Add tests for repeated IDs, multiple payouts, split bank credits, missing/duplicate UTR, reversals/refunds, cutoff boundaries, unknown adjustment types, partial payments, historical as-of calculations, race/idempotency and tampered Merkle proofs.
- Do not claim SQLite is production-concurrent or that a local hash chain is externally immutable. Document PostgreSQL/tenant/auth work separately.

## Phase 5 — build and browser verification

- Install pinned dependencies from the project root's `frontend` folder. Generate and commit `package-lock.json` after a successful clean install.
- `npm run typecheck` and `npm run build` must both pass.
- Start backend and Vite dev server. Use Playwright or browser tooling to open all six sections, verify navigation, run a clean reconciliation, inject a variance, trace a graph edge, break a dispute case, upload a sample ZIP, test voice controls and download the PDF.
- Check desktop, tablet and mobile widths; no clipped top nav, modal, tables or controls. Test keyboard focus and browser console/network failures.
- Capture before/after screenshots and include them in the handoff only if actually generated.

## Phase 6 — integrations and deployment roadmap

Do not invent credentials or provider access. For each provider, record exact required permission, credential/env var names, API contract version, allowed operations, rate limits, webhook signature, idempotency and sandbox availability.

- Paytm: merchant-authorized settlement report/API access and the exact endpoint contract; current access can be production-only.
- Bank: authorized statement/API or approved account aggregator; exact payout UTR mapping.
- POS: provider sandbox, order read/write API and signed webhooks.
- Courier: AWB tracking and verified POD provenance.
- ERP: PO/GRN/invoice/credit-note/payment APIs.
- Sarvam: one API key, model entitlement and sufficient credit balance.

Do not enable any write connector until auth, tenant isolation, role controls, maker-checker approval, idempotency, audit, provider ACK reconciliation, security review and rollback are implemented.

## Required deliverables

1. Updated runnable source tree (no nested ZIPs, databases, caches, `.env` or secrets).
2. `README.md` with exact Windows and cross-platform setup.
3. `docs/DESIGN_SYSTEM.md`, `docs/FEATURE_VERIFICATION_MATRIX.md`, `docs/LIVE_READINESS_ROADMAP.md`, `docs/INTEGRATION_SETUP_GUIDE.md`, `docs/GAP_REGISTER.md`, and `docs/ANTIGRAVITY_CHANGELOG.md`.
4. Backend tests and frontend typecheck/build results, with failures honestly listed.
5. A clean ZIP of the current project only.
6. A final report with: files changed, what became functional, exact test commands/results, browser coverage, credentials still needed, and anything not verified.

## Working style

Make small, auditable, file-by-file changes. After each phase, run the relevant tests. Keep current code if it already works. Do not re-architect merely to use a trendy library. Do not add an LLM wrapper, fake connected badges, mock “live” APIs, or made-up data. Never stop after producing a design mockup: connect each screen control to the actual backend behaviour and verify it.
