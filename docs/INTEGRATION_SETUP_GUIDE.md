# Integration setup guide — SettleGraph v0.5.3

This guide separates credentials that can enable an existing adapter from integrations that still require a new, provider-approved adapter. **Do not send API keys, MID values, passwords, JWTs, OTPs, customer VPAs, bank statements or unredacted merchant exports in chat.** Keep secrets in `backend/.env` or a managed secret store. Never put backend secrets in `frontend/.env`, `VITE_*`, screenshots, GitHub issues or the browser.

## 1. Current connection state

| System | Current implementation | What you must obtain | Important boundary |
|---|---|---|---|
| Sarvam AI | Existing Chat/ASR/TTS adapters | Sarvam API subscription key and enabled model entitlement | Can be tested now; a configured key is not a tested connection |
| Paytm settlement | Local CSV normalizer, preview and staged mapping | Merchant-authorized API/report access and current contract | No live Paytm API client is implemented |
| Bank | CSV-based exact payout UTR matching | Approved bank/aggregator statement API or official export | No bank connection exists |
| POS | Local mock order | POS sandbox account, API contract and webhook signing details | Mock sync must not be called a live POS update |
| Courier | Evidence schema/local demo | Courier sandbox, AWB event API and proof provenance | No live courier lookup exists |
| Vendor ERP | Synthetic PO/GRN/invoice example | ERP sandbox and data export/API contract | No live ERP/WhatsApp/email notice is sent |
| Udyam/MSME | Recorded-field eligibility aid | Authorized verification route or verified documentary evidence | User-supplied Udyam number/boolean is not authenticated |

The `/api/integrations/status` endpoint and Investigations & Audit screen display this state. The configured-key flag never implies that the provider is connected; individual component check results are recorded separately.

## 2. Sarvam AI — the only provider API that can be enabled without writing a new adapter

### Obtain the key

1. Sign in to the Sarvam developer platform using the team's account.
2. Create an API subscription key and confirm that the account has entitlement/credits for the selected models.
3. Check the account's rate limits, payload limits, audio duration limits and billing/credit counters. Do not assume trial credits or a model name is enabled just because it appears in a sample configuration.
4. Store the key only in `backend/.env` on the machine that runs FastAPI.

The current Sarvam Model APIs documentation says the speech models and Token Factory model family use the same API key and credit balance. Budget your Saaras, Bulbul and Sarvam-105B tests as one shared balance, not independent pools. A key value may only be shown once when created; store it safely and rotate/revoke it from the dashboard if exposed.

Official documentation:

- Authentication: https://docs.sarvam.ai/api-reference/authentication
- Speech-to-text overview: https://docs.sarvam.ai/api/api-guides-tutorials/speech-to-text/overview
- Speech-to-text REST: https://docs.sarvam.ai/api/api-guides-tutorials/speech-to-text/rest-api
- Saaras v4 keyterms: https://docs.sarvam.ai/api/api-guides-tutorials/speech-to-text/how-to/keyterms
- Text-to-speech: https://docs.sarvam.ai/api/api-guides-tutorials/text-to-speech/overview
- Sarvam-105B chat completions: https://docs.sarvam.ai/api/token-factory/chat-completions

### Configure

From the project root in PowerShell:

```powershell
Copy-Item .\backend\.env.example .\backend\.env
notepad .\backend\.env
```

Set values only after confirming the model IDs are enabled on the team's account:

```dotenv
SARVAM_API_KEY=PASTE_KEY_LOCALLY_ONLY
SARVAM_BASE_URL=https://api.sarvam.ai
SARVAM_CHAT_MODEL=sarvam-105b
SARVAM_ASR_MODEL=saaras:v4
SARVAM_TTS_MODEL=bulbul:v4-flash
SARVAM_TTS_SPEAKER=shubh_enhi_ads
```

Do not paste the key into React, a `VITE_` variable, the browser, source code or this conversation. `.env` is ignored by Git. Restart the backend after editing it.

### Test the API routes

Start the backend, open `http://127.0.0.1:8000/docs`, and test each independently:

1. `POST /api/voice/transcribe`: upload a short, clear Hindi/Hinglish WAV/MP3/OGG/AAC/FLAC recording. Current browser capture stops at 28 seconds to stay below the Saaras REST short-audio duration limit. The app upload ceiling is 10 MB. Confirm returned `mode` is `LIVE_SAARAS_ASR` and review every digit/reference manually.
2. `POST /api/voice/speak`: test `text` under 2,500 characters and `language_code: hi-IN`. Confirm audio plays and the response header identifies live Bulbul. Check that the selected speaker is available on the account.
3. `POST /api/agent/chat`: start with a harmless read-only query such as “Explain the selected settlement batch.” Inspect the tool trace and returned deterministic values. The model may choose an allow-listed read-only tool; it must not create a refund, assert that a payment is genuine from a screenshot, or perform financial arithmetic.
4. In the Integrations panel, click **Test Sarvam · uses credits**. This explicitly calls one short Sarvam-105B chat request and one short Bulbul TTS request. It records separate `PASS` / `FAIL` states in `/api/integrations/status`. This test consumes credits; do not click it repeatedly.
5. Test Saaras separately by recording or uploading a clear audio clip (the browser limits mic capture to 28 seconds; the synchronous REST flow is intended for audio under 30 seconds). The ASR component result is updated only after a provider response is received.
6. Check `GET /api/integrations/status`. `api_key_configured=true` only confirms that a non-empty key is loaded. A component becomes `PASS` only after its corresponding live request succeeds. Do not change the API's connected flags by hand.

If a provider call fails or credits are exhausted, ASR returns no fabricated transcript, TTS reports an unavailable response, and chat falls back to deterministic read-only behaviour. Do not describe fallback as live Sarvam usage.

### Credit-safe testing

- Test chat + TTS once using the explicit button, then test one short ASR sample from the microphone/audio upload.
- Check the provider usage dashboard after each call.
- Do not run a loop that sends the same audio/chat prompt repeatedly.
- Keep recordings short and avoid customer identifiers; use synthetic UTR/order IDs.
- Add monitoring and per-merchant quotas before enabling multi-tenant access.

## 3. Paytm settlement reports/API

Start with merchant-authorized exports and contract samples. The official merchant settlement report documentation describes report fields and delivery channels. Official API documents describe settlement and payout-level details, but their published availability/authorisation conditions must be confirmed with Paytm for the actual merchant account.

Official references:

- Settlement reports: https://www.paytmpayments.com/docs/settlement-reports-on-dashboard
- Settlement API: https://www.paytmpayments.com/docs/api/settlement-api
- Settlement Detail API: https://www.paytmpayments.com/docs/api/settlement-detail-api/
- Settlement Transaction Detail API: https://www.paytmpayments.com/docs/api/settlement-transaction-detail-api/

Ask the Paytm account manager/merchant onboarding or hackathon partner contact for:

- Written permission and an approved merchant MID/account to use.
- API product entitlement and current production/sandbox availability (do not assume a sandbox exists).
- Current authentication method for the chosen endpoint: the Settlement API documentation shows a request checksum signature; the Settlement Detail API documentation says merchant JWT authentication. Obtain the actual JWT/checksum generation contract, required headers, expiry and rotation process from Paytm.
- Exact endpoint contract, request parameters, date-range restrictions and response examples.
- Settlement batch ID, payout UTR, split payout, refund/chargeback and reversal semantics.
- Webhook event types, signature verification, timestamp tolerance and replay/idempotency contract.
- Rate limits, IP allow-listing, support escalation and permitted data-retention rules.

First validate redacted statement/report files through the existing import flow. Build a separate provider adapter only after you have the official contract and representative redacted payloads. Contract tests must prove pagination, empty results, split payouts, refund/reversal rows, timezone/date boundaries and schema-version handling. Do not guess batch membership from a timestamp or generic UTR field.

## 4. Bank statement integration

There is no generic “bank API key” that works for all Indian merchant accounts. Ask the merchant's bank for an approved corporate/API statement product, or use an authorized account-aggregator/financial-data provider under its consent and compliance requirements. For the hackathon, an official redacted bank settlement statement is the safest route.

Required fields should include at minimum: bank account reference token (not raw account number), credit/debit direction, amount, currency, value date, posting timestamp with timezone, transfer UTR/reference, narration, source statement ID and reversal linkage. Confirm which bank UTR maps to which Paytm payout UTR. Amount-and-date proximity alone is not a match.

## 5. POS integration

Ask the POS provider for a sandbox/partner account and the following contracts:

- Read order by merchant order ID and retrieve invoice total, currency, payment status and order version.
- Idempotent payment-state update endpoint (only after approval and provider authorization).
- Signed webhooks with documented HMAC/JWS scheme, event ID, timestamp and retry policy.
- API scopes, rate limits, test fixtures and acknowledgement/error semantics.

Implementation sequence: read-only lookup adapter → signed webhook verifier → idempotent local event inbox → sandbox write only after maker-checker approval → reconciliation of provider acknowledgement. The present local mock order must remain clearly labelled as a mock.

## 6. Courier / delivery evidence

Obtain an approved courier sandbox/API, AWB tracking event schema, webhook signature mechanism and proof-of-delivery availability. Document how OTP verification is represented and who attests to it. Never persist or display the raw delivery OTP unless a legally reviewed workflow requires it; store a verification result and source reference instead. A courier “delivered” event is not automatically a customer-authorised proof for every dispute reason code.

## 7. Vendor ERP, notices and Udyam

For ERP integration, request API access to purchase orders, GRNs, invoices, credit notes, dated payment allocations and supplier master records. Preserve each source document ID and revision. Do not infer a GRN from an invoice or infer acceptance from the absence of an event unless the ERP contract says so.

For email/WhatsApp notices, obtain explicit organisation and recipient authorization, approved templates, sending-domain/WhatsApp Business setup, opt-in evidence, delivery status callbacks, unsubscribe/escalation handling and an operator approval step. Nothing in this build currently sends vendor notices.

For MSME eligibility, obtain verified Udyam and activity/NIC evidence through an authorized method and confirm the relevant registration/supply dates with counsel. Do not treat a typed Udyam number or “Micro” selection as a verified legal determination. Keep the present Vendor Desk output labelled as a workflow aid/illustrative estimate.

## 8. Production deployment — prerequisites before public exposure

The current application is a single-workspace local prototype. It has no user authentication, tenant isolation, production RBAC or live external connectors. Do not deploy it publicly as-is or upload unredacted merchant/customer PII.

Production hardening sequence:

1. Identity provider and authentication (OIDC/OAuth2), tenant scoping on every query and mutation, RBAC and maker-checker/dual authorization.
2. PostgreSQL schema and migrations, transaction-safe idempotency, durable job queue and concurrency tests. The current SQLite store is for local demo use; PostgreSQL `SKIP LOCKED` is not implemented.
3. Secret manager/KMS, key rotation, TLS, reverse proxy, explicit CORS, request size limits, rate limits, audit/PII minimisation and encrypted object storage.
4. Webhook signature verification, replay protection, provider correlation IDs, retry/backoff, dead-letter queues and reconciliation of provider acknowledgements.
5. External/WORM audit anchoring, backups, restore drills, observability, alerting, incident response and retention/deletion policies.
6. Threat modelling, security review/penetration test, legal/compliance approval and controlled pilot with one authorized merchant.
7. Only then consider an action connector. Start with read-only provider APIs. Refunds or dispute submission require separate provider authorization, maker-checker approval, transaction limits, beneficiary validation and explicit production sign-off.

## 9. Definition of “integration complete”

Do not mark a connector live because an API key exists. It is complete only when all of the following pass against the provider-approved sandbox or authorized source:

- Valid credentials work; invalid/expired credentials are rejected without leaking secrets.
- Contract/schema version is pinned and verified using redacted fixtures.
- Signature and timestamp checks reject tampered/replayed webhooks.
- Duplicate events are idempotent; retries do not duplicate records/actions.
- Partial payouts, split batches, reversals/refunds, out-of-order events and missing identifiers are covered.
- Tenant isolation and role authorization tests pass.
- Amounts are integer paise end-to-end and provider acknowledgement is reconciled to source evidence.
- Human review and immutable audit are demonstrated for every money-moving action.
- Monitoring, rate-limit handling, secret rotation and rollback are tested.

Until these gates pass, display “not connected”, “staged”, “mock” or “manual import”—never “live”.

## 10. Verified provider-documentation constraints checked for this release

- Sarvam currently documents Saaras v4 REST as synchronous transcription for files **under 30 seconds**; batch is documented for longer audio, but this project does not implement the batch job lifecycle.
- Sarvam's current Bulbul v4 Flash guide uses `language_code`, `model`, persona-style `speaker` identifiers, `speech_sample_rate`, `output_audio_codec` and `pace`; the 2,500-character text limit is documented. The default `shubh_enhi_ads` speaker is a valid v4 Flash default.
- Sarvam documents V1 Chat Completions at `/v1/chat/completions` for `sarvam-105b`; `reasoning_effort: null` disables reasoning in V1. Do not switch this model to the V2 path without changing and testing the adapter contract.
- Paytm's current Settlement API page says production-only, max one-day date range, checksum signature, pagination and page size up to 20. The Settlement Detail API page says production-only, JWT authentication, max one-week date range and page size up to 20.
- RBI's 20 September 2019 failed-transaction framework separates UPI transfer beneficiary-not-credited (T+1) from UPI merchant confirmation-missing (T+5); its ₹100/day compensation applies to the named failed-transaction categories after their respective timelines, not to every dispute/chargeback.
- The Ministry's MSEFC guidance says the delayed-payment provisions apply to Micro/Small Udyam manufacturing and services; trading NIC 45–47 is excluded. The statute guidance describes a 45-day maximum agreed period and compound interest at three times the RBI Bank Rate with monthly rests. Eligibility and legal calculation still require verification for each supply.

Check the linked official pages again when implementing a production adapter because provider API versions and entitlements can change.


## 11. Sarvam diagnostics added in v0.5.3

`POST /api/integrations/sarvam/test` accepts `{ "test_chat": true, "test_tts": true }`. It is intentionally opt-in, fails closed when no key is present, and calls only the selected model APIs. It does not invoke merchant tools or any financial action. The response states that credits were consumed. The readiness endpoint returns the last in-process result for `chat`, `tts` and `asr`; these diagnostics reset when the backend restarts and are not a permanent provider SLA monitor.

Current documented API mapping: Saaras v4 uses `POST /speech-to-text`; Bulbul v4 Flash uses `POST /text-to-speech` with `language_code` and an optional persona speaker; Sarvam-105B uses `POST /v1/chat/completions`. The adapter remains server-side. See the linked official Sarvam docs above and re-check them before any model or payload change.
