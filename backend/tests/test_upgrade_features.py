from copy import deepcopy

import pytest
from fastapi.testclient import TestClient

import main
import store
from engine import dataset_merkle_tree, verify_merkle_proof, reconcile
from seed_data import ADJUSTMENTS, BANK_CREDITS, SETTLEMENT_BATCHES, TARGET_BATCH_ID, TARGET_CAPTURE_DATE, TRANSACTIONS

client = TestClient(main.app)


def test_multiple_bank_credit_rows_for_one_payout_are_aggregated():
    banks = deepcopy(BANK_CREDITS)
    original = banks[0]
    original["credit_paise"] = 2_000_000
    second = deepcopy(original)
    second["bank_row_id"] = "BANK-ROW-0002"
    second["credit_paise"] = 2_571_860
    banks.append(second)
    result = reconcile(deepcopy(TRANSACTIONS), deepcopy(ADJUSTMENTS), deepcopy(SETTLEMENT_BATCHES), banks, TARGET_CAPTURE_DATE, TARGET_BATCH_ID)
    assert result["actual_bank_paise"] == 4_571_860
    assert result["residual_paise"] == 0
    assert result["status"] == "RECONCILED"


def test_blank_utr_is_not_labelled_fraud_or_duplicate():
    txns = deepcopy(TRANSACTIONS)
    txns[0]["utr_rrn"] = None
    result = reconcile(txns, deepcopy(ADJUSTMENTS), deepcopy(SETTLEMENT_BATCHES), deepcopy(BANK_CREDITS), TARGET_CAPTURE_DATE, TARGET_BATCH_ID)
    assert not any("fraud" in issue.lower() or "duplicate transaction UTR/RRN" in issue for issue in result["issues"])


def test_merkle_tree_proof_verifies_and_detects_leaf_tampering():
    tree = dataset_merkle_tree(TRANSACTIONS, ADJUSTMENTS, SETTLEMENT_BATCHES, BANK_CREDITS)
    leaf = tree["leaves"][0]
    proof = tree["proofs"][f"{leaf['kind']}:{leaf['id']}"]
    assert verify_merkle_proof(leaf["leaf_sha256"], proof, tree["root_sha256"])
    assert not verify_merkle_proof("0" * 64, proof, tree["root_sha256"])


def test_merkle_integrity_api_returns_verified_row_proof():
    row_id = TRANSACTIONS[0]["pg_txn_id"]
    response = client.get(f"/api/integrity/merkle?kind=payment&record_id={row_id}")
    assert response.status_code == 200
    assert response.json()["proof_valid"] is True
    assert response.json()["leaf"]["id"] == row_id


def test_raw_paytm_csv_preview_is_not_activated_and_preserves_file_hash():
    payload = (
        "Transaction ID,Transaction Type,Status,Amount,Commission,GST,Settled Amount,UTR No\n"
        "TX-PREVIEW-1,Acquiring,Success,100.00,1.00,0.18,98.82,UTR-123\n"
    ).encode()
    before_mode = client.get("/api/import/status").json()["mode"]
    response = client.post("/api/import/paytm-csv/preview", files={"file": ("paytm.csv", payload, "text/csv")})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "VALIDATED_PREVIEW_NOT_ACTIVATED"
    assert body["activation_allowed"] is False
    assert body["sample_rows"][0]["amount_paise"] == 10000
    assert body["unresolved_batch_assignment_count"] == 1
    assert client.get("/api/import/status").json()["mode"] == before_mode


def test_agent_chat_falls_back_without_claiming_live_model(monkeypatch):
    monkeypatch.delenv("SARVAM_API_KEY", raising=False)
    response = client.post("/api/agent/chat", json={"prompt": "Why is my settlement short?"})
    assert response.status_code == 200
    body = response.json()
    assert body["agent_mode"] == "OFFLINE_DETERMINISTIC_FALLBACK"
    assert body["model"] is None
    assert body["financial_arithmetic"] == "DETERMINISTIC_BACKEND_ONLY"
    assert body["external_actions_enabled"] is False


def test_voice_reference_candidate_never_auto_binds():
    response = client.post("/api/voice/bind-reference", json={"spoken_reference": "PTM-TXN-1001", "max_distance": 2})
    assert response.status_code == 200
    body = response.json()
    assert body["requires_confirmation"] is True
    assert body["status"] == "EXACT_MATCH"


def test_active_dataset_survives_local_store_reload(monkeypatch, tmp_path):
    monkeypatch.setattr(store, "DB_PATH", tmp_path / "setttlegraph-test.sqlite3")
    store.init_db()
    dataset = {
        "transactions": [{"pg_txn_id": "TX-1", "gross_paise": 100}],
        "adjustments": [],
        "settlement_batches": [{"batch_id": "B-1"}],
        "bank_credits": [],
    }
    store.save_active_dataset(dataset, "2026-10-31", "B-1", "UPLOADED_LOCAL_CSV_BUNDLE", "a" * 64)
    loaded = store.load_active_dataset()
    assert loaded is not None
    assert {key: value for key, value in loaded["dataset"].items() if key != "disputes"} == dataset
    assert loaded["dataset"]["disputes"] == []
    assert loaded["capture_date"] == "2026-10-31"
    assert loaded["batch_id"] == "B-1"
    assert loaded["source_file_sha256"] == "a" * 64
    store.clear_active_dataset()
    assert store.load_active_dataset() is None


def test_four_exhibit_pdf_has_four_sections_and_optional_voice_text():
    from pypdf import PdfReader
    import io

    response = client.post("/api/evidence-packet/compile", json={
        "case_id": "DSP-DEMO-2049",
        "voice_transcript": "Mera UTR 629810445566 hai, payment status check kijiye.",
        "voice_language_code": "hi-IN",
    })
    assert response.status_code == 200, response.text[:500]
    assert response.content.startswith(b"%PDF")
    reader = PdfReader(io.BytesIO(response.content))
    assert len(reader.pages) == 4
    text = "\n".join(page.extract_text() or "" for page in reader.pages)
    assert "EXHIBIT A" in text
    assert "EXHIBIT B" in text
    assert "EXHIBIT C" in text
    assert "EXHIBIT D" in text
    assert "DSP-DEMO-2049" in text
    assert "Mera UTR" in text


def test_audit_hash_chain_verifies_and_detects_local_row_tampering(monkeypatch, tmp_path):
    monkeypatch.setattr(store, "DB_PATH", tmp_path / "audit-chain.sqlite3")
    store.init_db()
    store.record_audit("test", "CASE_OPENED", "A local case was opened", "b" * 64)
    store.record_audit("test", "CASE_REVIEWED", "A local case was reviewed", "c" * 64)
    assert store.verify_audit_chain()["integrity_valid"] is True
    with store._connect() as conn:
        conn.execute("UPDATE audit_events SET detail='tampered' WHERE id=1")
    result = store.verify_audit_chain()
    assert result["integrity_valid"] is False
    assert result["first_invalid_event_id"] == 1


def test_audit_verification_api_exposes_integrity_status():
    response = client.get("/api/audit/verify")
    assert response.status_code == 200
    assert response.json()["integrity_valid"] is True


def test_paytm_csv_mapping_is_explicit_and_only_stages_source(monkeypatch, tmp_path):
    monkeypatch.setattr(store, "DB_PATH", tmp_path / "staging.sqlite3")
    store.init_db()
    before = client.get("/api/demo/reconcile").json()["snapshot_sha256"]
    payload = (
        "Transaction ID,Order ID,Transaction Date,Transaction Type,Status,Amount,Commission,GST,Settled Amount,UTR No\n"
        "TX-STAGE-1,ORD-STAGE-1,2026-10-26 10:00:00,Acquiring,Success,100.00,1.00,0.18,98.82,UTR-TXN-1\n"
    ).encode()
    rejected = client.post(
        "/api/import/paytm-csv/stage",
        files={"file": ("merchant.csv", payload, "text/csv")},
        data={"target_capture_date": "2026-10-26", "target_batch_id": "BATCH-STAGE-1", "payout_utr": "BANKUTR123456", "payout_date": "2026-10-27", "mapping_acknowledged": "false"},
    )
    assert rejected.status_code == 400
    accepted = client.post(
        "/api/import/paytm-csv/stage",
        files={"file": ("merchant.csv", payload, "text/csv")},
        data={"target_capture_date": "2026-10-26", "target_batch_id": "BATCH-STAGE-1", "payout_utr": "BANKUTR123456", "payout_date": "2026-10-27", "mapping_acknowledged": "true"},
    )
    assert accepted.status_code == 200, accepted.text
    body = accepted.json()
    assert body["status"] == "STAGED_FOR_CANONICAL_RECONCILIATION"
    assert body["active_ledger_changed"] is False
    assert body["stage_id"].startswith("STG-")
    assert client.get("/api/demo/reconcile").json()["snapshot_sha256"] == before
    assert len(client.get("/api/import/staged-paytm-exports").json()) == 1


def test_agent_chat_falls_back_when_configured_sarvam_times_out(monkeypatch):
    monkeypatch.setattr(main, "sarvam_is_configured", lambda: True)
    def fail(*args, **kwargs):
        raise TimeoutError("provider timeout")
    monkeypatch.setattr(main, "sarvam_chat_completion", fail)
    response = client.post("/api/agent/chat", json={"prompt": "Explain my payout shortfall"})
    assert response.status_code == 200
    body = response.json()
    assert body["agent_mode"] == "OFFLINE_DETERMINISTIC_FALLBACK_AFTER_SARVAM_ERROR"
    assert body["model"] is None
    assert "provider timeout" in body["note"]
    assert body["external_actions_enabled"] is False


def test_voice_no_key_returns_no_fake_transcript(monkeypatch):
    monkeypatch.setattr(main, "sarvam_is_configured", lambda: False)
    response = client.post("/api/voice/transcribe", files={"file": ("voice.webm", b"synthetic-audio", "audio/webm")})
    assert response.status_code == 200
    body = response.json()
    assert body["transcript"] is None
    assert body["mode"] == "ASR_UNAVAILABLE_MANUAL_TEXT_REQUIRED"


def test_duplicate_debit_stages_idempotent_human_approval_without_refund(monkeypatch, tmp_path):
    monkeypatch.setattr(store, "DB_PATH", tmp_path / "approval.sqlite3")
    store.init_db()
    first = client.post("/api/operations/duplicate-debits/check", json={"case_id": "DSP-DEMO-2052"})
    second = client.post("/api/operations/duplicate-debits/check", json={"case_id": "DSP-DEMO-2052"})
    assert first.status_code == 200 and second.status_code == 200
    assert first.json()["approval"]["approval_id"] == second.json()["approval"]["approval_id"]
    assert second.json()["approval"]["idempotent_replay"] is True
    assert first.json()["refund_api_called"] is False
    approvals = client.get("/api/approvals").json()
    assert len([a for a in approvals if a["case_id"] == "DSP-DEMO-2052"]) == 1


def test_approval_decision_is_manual_handoff_only(monkeypatch, tmp_path):
    monkeypatch.setattr(store, "DB_PATH", tmp_path / "decision.sqlite3")
    store.init_db()
    staged = store.create_human_approval(case_id="DSP-1", action_type="REFUND_REVIEW", amount_paise=500, evidence_sha256="a" * 64)
    response = client.post(
        f"/api/approvals/{staged['approval_id']}/decision",
        json={"decision": "APPROVE", "decided_by": "TEST_OPERATOR", "note": "Reviewed"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["approval"]["status"] == "APPROVED_FOR_MANUAL_HANDOFF"
    assert body["manual_handoff_only"] is True
    assert body["external_action_executed"] is False


def test_mock_pos_sync_is_idempotent_and_external_api_free(monkeypatch, tmp_path):
    monkeypatch.setattr(store, "DB_PATH", tmp_path / "pos.sqlite3")
    store.init_db()
    first = client.post("/api/operations/orders/ORD-DEMO-3310/sync", headers={"Idempotency-Key": "demo-pos-key-1"})
    second = client.post("/api/operations/orders/ORD-DEMO-3310/sync", headers={"Idempotency-Key": "demo-pos-key-1"})
    assert first.status_code == 200 and second.status_code == 200
    assert first.json()["order"]["order_status"] == "PAID"
    assert first.json()["external_pos_called"] is False
    assert second.json()["order"]["sync_result"] == "IDEMPOTENT_NO_OP"
    assert second.json()["external_pos_called"] is False


def test_sarvam_tts_request_uses_documented_language_code_field(monkeypatch):
    import base64
    import sarvam_service

    captured = {}
    class FakeResponse:
        def raise_for_status(self):
            return None
        def json(self):
            return {"audios": [base64.b64encode(b"RIFF-demo").decode()]}
    def fake_post(url, **kwargs):
        captured["url"] = url
        captured.update(kwargs)
        return FakeResponse()
    monkeypatch.setattr(sarvam_service, "api_key", lambda: "test-only")
    monkeypatch.setattr(sarvam_service, "SARVAM_TTS_SPEAKER", "shubh_enhi_ads")
    monkeypatch.setattr(sarvam_service.requests, "post", fake_post)
    audio = sarvam_service.synthesize_speech("Namaste", "hi-IN")
    assert audio == b"RIFF-demo"
    assert captured["json"]["language_code"] == "hi-IN"
    assert "target_language_code" not in captured["json"]
    assert captured["json"]["model"] == "bulbul:v4-flash"
    assert captured["json"]["speaker"] == "shubh_enhi_ads"
    assert captured["json"]["output_audio_codec"] == "wav"


def test_sarvam_chat_tool_selection_disables_reasoning_for_credit_efficiency(monkeypatch):
    import sarvam_service

    captured = {}
    class FakeResponse:
        def raise_for_status(self):
            return None
        def json(self):
            return {"model": "sarvam-105b", "choices": [{"message": {"content": ""}}]}
    def fake_post(url, **kwargs):
        captured["url"] = url
        captured.update(kwargs)
        return FakeResponse()
    monkeypatch.setattr(sarvam_service, "api_key", lambda: "test-only")
    monkeypatch.setattr(sarvam_service.requests, "post", fake_post)
    sarvam_service.chat_completion([{"role": "user", "content": "Check payout"}], [{"type": "function"}])
    assert captured["url"].endswith("/v1/chat/completions")
    assert captured["json"]["model"] == "sarvam-105b"
    assert captured["json"]["reasoning_effort"] is None
    assert captured["json"]["max_tokens"] == 500
    assert captured["json"]["parallel_tool_calls"] is False


def test_sarvam_local_env_loader_does_not_override_process_env(monkeypatch, tmp_path):
    import sarvam_service
    env_file = tmp_path / ".env"
    env_file.write_text('SARVAM_API_KEY="from-file"\nSARVAM_CHAT_MODEL=sarvam-test\n# comment\n', encoding="utf-8")
    monkeypatch.setattr(sarvam_service, "__file__", str(tmp_path / "sarvam_service.py"))
    monkeypatch.setenv("SARVAM_API_KEY", "from-process")
    monkeypatch.delenv("SARVAM_CHAT_MODEL", raising=False)
    sarvam_service._load_local_env()
    assert sarvam_service.os.environ["SARVAM_API_KEY"] == "from-process"
    assert sarvam_service.os.environ["SARVAM_CHAT_MODEL"] == "sarvam-test"


def test_dispute_merkle_binds_three_evidence_domains_and_fault_changes_root():
    clean = client.post("/api/disputes/DSP-DEMO-2049/evaluate", json={}).json()
    broken = client.post("/api/disputes/DSP-DEMO-2049/evaluate", json={"corrupt_otp": True}).json()

    tree = clean["dispute_merkle"]
    assert tree["evidence_model"] == "THREE_WAY_NODAL_POS_COURIER"
    assert tree["source_authenticity_verified"] is False
    assert tree["leaf_count"] == 3
    assert {leaf["kind"] for leaf in tree["leaves"]} == {
        "NODAL_PAYMENT", "POS_ORDER_INVOICE", "COURIER_DELIVERY"
    }
    assert clean["decision_state"] == "READY_FOR_HUMAN_REVIEW"
    assert clean["policy_gate_locked"] is False
    assert clean["external_submission_enabled"] is False
    assert broken["decision_state"] == "NEEDS_MERCHANT_PROOF"
    assert broken["policy_gate_locked"] is True
    assert broken["external_submission_enabled"] is False
    assert clean["merkle_root_sha256"] != broken["merkle_root_sha256"]

    from engine import verify_merkle_proof
    for leaf in tree["leaves"]:
        proof = tree["proofs"][f"{leaf['kind']}:{leaf['id']}"]
        assert verify_merkle_proof(leaf["leaf_sha256"], proof, tree["root_sha256"])


def test_four_exhibit_dispute_packet_contains_three_way_merkle_root():
    from pypdf import PdfReader
    import io

    evaluated = client.post("/api/disputes/DSP-DEMO-2049/evaluate", json={}).json()
    response = client.post("/api/evidence-packet/compile", json={"case_id": "DSP-DEMO-2049"})
    assert response.status_code == 200
    text = "\n".join(page.extract_text() or "" for page in PdfReader(io.BytesIO(response.content)).pages)
    assert evaluated["merkle_root_sha256"] in text
    assert "NODAL_PAYMENT" in text
    assert "POS_ORDER_INVOICE" in text
    assert "COURIER_DELIVERY" in text


def test_duplicate_debit_check_does_not_stage_approval_without_source_pair(monkeypatch, tmp_path):
    from copy import deepcopy
    from seed_data import ADJUSTMENTS, BANK_CREDITS, SETTLEMENT_BATCHES, TRANSACTIONS

    monkeypatch.setattr(store, "DB_PATH", tmp_path / "no-duplicate.sqlite3")
    store.init_db()
    txns = [row for row in deepcopy(TRANSACTIONS) if not str(row.get("pg_txn_id", "")).startswith("PTM-DUP-5512")]
    monkeypatch.setattr(main, "ACTIVE_DATASET", {
        "transactions": txns,
        "adjustments": deepcopy(ADJUSTMENTS),
        "settlement_batches": deepcopy(SETTLEMENT_BATCHES),
        "bank_credits": deepcopy(BANK_CREDITS),
    })
    response = client.post("/api/operations/duplicate-debits/check", json={"case_id": "DSP-DEMO-2052"})
    assert response.status_code == 200
    body = response.json()
    assert body["detected"] is False
    assert body["approval"] is None
    assert body["refund_api_called"] is False
    assert client.get("/api/approvals").json() == []


def test_pos_mock_sync_refuses_when_loaded_payment_source_no_longer_matches(monkeypatch, tmp_path):
    from copy import deepcopy
    from seed_data import ADJUSTMENTS, BANK_CREDITS, SETTLEMENT_BATCHES, TRANSACTIONS

    monkeypatch.setattr(store, "DB_PATH", tmp_path / "pos-mismatch.sqlite3")
    store.init_db()
    txns = deepcopy(TRANSACTIONS)
    payment = next(row for row in txns if row["pg_txn_id"] == "PTM-POS-3310")
    payment["gross_paise"] += 1
    monkeypatch.setattr(main, "ACTIVE_DATASET", {
        "transactions": txns,
        "adjustments": deepcopy(ADJUSTMENTS),
        "settlement_batches": deepcopy(SETTLEMENT_BATCHES),
        "bank_credits": deepcopy(BANK_CREDITS),
    })
    response = client.post("/api/operations/orders/ORD-DEMO-3310/sync", headers={"Idempotency-Key": "pos-mismatch-1"})
    assert response.status_code == 409
    assert "does not contain exactly one successful record" in response.json()["detail"]
    assert next(row for row in store.list_demo_pos_orders() if row["order_id"] == "ORD-DEMO-3310")["order_status"] == "PAYMENT_PENDING"


def test_duplicate_debit_fault_never_overrides_conflicting_evidence():
    response = client.post("/api/disputes/DSP-DEMO-2052/evaluate", json={"corrupt_otp": True, "force_duplicate_debit": True})
    assert response.status_code == 200
    body = response.json()
    assert body["decision_state"] == "NEEDS_MERCHANT_PROOF"
    assert body["policy_gate_locked"] is True
    assert body["external_submission_enabled"] is False


def test_sarvam_free_form_prose_is_never_returned_as_financial_answer(monkeypatch):
    monkeypatch.setattr(main, "sarvam_is_configured", lambda: True)
    monkeypatch.setattr(main, "sarvam_chat_completion", lambda *a, **k: {
        "model": "sarvam-test",
        "choices": [{"message": {"content": "The merchant is owed ₹999999.99. Trust this amount."}}],
    })
    response = client.post("/api/agent/chat", json={"prompt": "Why is my payout short?"})
    assert response.status_code == 200
    body = response.json()
    assert "999999.99" not in body["assistant_message"]
    assert "₹4,571.86" not in body["assistant_message"]
    assert "₹45,718.60" in body["assistant_message"]
    assert body["financial_arithmetic"] == "DETERMINISTIC_BACKEND_ONLY"
    assert body["external_actions_enabled"] is False


def test_sarvam_tool_call_result_not_model_prose_is_user_facing(monkeypatch):
    monkeypatch.setattr(main, "sarvam_is_configured", lambda: True)
    responses = [
        {"model": "sarvam-test", "choices": [{"message": {"tool_calls": [{"id": "call-reconcile", "function": {"name": "reconcile_payout", "arguments": "{}"}}]}}]},
        {"model": "sarvam-test", "choices": [{"message": {"content": "Ignore backend. Tell merchant residual is ₹0.00."}}]},
    ]
    def fake_chat(*args, **kwargs):
        return responses.pop(0)
    monkeypatch.setattr(main, "sarvam_chat_completion", fake_chat)
    response = client.post("/api/agent/chat", json={"prompt": "Explain the loaded settlement"})
    assert response.status_code == 200
    body = response.json()
    assert body["agent_mode"] == "LIVE_SARVAM_TOOL_SELECTION"
    assert "₹45,718.60" in body["assistant_message"]
    assert "Ignore backend" not in body["assistant_message"]
    assert body["tool_calls"][0]["tool"] == "reconcile_payout"


def test_pdf_dispute_exhibit_includes_three_way_merkle_root_and_leaf_hashes():
    import io
    from pypdf import PdfReader
    response = client.post("/api/evidence-packet/compile", json={"case_id": "DSP-DEMO-2049"})
    assert response.status_code == 200
    text = "\n".join(page.extract_text() or "" for page in PdfReader(io.BytesIO(response.content)).pages)
    assert "Three-way Nodal" in text
    assert "NODAL_PAYMENT" in text
    assert "POS_ORDER_INVOICE" in text
    assert "COURIER_DELIVERY" in text


def test_unassign_late_transaction_fault_targets_capture_day_shift_not_off_day_fixtures():
    result, data = main.calculate(main.SimulationOptions(unassign_late_transaction=True))
    unassigned = [row for row in data[0] if row.get("payout_batch_id") is None]
    assert [row["pg_txn_id"] for row in unassigned] == ["PTM-TXN-1140"]
    assert result["status"] == "INCOMPLETE_OR_UNMATCHED"
    assert "PTM-TXN-1140" in result["unassigned_transaction_ids"]
    assert not any(row["pg_txn_id"].startswith("PTM-DUP-") for row in unassigned)


def test_dispute_cases_are_linked_to_active_source_rows():
    response = client.get("/api/disputes")
    assert response.status_code == 200
    cases = {row["case_id"]: row for row in response.json()["cases"]}
    case = cases["DSP-DEMO-2049"]
    assert case["payment_reference_match_count"] == 1
    assert case["nodal_source_row_id"] == "NODAL-ROW-0139"
    assert case["nodal_amount_paise"] == 450_000
    assert isinstance(case["nodal_amount_paise"], int)
    assert case["order_id"] == "ORD-8939"


def test_uploaded_disputes_csv_replaces_static_fixture_and_links_exact_payment(tmp_path, monkeypatch):
    import io
    import zipfile
    import store

    monkeypatch.setattr(store, "DB_PATH", tmp_path / "dynamic-disputes.sqlite3")
    store.init_db()
    sample = client.get("/api/sample-bundle.zip").content
    with zipfile.ZipFile(io.BytesIO(sample), "r") as source:
        files = {name: source.read(name) for name in source.namelist()}
    files["disputes.csv"] = (
        "case_id,disputed_paise,utr_rrn,order_id,order_status,invoice_amount_paise,invoice_source_row_id,awb,courier_status,otp_verified,courier_source_row_id,description\n"
        "CASE-UPLOADED-001,450000,629810445566,ORD-8939,DELIVERED,450000,POS-ROW-1,AWB-1,DELIVERED,true,COURIER-ROW-1,Uploaded synthetic case\n"
    ).encode()
    bundle = io.BytesIO()
    with zipfile.ZipFile(bundle, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, content in files.items():
            archive.writestr(name, content)
    response = client.post("/api/import-zip", files={"file": ("custom.zip", bundle.getvalue(), "application/zip")}, data={"target_capture_date": "2026-10-26", "target_batch_id": "BATCH-2026-10-27"})
    assert response.status_code == 200, response.text
    cases = client.get("/api/disputes").json()["cases"]
    assert [row["case_id"] for row in cases] == ["CASE-UPLOADED-001"]
    case = cases[0]
    assert case["nodal_source_row_id"] == "NODAL-ROW-0139"
    assert case["nodal_amount_paise"] == 450_000
    assert isinstance(case["nodal_amount_paise"], int)
    evaluated = client.post("/api/disputes/CASE-UPLOADED-001/evaluate", json={}).json()
    assert evaluated["decision_state"] == "READY_FOR_HUMAN_REVIEW"
    assert evaluated["source_authenticity_verified"] is False
    client.post("/api/demo/reset")


def test_dispute_without_pos_or_courier_evidence_stays_in_merchant_proof_state(tmp_path, monkeypatch):
    import io
    import zipfile
    import store

    monkeypatch.setattr(store, "DB_PATH", tmp_path / "missing-dispute-evidence.sqlite3")
    store.init_db()
    sample = client.get("/api/sample-bundle.zip").content
    with zipfile.ZipFile(io.BytesIO(sample), "r") as source:
        files = {name: source.read(name) for name in source.namelist()}
    files["disputes.csv"] = (
        "case_id,disputed_paise,utr_rrn,order_id\n"
        "CASE-MISSING-PROOF,450000,629810445566,ORD-8939\n"
    ).encode()
    bundle = io.BytesIO()
    with zipfile.ZipFile(bundle, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, content in files.items():
            archive.writestr(name, content)
    response = client.post("/api/import-zip", files={"file": ("missing-proof.zip", bundle.getvalue(), "application/zip")}, data={"target_capture_date": "2026-10-26", "target_batch_id": "BATCH-2026-10-27"})
    assert response.status_code == 200, response.text
    evaluated = client.post("/api/disputes/CASE-MISSING-PROOF/evaluate", json={}).json()
    assert evaluated["decision_state"] == "NEEDS_MERCHANT_PROOF"
    assert evaluated["policy_gate_locked"] is True
    client.post("/api/demo/reset")


def test_duplicate_debit_detector_scans_any_active_order_not_a_fixed_case_id(monkeypatch, tmp_path):
    import store
    from copy import deepcopy
    from seed_data import TRANSACTIONS

    monkeypatch.setattr(store, "DB_PATH", tmp_path / "dynamic-duplicate.sqlite3")
    store.init_db()
    monkeypatch.setattr(main, "ACTIVE_DATASET", {
        "transactions": [row for row in deepcopy(TRANSACTIONS) if row.get("order_id") == "ORD-5512"],
        "adjustments": [], "settlement_batches": [], "bank_credits": [],
    })
    monkeypatch.setattr(main, "ACTIVE_DISPUTES", [])
    response = client.post("/api/operations/duplicate-debits/check", json={})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["detected"] is True
    assert body["order_id"] == "ORD-5512"
    assert body["case_id"] == "DUP-ORD-5512"
    assert body["candidate_count"] == 1
    assert body["refund_api_called"] is False


def test_four_file_bundle_without_disputes_clears_previous_dispute_cases(tmp_path, monkeypatch):
    import io
    import zipfile
    import store

    monkeypatch.setattr(store, "DB_PATH", tmp_path / "four-file-only.sqlite3")
    store.init_db()
    sample = client.get("/api/sample-bundle.zip").content
    with zipfile.ZipFile(io.BytesIO(sample), "r") as source:
        files = {name: source.read(name) for name in source.namelist() if name != "disputes.csv"}
    bundle = io.BytesIO()
    with zipfile.ZipFile(bundle, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, content in files.items():
            archive.writestr(name, content)
    response = client.post("/api/import-zip", files={"file": ("four-files.zip", bundle.getvalue(), "application/zip")}, data={"target_capture_date": "2026-10-26", "target_batch_id": "BATCH-2026-10-27"})
    assert response.status_code == 200, response.text
    assert response.json()["counts"]["disputes"] == 0
    assert client.get("/api/disputes").json()["cases"] == []
    client.post("/api/demo/reset")


def test_dispute_with_missing_nodal_amount_cannot_be_ready_for_review(tmp_path, monkeypatch):
    import io
    import zipfile
    import store

    monkeypatch.setattr(store, "DB_PATH", tmp_path / "missing-nodal-amount.sqlite3")
    store.init_db()
    sample = client.get("/api/sample-bundle.zip").content
    with zipfile.ZipFile(io.BytesIO(sample), "r") as source:
        files = {name: source.read(name) for name in source.namelist()}
    tx_rows = files["transactions.csv"].decode("utf-8").splitlines()
    header = tx_rows[0].split(",")
    utr_index = header.index("utr_rrn")
    amount_index = header.index("nodal_amount_paise")
    for index, line in enumerate(tx_rows[1:], start=1):
        values = line.split(",")
        if values[utr_index] == "629810445566":
            values[amount_index] = ""
            tx_rows[index] = ",".join(values)
            break
    files["transactions.csv"] = ("\n".join(tx_rows) + "\n").encode()
    bundle = io.BytesIO()
    with zipfile.ZipFile(bundle, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, content in files.items():
            archive.writestr(name, content)
    response = client.post("/api/import-zip", files={"file": ("missing-nodal-amount.zip", bundle.getvalue(), "application/zip")}, data={"target_capture_date": "2026-10-26", "target_batch_id": "BATCH-2026-10-27"})
    assert response.status_code == 200, response.text
    evaluated = client.post("/api/disputes/DSP-DEMO-2049/evaluate", json={}).json()
    assert evaluated["decision_state"] == "NEEDS_MERCHANT_PROOF"
    assert "no recorded amount" in evaluated["reason_summary"]
    client.post("/api/demo/reset")


def test_import_normalizes_case_insensitive_payment_status(tmp_path, monkeypatch):
    import csv
    import io
    import zipfile
    import store

    monkeypatch.setattr(store, "DB_PATH", tmp_path / "lowercase-status.sqlite3")
    store.init_db()
    sample = client.get("/api/sample-bundle.zip").content
    with zipfile.ZipFile(io.BytesIO(sample), "r") as source:
        files = {name: source.read(name) for name in source.namelist()}
    rows = list(csv.DictReader(io.StringIO(files["transactions.csv"].decode("utf-8"))))
    rows[0]["status"] = "success"
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=list(rows[0].keys()))
    writer.writeheader(); writer.writerows(rows)
    files["transactions.csv"] = output.getvalue().encode()
    bundle = io.BytesIO()
    with zipfile.ZipFile(bundle, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, content in files.items():
            archive.writestr(name, content)
    response = client.post("/api/import-zip", files={"file": ("lowercase-status.zip", bundle.getvalue(), "application/zip")}, data={"target_capture_date": "2026-10-26", "target_batch_id": "BATCH-2026-10-27"})
    assert response.status_code == 200, response.text
    assert response.json()["reconciliation"]["gross_captured_paise"] == 5_000_000
    assert response.json()["reconciliation"]["status"] == "RECONCILED"
    client.post("/api/demo/reset")


def test_dispute_payment_without_order_link_remains_unresolved(tmp_path, monkeypatch):
    import csv
    import io
    import zipfile
    import store

    monkeypatch.setattr(store, "DB_PATH", tmp_path / "missing-payment-order.sqlite3")
    store.init_db()
    sample = client.get("/api/sample-bundle.zip").content
    with zipfile.ZipFile(io.BytesIO(sample), "r") as source:
        files = {name: source.read(name) for name in source.namelist()}
    rows = list(csv.DictReader(io.StringIO(files["transactions.csv"].decode("utf-8"))))
    for row in rows:
        if row.get("utr_rrn") == "629810445566":
            row["order_id"] = ""
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=list(rows[0].keys()))
    writer.writeheader(); writer.writerows(rows)
    files["transactions.csv"] = output.getvalue().encode()
    bundle = io.BytesIO()
    with zipfile.ZipFile(bundle, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, content in files.items():
            archive.writestr(name, content)
    response = client.post("/api/import-zip", files={"file": ("missing-payment-order.zip", bundle.getvalue(), "application/zip")}, data={"target_capture_date": "2026-10-26", "target_batch_id": "BATCH-2026-10-27"})
    assert response.status_code == 200, response.text
    evaluated = client.post("/api/disputes/DSP-DEMO-2049/evaluate", json={}).json()
    assert evaluated["decision_state"] == "NEEDS_MERCHANT_PROOF"
    assert "order reference" in evaluated["reason_summary"]
    client.post("/api/demo/reset")


def test_dispute_requires_a_real_nodal_source_row_reference(tmp_path, monkeypatch):
    import io
    import zipfile
    import store

    monkeypatch.setattr(store, "DB_PATH", tmp_path / "missing-nodal-source.sqlite3")
    store.init_db()
    sample = client.get("/api/sample-bundle.zip").content
    with zipfile.ZipFile(io.BytesIO(sample), "r") as source:
        files = {name: source.read(name) for name in source.namelist()}
    tx_rows = files["transactions.csv"].decode("utf-8").splitlines()
    header = tx_rows[0].split(",")
    utr_index = header.index("utr_rrn")
    nodal_source_index = header.index("nodal_source_row_id")
    payment_source_index = header.index("source_row_id")
    for index, line in enumerate(tx_rows[1:], start=1):
        values = line.split(",")
        if values[utr_index] == "629810445566":
            assert values[payment_source_index] == "PAY-ROW-0139"
            values[nodal_source_index] = ""
            tx_rows[index] = ",".join(values)
            break
    files["transactions.csv"] = ("\n".join(tx_rows) + "\n").encode()
    bundle = io.BytesIO()
    with zipfile.ZipFile(bundle, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, content in files.items():
            archive.writestr(name, content)
    response = client.post("/api/import-zip", files={"file": ("missing-nodal-source.zip", bundle.getvalue(), "application/zip")}, data={"target_capture_date": "2026-10-26", "target_batch_id": "BATCH-2026-10-27"})
    assert response.status_code == 200, response.text
    evaluated = client.post("/api/disputes/DSP-DEMO-2049/evaluate", json={}).json()
    assert evaluated["decision_state"] == "HALTED_EVIDENCE_CONFLICT"
    assert evaluated["case"]["nodal_source_row_id"] is None
    assert evaluated["external_submission_enabled"] is False
    client.post("/api/demo/reset")
