# Start the Stage 2 SettleGraph build — Windows / VS Code

This guide now targets the delivered `SettleGraph_Team_Aliens` folder. It supersedes older archive instructions referring to `settlegraph-buildpack-v2` or the 23-test MVP.

## Prerequisites

- Windows 10/11
- Python 3.11 or newer
- Node.js 20 or newer and npm
- Internet access for the initial dependency installation

## 1. Open the project

Extract `SettleGraph_Team_Aliens_FINAL.zip` to a writable path such as `C:\PaytmHackathon\SettleGraph_Team_Aliens`, open that folder in VS Code, and open two PowerShell terminals.

## 2. Start the backend

In terminal 1, from the project root:

```powershell
.\start_backend.ps1
```

The script creates `backend/.venv`, installs Python dependencies and starts Uvicorn. Check:

- <http://127.0.0.1:8000/api/health>
- <http://127.0.0.1:8000/docs>

The health response must show that live Paytm and external money movement are disabled.

## 3. Run tests

In another terminal:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python -m pytest -q
```

Expected current result: **107 passed**. Re-run the suite on the event laptop rather than relying only on the package verification.

## 4. Start the frontend

From the project root in terminal 2:

```powershell
.\start_frontend.ps1
```

Open <http://127.0.0.1:5173>. If the script's npm installation fails, run `npm install` manually from `frontend`, resolve the dependency/network issue, then run `npm run build`. Do not claim the browser build passed until that command succeeds.

## 5. Judge workflow to exercise

1. Settlement: baseline result, cutoff event analysis and ₹100 shortfall fault.
2. Evidence graph: a source path and exact match rule.
3. Import: raw Paytm-style CSV preview, then explicit mapping stage. Verify the active canonical dataset is unchanged.
4. Policy lab: clean case, then corrupt OTP or alter invoice amount. Show the three-way Merkle root change.
5. Counter operations: stage duplicate-debit approval and record a local manual-handoff decision.
6. POS order: sync the local mock order with its idempotency key.
7. PDF: compile a four-exhibit packet that includes the dispute Merkle data.
8. Vendor & Exceptions: PO/GRN/invoice review, rate-confirmation gate and P2M/P2P TAT distinction. State that the fixtures are synthetic.
9. Voice: live Sarvam only if the key and network were tested; otherwise show the labelled offline fallback.

## 6. Code-reading order

`backend/seed_data.py` → `backend/engine.py` → `backend/paytm_settlement_adapter.py` → `backend/main.py` → `backend/store.py` → `backend/tests/` → `backend/sarvam_service.py` → `backend/pdf_compiler.py` → `frontend/src/App.tsx` → `frontend/src/styles.css`.

## 7. Important boundaries

- Use synthetic or explicitly authorised/redacted data only.
- Never commit `backend/.env` or expose Sarvam keys in the frontend.
- Batch membership is not inferred from timestamps.
- A missing UTR in the local dataset is not proof of fraud.
- A hash is not source authentication.
- Approval is a local handoff record, not a refund.
- The POS flow updates a local mock record, not a real merchant POS.
- No live Paytm/NPCI submission is enabled.

For detailed implementation phases, see [PHASED_ROADMAP.md](PHASED_ROADMAP.md) and [LIVE_READINESS_ROADMAP.md](LIVE_READINESS_ROADMAP.md); for verified scope and limitations, see [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) and [GAP_REGISTER.md](GAP_REGISTER.md).
