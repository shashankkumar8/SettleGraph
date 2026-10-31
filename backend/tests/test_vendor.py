"""Regression tests for the v4 Vendor & Exceptions Desk merged into v0.5.0."""
from __future__ import annotations

from copy import deepcopy
from datetime import date

import pytest
from fastapi.testclient import TestClient

import main
import store
import vendor

client = TestClient(main.app)


def test_synthetic_vendor_baseline_has_valid_45_day_term_and_partial_balance():
    result = vendor.evaluate_receivable(as_of="2026-10-31")
    assert result["invoice_paise"] == 2_400_0000
    assert result["received_paise"] == 2_100_0000
    assert result["outstanding_paise"] == 300_0000
    assert result["payment_status"] == "PARTIALLY_PAID"
    assert result["statutory"]["acceptance_date"] == "2026-08-14"
    assert result["statutory"]["statutory_due_date"] == "2026-09-28"
    assert result["statutory"]["interest_start_date"] == "2026-09-29"
    assert result["statutory"]["overdue_days"] == 33
    assert result["follow_up_pack_allowed"] is True


def test_interest_is_not_calculated_until_rate_is_operator_confirmed():
    result = vendor.evaluate_receivable(as_of="2026-10-31")
    assert result["statutory"]["indicative_interest_paise"] is None
    assert result["statutory"]["interest_mode"] == "NOT_CALCULATED_OPERATOR_RATE_CONFIRMATION_REQUIRED"


def test_interest_uses_dated_partial_payment_not_only_current_balance_from_due_date():
    result = vendor.evaluate_receivable(as_of="2026-10-31", bank_rate_bps=550)
    statutory = result["statutory"]
    assert statutory["interest_mode"] == "ILLUSTRATIVE_DATED_CASHFLOW_MONTHLY_REST_ESTIMATE_OPERATOR_RATE_CONFIRMED"
    assert statutory["annual_interest_rate_bps"] == 1650
    assert statutory["indicative_interest_paise"] is not None
    # A partial payment on 30 September must make the result smaller than if the
    # same remaining balance had been overdue for the entire period.
    assert 0 < statutory["indicative_interest_paise"] < 100_000
    assert statutory["bank_rate_source"] == "OPERATOR_SUPPLIED_NOT_AUTO_VERIFIED"


def test_missing_principal_event_date_suppresses_interest_and_flags_source():
    data = deepcopy(vendor.SYNTHETIC_RECEIVABLES)
    data["payments"][0].pop("date")
    result = vendor.evaluate_receivable(data, as_of="2026-10-31", bank_rate_bps=550)
    assert result["statutory"]["indicative_interest_paise"] is None
    assert result["statutory"]["interest_mode"] == "NOT_CALCULATED_SOURCE_EVENT_DATE_MISSING"
    assert any(flag.startswith("PAYMENT_DATE_MISSING") for flag in result["flags"])
    assert result["follow_up_pack_allowed"] is False


def test_payment_after_as_of_date_is_not_counted_in_receivable_balance():
    data = deepcopy(vendor.SYNTHETIC_RECEIVABLES)
    data["payments"][0]["date"] = "2026-11-01"
    result = vendor.evaluate_receivable(data, as_of="2026-10-31")
    assert result["received_paise"] == 0
    assert result["outstanding_paise"] == 2_400_0000


def test_60_day_written_term_is_capped_and_follow_up_gate_is_locked():
    result = vendor.evaluate_receivable(
        as_of="2026-10-31", toggles={"extend_agreement_over_45": True}
    )
    assert result["statutory"]["statutory_due_date"] == "2026-09-28"
    assert any(flag.startswith("AGREED_PERIOD_EXCEEDS_45_DAYS") for flag in result["flags"])
    assert result["follow_up_pack_allowed"] is False


def test_no_written_agreement_uses_appointed_day_after_15_days():
    data = deepcopy(vendor.SYNTHETIC_RECEIVABLES)
    data["invoice"]["has_written_agreement"] = False
    result = vendor.evaluate_receivable(data, as_of="2026-10-31")
    assert result["statutory"]["appointed_day"] == "2026-08-30"
    assert result["statutory"]["statutory_due_date"] == "2026-08-29"
    assert result["statutory"]["interest_start_date"] == "2026-08-30"


def test_timely_written_objection_moves_acceptance_to_resolution_date():
    data = deepcopy(vendor.SYNTHETIC_RECEIVABLES)
    data["grn"]["objection_date"] = "2026-08-20"
    data["grn"]["objection_resolved_date"] = "2026-08-25"
    result = vendor.evaluate_receivable(data, as_of="2026-10-31")
    assert result["statutory"]["acceptance_date"] == "2026-08-25"
    assert result["statutory"]["statutory_due_date"] == "2026-10-09"


def test_unresolved_timely_objection_suppresses_statutory_timeline():
    data = deepcopy(vendor.SYNTHETIC_RECEIVABLES)
    data["grn"]["objection_date"] = "2026-08-20"
    result = vendor.evaluate_receivable(data, as_of="2026-10-31")
    assert result["statutory"] is None
    assert any(flag.startswith("BUYER_OBJECTION_UNRESOLVED") for flag in result["flags"])


def test_late_objection_does_not_shift_deemed_acceptance_date():
    data = deepcopy(vendor.SYNTHETIC_RECEIVABLES)
    data["grn"]["objection_date"] = "2026-09-01"
    result = vendor.evaluate_receivable(data, as_of="2026-10-31")
    assert result["statutory"]["acceptance_date"] == "2026-08-14"
    assert any(flag.startswith("LATE_BUYER_OBJECTION") for flag in result["flags"])


@pytest.mark.parametrize(
    "supplier",
    [
        {"udyam_registered": False, "enterprise_size": "MICRO", "activity": "MANUFACTURING"},
        {"udyam_registered": True, "enterprise_size": "MEDIUM", "activity": "MANUFACTURING"},
        {"udyam_registered": True, "enterprise_size": "SMALL", "activity": "TRADING"},
    ],
)
def test_msm_ed_timeline_not_enabled_for_unverified_or_ineligible_supplier(supplier):
    data = deepcopy(vendor.SYNTHETIC_RECEIVABLES)
    data["supplier"] = supplier
    result = vendor.evaluate_receivable(data, as_of="2026-10-31")
    assert result["statutory"] is None
    assert any(flag.startswith("MSMED_ELIGIBILITY_NOT_ESTABLISHED") for flag in result["flags"])


def test_duplicate_capture_detector_uses_each_captured_amount_and_ignores_reversal():
    rows = [
        {"order_id": "O1", "order_amount_paise": 10000, "captured_paise": 6000, "txn_id": "T1", "status": "SUCCESS", "reversed": False},
        {"order_id": "O1", "order_amount_paise": 10000, "captured_paise": 6000, "txn_id": "T2", "status": "DEEMED_SUCCESS", "reversed": False},
        {"order_id": "O1", "order_amount_paise": 10000, "captured_paise": 10000, "txn_id": "T3", "status": "SUCCESS", "reversed": True},
    ]
    result = vendor.detect_duplicates(rows)
    assert len(result) == 1
    assert result[0]["captured_paise"] == 12000
    assert result[0]["overpayment_paise"] == 2000
    assert set(result[0]["txn_ids"]) == {"T1", "T2"}


def test_duplicate_detector_rejects_conflicting_order_amounts_and_reused_txn_id():
    rows = [
        {"order_id": "O1", "order_amount_paise": 10000, "captured_paise": 10000, "txn_id": "T1", "status": "SUCCESS", "reversed": False},
        {"order_id": "O1", "order_amount_paise": 9000, "captured_paise": 10000, "txn_id": "T2", "status": "SUCCESS", "reversed": False},
        {"order_id": "O2", "order_amount_paise": 10000, "captured_paise": 10000, "txn_id": "T1", "status": "SUCCESS", "reversed": False},
    ]
    assert vendor.detect_duplicates(rows) == []


def test_rbi_tat_distinguishes_merchant_p2m_t_plus_5_from_p2p_t_plus_1():
    p2m = vendor.tat_check("2026-10-20", as_of="2026-10-31", transaction_type="UPI_P2M_CONFIRMATION_MISSING")
    p2p = vendor.tat_check("2026-10-20", as_of="2026-10-31", transaction_type="UPI_P2P_BENEFICIARY_NOT_CREDITED")
    assert p2m["tat_days"] == 5
    assert p2m["auto_reversal_due"] == "2026-10-25"
    assert p2m["days_late"] == 6
    assert p2p["tat_days"] == 1
    assert p2p["auto_reversal_due"] == "2026-10-21"
    assert p2p["days_late"] == 10


def test_rbi_tat_uses_actual_reversal_date_when_supplied():
    within = vendor.tat_check("2026-10-20", as_of="2026-10-31", reversal_date="2026-10-24")
    late = vendor.tat_check("2026-10-20", as_of="2026-10-31", reversal_date="2026-10-27")
    assert within["compensation_paise"] == 0
    assert within["compensation_status"] == "REVERSED_WITHIN_TAT"
    assert late["days_late"] == 2
    assert late["compensation_paise"] == 20000


def test_kirana_fixture_does_not_label_unexplained_residual_as_a_fee():
    result = vendor.kirana_payout()
    assert result["gap_paise"] == 350000
    assert result["explained_paise"] == 250000
    assert result["unmatched_paise"] == 100000
    assert result["status"] == "NEEDS_INVESTIGATION"


def test_hinglish_intent_router_uses_ledger_values_only():
    result = vendor.answer_query("mere vendor ka kitna pending hai", {"outstanding_paise": 12345, "duplicate_paise": 0, "gap_paise": 0})
    assert result["intent"] == "VENDOR_OUTSTANDING"
    assert result["paise"] == 12345
    assert result["source"] == "computed_from_local_ledger_not_ai"


def test_vendor_api_baseline_and_fault_injection():
    baseline = client.post("/api/vendor/receivables/evaluate", json={"as_of": "2026-10-31"})
    assert baseline.status_code == 200, baseline.text
    assert baseline.json()["follow_up_pack_allowed"] is True
    fault = client.post("/api/vendor/receivables/evaluate", json={"as_of": "2026-10-31", "extend_agreement_over_45": True})
    assert fault.status_code == 200
    assert fault.json()["follow_up_pack_allowed"] is False


def test_vendor_follow_up_is_staged_for_approval_and_not_sent(monkeypatch, tmp_path):
    monkeypatch.setattr(store, "DB_PATH", tmp_path / "vendor-approvals.sqlite3")
    store.init_db()
    body = {"as_of": "2026-10-31"}
    first = client.post("/api/vendor/receivables/stage-follow-up", json=body)
    second = client.post("/api/vendor/receivables/stage-follow-up", json=body)
    assert first.status_code == 200, first.text
    assert second.status_code == 200, second.text
    assert first.json()["message_sent"] is False
    assert first.json()["external_action_executed"] is False
    assert second.json()["approval"]["idempotent_replay"] is True
    locked = client.post("/api/vendor/receivables/stage-follow-up", json={"as_of": "2026-10-31", "extend_agreement_over_45": True})
    assert locked.status_code == 409


def test_duplicate_refund_is_approval_only_and_idempotent(monkeypatch, tmp_path):
    monkeypatch.setattr(store, "DB_PATH", tmp_path / "duplicate-approvals.sqlite3")
    store.init_db()
    candidate = client.get("/api/duplicates").json()[0]["candidate_id"]
    first = client.post(f"/api/duplicates/{candidate}/stage-review")
    second = client.post(f"/api/duplicates/{candidate}/stage-review")
    assert first.status_code == 200
    assert first.json()["refund_api_called"] is False
    assert second.json()["approval"]["idempotent_replay"] is True
    missing = client.post("/api/duplicates/not-a-duplicate/stage-refund")
    assert missing.status_code == 404


def test_vendor_tat_endpoint_and_validation():
    ok = client.get("/api/scenarios/pending-success", params={"transaction_date": "2026-10-20", "transaction_type": "UPI_P2P_BENEFICIARY_NOT_CREDITED", "as_of": "2026-10-31"})
    assert ok.status_code == 200
    assert ok.json()["tat_days"] == 1
    invalid = client.get("/api/scenarios/pending-success", params={"transaction_date": "2026-10-20", "transaction_type": "MADE_UP", "as_of": "2026-10-31"})
    assert invalid.status_code == 400


def test_vendor_assistant_endpoint_does_not_claim_llm_calculation():
    response = client.post("/api/assistant/query", json={"text": "vendor pending kitna hai"})
    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "computed_from_local_ledger_not_ai"
    assert body["paise"] == 3000000


def test_vendor_duplicate_screen_uses_active_transaction_dataset_not_static_fixture(monkeypatch):
    from seed_data import TRANSACTIONS
    monkeypatch.setattr(main, "ACTIVE_DATASET", {
        "transactions": deepcopy(TRANSACTIONS),
        "adjustments": [], "settlement_batches": [], "bank_credits": [],
    })
    response = client.get("/api/duplicates")
    assert response.status_code == 200
    rows = response.json()
    assert len(rows) == 1
    assert rows[0]["order_id"] == "ORD-5512"
    assert rows[0]["candidate_amount_paise"] == 85000
    assert rows[0]["capture_window_seconds"] == 92
    assert rows[0]["order_total_paise"] is None
    assert rows[0]["amount_semantics"] == "CAPTURES_BEYOND_FIRST_NOT_CONFIRMED_OVERPAYMENT"
    assert rows[0]["synthetic_data"] is True


def test_engine_duplicate_detector_excludes_reversed_success_rows():
    from copy import deepcopy
    from engine import detect_duplicate_payments
    from seed_data import TRANSACTIONS
    rows = deepcopy(TRANSACTIONS)
    for row in rows:
        if row.get("pg_txn_id") == "PTM-DUP-5512-B":
            row["reversed"] = True
    result = detect_duplicate_payments(rows, window_seconds=120)
    assert not any(item["order_id"] == "ORD-5512" for item in result)


def test_msmed_objection_date_cannot_precede_delivery():
    data = deepcopy(vendor.SYNTHETIC_RECEIVABLES)
    data["grn"]["objection_date"] = "2026-08-13"
    data["grn"]["objection_resolved_date"] = "2026-08-25"
    with pytest.raises(ValueError, match="cannot precede delivery_date"):
        vendor.evaluate_receivable(data, as_of="2026-10-31")


def test_tat_reversal_cannot_be_in_the_future_relative_to_evaluation():
    with pytest.raises(ValueError, match="after the evaluation as_of date"):
        vendor.tat_check("2026-10-20", as_of="2026-10-31", reversal_date="2026-11-01")


def test_health_endpoint_reports_demo_and_live_integration_boundaries():
    health = client.get("/api/health").json()
    assert health["version"] == "0.5.0"
    assert health["demo_mode"] is True
    assert health["live_paytm_connected"] is False
    assert health["live_bank_connected"] is False
    assert health["external_money_movement_enabled"] is False
    assert health["external_dispute_submission_enabled"] is False


def test_duplicate_review_stages_manual_review_not_refund_execution(monkeypatch, tmp_path):
    monkeypatch.setattr(store, "DB_PATH", tmp_path / "manual-review.sqlite3")
    store.init_db()
    response = client.post("/api/duplicates/ORD-5512/stage-review")
    assert response.status_code == 200
    body = response.json()
    assert body["refund_api_called"] is False
    assert body["external_action_executed"] is False
    assert body["review_only"] is True
    rows = store.list_human_approvals()
    assert rows[0]["action_type"] == "DUPLICATE_CAPTURE_REVIEW"


def test_future_objection_does_not_rewrite_historical_as_of_timeline():
    data = deepcopy(vendor.SYNTHETIC_RECEIVABLES)
    data["grn"]["objection_date"] = "2026-08-20"
    result = vendor.evaluate_receivable(data, as_of="2026-08-19")
    assert result["statutory"]["acceptance_date"] == "2026-08-14"
    assert result["statutory"]["statutory_due_date"] == "2026-09-28"


def test_future_objection_resolution_does_not_rewrite_historical_as_of_timeline():
    data = deepcopy(vendor.SYNTHETIC_RECEIVABLES)
    data["grn"]["objection_date"] = "2026-08-20"
    data["grn"]["objection_resolved_date"] = "2026-08-25"
    result = vendor.evaluate_receivable(data, as_of="2026-08-24")
    assert result["statutory"] is None
    assert any("UNRESOLVED_AS_OF_DATE" in flag for flag in result["flags"])


def test_active_duplicate_api_groups_three_captures_as_one_review_candidate(monkeypatch):
    rows = []
    timestamps = ("10:00:00", "10:01:30", "10:03:30")
    for idx, clock in enumerate(timestamps, start=1):
        rows.append({
            "pg_txn_id": f"PG-CLUSTER-{idx}",
            "source_row_id": f"SRC-CLUSTER-{idx}",
            "utr_rrn": f"UTR-CLUSTER-{idx}",
            "order_id": "ORD-CLUSTER",
            "gross_paise": 25000,
            "capture_ts": f"2026-10-31T{clock}",
            "customer_vpa": "payer@example",
            "status": "SUCCESS",
        })
    monkeypatch.setattr(main, "active_data", lambda: (rows, [], [], []))
    candidates = main._active_vendor_duplicate_candidates()
    assert len(candidates) == 1
    assert candidates[0]["capture_cluster_size"] == 3
    assert candidates[0]["candidate_amount_paise"] == 50000
    assert candidates[0]["capture_window_seconds"] == 120
    assert candidates[0]["cluster_span_seconds"] == 210
    assert candidates[0]["order_total_independently_verified"] is False
    assert candidates[0]["amount_semantics"] == "CAPTURES_BEYOND_FIRST_NOT_CONFIRMED_OVERPAYMENT"
