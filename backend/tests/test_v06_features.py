from fastapi.testclient import TestClient
import main
import store

client = TestClient(main.app)


def test_dashboard_stats_endpoint():
    response = client.get("/api/dashboard/stats")
    assert response.status_code == 200
    data = response.json()
    assert "total_payment_volume_paise" in data
    assert "expected_settlement_paise" in data
    assert "actual_settlement_paise" in data
    assert "reconciliation_rate_pct" in data
    assert "channel_breakdown" in data
    assert "settlement_trend" in data
    assert len(data["settlement_trend"]) == 7
    assert "exception_distribution" in data
    assert "ageing_analysis" in data
    assert data["total_payment_volume_paise"] > 0


def test_graph_overview_contains_connected_fintech_entities():
    response = client.get("/api/graph/overview")
    assert response.status_code == 200
    data = response.json()
    node_types = {n["node_type"] for n in data["nodes"]}
    assert "merchant" in node_types
    assert "payment" in node_types
    assert "settlement_batch" in node_types
    assert "bank_credit" in node_types
    assert "order" in node_types
    assert data["node_count"] > 20
    assert data["edge_count"] > 20


def test_investigation_lifecycle_persistence():
    # 1. Create an investigation
    create_res = client.post(
        "/api/investigations",
        json={"note": "Test investigation for payout review", "source_node_id": "BATCH-2026-10-27"},
    )
    assert create_res.status_code == 200
    inv = create_res.json()["investigation"]
    inv_id = inv["id"]
    assert inv_id > 0

    # 2. Retrieve investigation detail
    detail_res = client.get(f"/api/investigations/{inv_id}")
    assert detail_res.status_code == 200
    detail = detail_res.json()["investigation"]
    assert detail["id"] == inv_id
    assert len(detail["notes"]) >= 1

    # 3. Add follow-up operator note
    note_res = client.post(
        f"/api/investigations/{inv_id}/notes",
        json={"note": "Verified with banking partner; UTR confirmed in batch report.", "author": "QA_OPERATOR"},
    )
    assert note_res.status_code == 200
    updated_inv = note_res.json()["investigation"]
    assert len(updated_inv["notes"]) >= 2
    assert any("Verified with banking partner" in n["text"] for n in updated_inv["notes"])

    # 4. Decide investigation (Approve resolution)
    decision_res = client.post(
        f"/api/investigations/{inv_id}/decision",
        json={"decision": "APPROVE", "decided_by": "FINANCE_LEAD", "note": "Variance approved for manual ledger credit adjustment."},
    )
    assert decision_res.status_code == 200
    decided_inv = decision_res.json()["investigation"]
    assert decided_inv["status"] == "RESOLVED"
    assert decided_inv["decision"] == "APPROVE_RESOLUTION"
    assert decided_inv["decided_by"] == "FINANCE_LEAD"

    # 5. Reopen investigation
    reopen_res = client.post(
        f"/api/investigations/{inv_id}/reopen",
        json={"reopened_by": "SENIOR_AUDITOR", "note": "Reopened due to revised bank credit statement."},
    )
    assert reopen_res.status_code == 200
    reopened_inv = reopen_res.json()["investigation"]
    assert reopened_inv["status"] == "OPEN"
    assert reopened_inv["decision"] == "PENDING"


def test_demo_scenario_switcher():
    # Scenario A: Baseline
    res_a = client.post("/api/demo/scenario/scenario_a")
    assert res_a.status_code == 200
    body_a = res_a.json()
    assert body_a["scenario"] == "A"
    assert body_a["reconciliation"]["residual_paise"] == 0
    assert body_a["reconciliation"]["status"] == "RECONCILED"

    # Scenario B: Discrepancy
    res_b = client.post("/api/demo/scenario/scenario_b")
    assert res_b.status_code == 200
    body_b = res_b.json()
    assert body_b["scenario"] == "B"
    assert body_b["reconciliation"]["residual_paise"] != 0
    assert body_b["reconciliation"]["status"] == "UNEXPLAINED_VARIANCE"

    # Scenario C: Conflict / Missing Evidence
    res_c = client.post("/api/demo/scenario/scenario_c")
    assert res_c.status_code == 200
    body_c = res_c.json()
    assert body_c["scenario"] == "C"

    # Return back to baseline Scenario A
    client.post("/api/demo/scenario/scenario_a")

