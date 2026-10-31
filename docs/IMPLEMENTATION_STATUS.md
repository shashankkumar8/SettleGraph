# Implementation status — 31 October 2026

## Release and source merge

- Current merged code line: **0.5.0**.
- Core baseline: the prior GOAT build's stronger Paytm-aligned reconciliation/evidence/import/voice code.
- Separate v4 contribution: Vendor & Exceptions Desk integrated as a sixth workbench section, with PO/GRN/invoice review, dated vendor receivable fixture, MSME timeline aid, UPI TAT scenarios, Kirana payout fixture, duplicate-capture review and deterministic Hinglish intent router.
- The full merge decision and what was deliberately not copied from v4 are recorded in `V4_FEATURE_AUDIT.md`.

## Local verification completed in this handoff

- Backend regression suite: **107 pytest tests passed** after the v4 merge and as-of-date/duplicate-cluster hardening.
- Python compile check: `python -m compileall -q backend` passed.
- Frontend source syntax transpilation: TypeScript 5.8.3 `transpileModule` reported zero syntax diagnostics for `App.tsx`, `VendorTab.tsx` and `main.tsx`. This is not a full type-check or bundler build.
- FastAPI TestClient smoke checks: `/api/health`, `/api/duplicates`, `/api/exceptions`, `/api/scenarios/kirana-payout`, `/api/scenarios/pending-success` and the vendor receivables `POST` route returned expected responses.
- Duplicate candidate review endpoint returned a local `PENDING_HUMAN_APPROVAL` record with `refund_api_called: false` and `external_action_executed: false`.
- Health route reports version `0.5.0`, synthetic mode and `false` for live Paytm/bank/POS/courier connections, external money movement and external dispute submission.
- API manual smoke was against the local built-in synthetic fixture. It did not contact a provider.

## Main synthetic reconciliation fixture

- 143 payment records total: 140 on the selected capture date plus three isolated counter-operation records.
- Selected capture date gross: ₹50,000.00.
- Selected bank credit: ₹45,718.60.
- Explained difference: ₹4,281.40 through explicitly recorded synthetic rows and one payment assigned to a different batch.
- Unexplained residual: ₹0.00.
- One ₹1,850.00 cross-date capture→nodal event is shown by the bounded two-pointer event analyser. Payout batch membership still comes only from explicit source `payout_batch_id`.

All rates and adjustments in this demo are fixture rows, not Paytm-wide fee assumptions.

## Vendor & Exceptions Desk status

- The Vendor Desk is retained from the separate v4 branch and integrated into the main workbench.
- One built-in synthetic vendor illustrates PO/GRN/invoice and a dated partial payment. The current API does not yet ingest real vendor ERP documents or Udyam records.
- MSMED eligibility is shown only from recorded supplier fields; the app cannot authenticate Udyam registration, activity/NIC code, supply date or legal eligibility.
- The interest estimate requires an operator-provided and explicitly confirmed bank-rate input plus dated principal-changing events. It is a simplified monthly-rest illustration using one rate, not a statutory/legal account; changing rate history, payment appropriation and full legal review remain required.
- RBI UPI TAT view differentiates two named failure categories, P2M T+5 and P2P T+1. Its ₹100/day amount is only a potential scenario calculation; the system does not establish whether the transaction meets every condition or whether compensation was actually paid.
- Vendor follow-up and duplicate-capture buttons stage local human-approval records only. No email/WhatsApp/ERP notice, refund or money movement is performed.
- Kirana payout example is a synthetic ₹80,000 / ₹76,500 example with ₹1,000 intentionally unexplained. It does not guess a fee category.

## Frontend status and target-machine verification

- Six workbench sections exist: Settlement, Evidence Graph, Policy & Safety, Vendor & Exceptions, Counter Operations, Investigations & Audit.
- Frontend API base is configurable with `VITE_API_BASE_URL`; Vite proxies `/api` to the local FastAPI backend during development.
- Backend-unavailable state includes retry rather than showing an empty workbench.
- UTR amount input uses decimal-string to `BigInt` paise parsing and guards unsafe JavaScript number handoff.
- Cutoff event metrics are surfaced in the Settlement screen.
- Live mic recording stops at 28 seconds; uploaded audio is checked against the 30-second Sarvam Saaras REST limit where browser metadata is available and the backend file limit is 10 MB.
- **Full TypeScript project type-check, Vite production build and browser end-to-end test remain unverified.** npm registry access failed in this environment, so React/Vite/lucide dependencies could not be installed from scratch. On the target Windows laptop run `npm install`, `npm run build`, then perform the browser checklist in `LIVE_READINESS_ROADMAP.md`.

## Sarvam status

- Saaras v4, Bulbul v4 Flash and Sarvam-105B API adapters are key-gated.
- `.env` loading does not overwrite already set process variables.
- Sarvam chat model is limited to a backend allow-list; output used for financial values is rendered from deterministic backend results, not free-form model prose.
- V1 `reasoning_effort: null` disables reasoning for the Sarvam-105B chat request. The budget and timeout remain bounded.
- TTS payload uses the documented `language_code` field. ASR failure returns no invented transcript.
- **No live call using the team's actual Sarvam key/credits has been verified in this handoff.** Test on the target network and verify fallback after network/credit failure.

## Not implemented / not verified for production

- No live Paytm, NPCI, bank, POS, courier, ERP, Udyam or vendor portal integration. No provider write action is enabled.
- Capture and nodal event fields for the local cutoff analyser are carried on normalized rows; production requires independent authoritative feeds and provider-defined timezone/cutoff semantics.
- UDIR/RGNB reason-code/state policy catalogue is synthetic and needs current authoritative source documents, versioning and compliance approval.
- Authentication, tenant isolation, RBAC/dual approval, PostgreSQL concurrency, managed secrets, immutable external audit anchoring and security review remain open.
- Vendor interest requires RBI Bank Rate history and a legally validated calculator before being shown as statutory interest.
- No cloud deployment, production observability, incident runbooks or merchant pilot have been completed.

## Before a live demo

1. Extract into a clean folder and use two PowerShell terminals.
2. Start the backend with `.\start_backend.ps1` from the project root.
3. Start the frontend with `.\start_frontend.ps1` after npm dependencies install successfully.
4. Run `npm install` and `npm run build` inside `frontend`.
5. Run `python -m pytest -q` in `backend` and confirm **107 passed**.
6. Verify `/api/health` says local synthetic mode and all live provider/write flags are false.
7. Test each of the six sections, ZIP import, cutoff view, Break-the-Case, duplicate review, local POS sync, Vendor Desk, TAT examples and PDF download.
8. Configure Sarvam only on the backend and demonstrate live mode only after a successful real call; otherwise explain the offline fallback honestly.

See `LIVE_READINESS_ROADMAP.md` for the full clean-start checklist and production gates.
