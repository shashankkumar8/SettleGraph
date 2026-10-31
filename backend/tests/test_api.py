from fastapi.testclient import TestClient

import main

client = TestClient(main.app)


def test_health_explicitly_says_synthetic_not_live():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["mode"] == "BUILT_IN_SYNTHETIC_FIXTURE"
    assert r.json()["live_paytm_connected"] is False


def test_reconcile_api():
    r = client.get("/api/demo/reconcile")
    assert r.status_code == 200
    assert r.json()["status"] == "RECONCILED"
    assert r.json()["residual_paise"] == 0


def test_simulation_exposes_shortfall():
    r = client.post("/api/demo/reconcile", json={"bank_credit_delta_paise": -10000})
    assert r.status_code == 200
    assert r.json()["status"] == "UNEXPLAINED_VARIANCE"
    assert r.json()["residual_paise"] == 10000


def test_trace_api():
    r = client.get("/api/graph/trace/ADJ-EDI-01")
    assert r.status_code == 200
    assert [n["id"] for n in r.json()["nodes"]] == ["ADJ-EDI-01", "BATCH-2026-10-27", "BANK-ROW-0001"]


def test_unknown_graph_node_is_404():
    r = client.get("/api/graph/trace/not-a-real-node")
    assert r.status_code == 404


def test_dispute_fault_halts_submission():
    r = client.post("/api/disputes/DSP-DEMO-2049/evaluate", json={"inject_amount_mismatch": True})
    assert r.status_code == 200
    assert r.json()["decision_state"] == "HALTED_EVIDENCE_CONFLICT"
    assert r.json()["external_submission_enabled"] is False


def test_utr_check_does_not_claim_live_verification():
    r = client.post("/api/verify-demo-utr", json={"utr_rrn": "000000000001", "claimed_amount_paise": 100})
    assert r.status_code == 200
    assert r.json()["verdict"] == "NO_MATCH_IN_LOADED_DEMO_DATA"
    assert r.json()["live_paytm_checked"] is False
    invalid = client.post("/api/verify-demo-utr", json={"utr_rrn": "not-found", "claimed_amount_paise": 100})
    assert invalid.json()["verdict"] == "INVALID_RRN_FORMAT"


def test_sample_csv_bundle_can_be_downloaded_and_imported():
    bundle = client.get("/api/sample-bundle.zip")
    assert bundle.status_code == 200
    assert bundle.headers["content-type"].startswith("application/zip")
    imported = client.post(
        "/api/import-zip",
        files={"file": ("settlegraph_demo_inputs.zip", bundle.content, "application/zip")},
        data={"target_capture_date": "2026-10-26", "target_batch_id": "BATCH-2026-10-27"},
    )
    assert imported.status_code == 200, imported.text
    body = imported.json()
    assert body["counts"]["transactions"] == 143
    assert body["counts"]["disputes"] == 2
    assert body["reconciliation"]["residual_paise"] == 0
    active_cases = client.get("/api/disputes").json()["cases"]
    assert {case["case_id"] for case in active_cases} == {"DSP-DEMO-2049", "DSP-DEMO-2052"}
    client.post("/api/demo/reset")


def test_bad_zip_does_not_replace_data():
    before = client.get("/api/demo/reconcile").json()
    r = client.post("/api/import-zip", files={"file": ("bad.zip", b"not a zip", "application/zip")})
    assert r.status_code == 400
    after = client.get("/api/demo/reconcile").json()
    assert after["snapshot_sha256"] == before["snapshot_sha256"]


def test_agent_orchestrates_tools_without_claiming_external_action():
    clean = client.post("/api/agent/investigate", json={})
    assert clean.status_code == 200
    clean_body = clean.json()
    assert clean_body["agent_mode"] == "DETERMINISTIC_TOOL_ORCHESTRATION"
    assert clean_body["status"] == "RECONCILED"
    assert clean_body["investigation"] is None
    assert clean_body["external_actions_enabled"] is False
    assert [t["tool"] for t in clean_body["tool_calls"]] == ["reconcile_batch", "trace_amount", "create_exception_case", "build_evidence_packet"]

    anomaly = client.post("/api/agent/investigate", json={"options": {"bank_credit_delta_paise": -10000}})
    assert anomaly.status_code == 200
    body = anomaly.json()
    assert body["status"] == "UNEXPLAINED_VARIANCE"
    assert body["investigation"] is not None
    assert body["investigation"]["residual_paise"] == 10000
    assert body["external_actions_enabled"] is False


def test_pdf_evidence_packet_is_real_pdf_bytes():
    response = client.get("/api/evidence-packet.pdf")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.content.startswith(b"%PDF")


def test_uploaded_csv_values_drive_reconciliation_not_a_hardcoded_display():
    import io
    import zipfile

    sample = client.get("/api/sample-bundle.zip").content
    with zipfile.ZipFile(io.BytesIO(sample), "r") as source:
        files = {name: source.read(name) for name in source.namelist()}
    bank_csv = files["bank_credits.csv"].decode("utf-8")
    lines = bank_csv.splitlines()
    cols = lines[0].split(",")
    amount_index = cols.index("credit_paise")
    values = lines[1].split(",")
    values[amount_index] = str(int(values[amount_index]) - 10_000)
    lines[1] = ",".join(values)
    files["bank_credits.csv"] = ("\n".join(lines) + "\n").encode("utf-8")
    modified = io.BytesIO()
    with zipfile.ZipFile(modified, "w", zipfile.ZIP_DEFLATED) as bundle:
        for name, contents in files.items():
            bundle.writestr(name, contents)
    response = client.post(
        "/api/import-zip",
        files={"file": ("modified.zip", modified.getvalue(), "application/zip")},
        data={"target_capture_date": "2026-10-26", "target_batch_id": "BATCH-2026-10-27"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["reconciliation"]["residual_paise"] == 10_000
    assert response.json()["reconciliation"]["status"] == "UNEXPLAINED_VARIANCE"
    assert client.get("/api/health").json()["mode"] == "UPLOADED_LOCAL_CSV_BUNDLE"
    client.post("/api/demo/reset")


def test_investigation_is_persisted_and_has_audit_event():
    response = client.post("/api/investigations", json={"note": "test investigation persistence", "source_node_id": "ADJ-EDI-01"})
    assert response.status_code == 200, response.text
    investigation_id = response.json()["investigation"]["id"]
    saved = client.get("/api/investigations").json()
    assert any(row["id"] == investigation_id for row in saved)
    audit = client.get("/api/audit").json()
    assert any(row["event_type"] == "INVESTIGATION_CREATED" and f"{investigation_id}" in row["detail"] for row in audit)
