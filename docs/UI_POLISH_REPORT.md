# UI and integration polish report — v0.5.3

## Product-facing changes

- Removed hackathon team/track branding from the React application shell. The workspace now identifies itself as SettleGraph / Merchant Finance Workspace.
- Replaced the dark workbench styling with the supplied Paytm-inspired light direction: `#00baf2` primary, white surfaces, neutral canvas, Inter typography, compact controls, 8px surfaces and restrained borders/shadows.
- Added a standalone SettleGraph graph mark; no Paytm logo or brand asset is used.
- Added mobile/tablet layout rules, horizontal table overflow, visible keyboard focus and reduced-motion support.
- Added visible per-component Sarvam readiness states and an explicit live test button in the Integration Readiness panel.

## Sarvam integration path

- Chat check: one low-cost Sarvam-105B request to `/v1/chat/completions`.
- TTS check: one short Bulbul request to `/text-to-speech`.
- ASR check: performed separately through the existing `/speech-to-text` audio upload/record workflow.
- The backend key remains server-side. A configured key is not considered a successful connection. Chat/TTS diagnostic requests consume the shared account credit balance; tests use mocked provider responses and never call the real service.
- No Sarvam credentials were supplied in this work session; live provider connectivity has not been verified.

## Checks actually run

| Check | Result |
|---|---|
| `python -m compileall -q backend` | Passed |
| `python -m pytest -q` | 117 passed |
| CSS parse with tinycss2 | 345 rules, zero parse errors |
| TypeScript transpile syntax: `App.tsx`, `VendorTab.tsx`, `main.tsx` | Passed |
| App branding/version/design/prompt assertions | Passed |
| `npm run build` | Not passed in this environment: React, lucide-react and their type packages are absent because npm install timed out. This is an environment dependency failure, not a verified production build. |
| Browser visual/responsive test | Not run; no browser session with installed frontend dependencies was available. |
| Live Sarvam API test | Not run; no user API key was supplied. |

## Required local verification

From `frontend/` run `npm install`, then `npm run typecheck` and `npm run build`. Start backend and frontend, open all six workspace sections at desktop/tablet/320px widths, test the Sarvam chat/TTS diagnostic once, test Saaras with a short synthetic Hindi sample, play the generated audio, and download the evidence PDF. Record any actual provider error response with all secrets and personal data redacted.
