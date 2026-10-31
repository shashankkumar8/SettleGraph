from copy import deepcopy

from engine import build_evidence_graph, reconcile, trace_evidence
from seed_data import ADJUSTMENTS, BANK_CREDITS, SETTLEMENT_BATCHES, TARGET_BATCH_ID, TARGET_CAPTURE_DATE, TRANSACTIONS


def run(txns=None, adjs=None, banks=None):
    return reconcile(
        deepcopy(TRANSACTIONS if txns is None else txns),
        deepcopy(ADJUSTMENTS if adjs is None else adjs),
        deepcopy(SETTLEMENT_BATCHES),
        deepcopy(BANK_CREDITS if banks is None else banks),
        TARGET_CAPTURE_DATE,
        TARGET_BATCH_ID,
    )


def test_fixture_reconciles_exactly_to_zero_paise():
    result = run()
    assert result["gross_captured_paise"] == 5_000_000
    assert result["current_batch_gross_paise"] == 4_815_000
    assert result["known_other_batch_amount_paise"] == 185_000
    assert result["total_adjustments_paise"] == 243_140
    assert result["expected_net_paise"] == 4_571_860
    assert result["actual_bank_paise"] == 4_571_860
    assert result["residual_paise"] == 0
    assert result["status"] == "RECONCILED"


def test_fixture_has_140_capture_day_rows_and_three_isolated_ops_rows():
    assert len(TRANSACTIONS) == 143
    assert len({t["pg_txn_id"] for t in TRANSACTIONS}) == 143
    capture_day = [row for row in TRANSACTIONS if row["capture_ts"].startswith(TARGET_CAPTURE_DATE)]
    assert len(capture_day) == 140


def test_bank_credit_short_by_100_rupees_is_not_reconciled():
    banks = deepcopy(BANK_CREDITS)
    banks[0]["credit_paise"] -= 10_000
    result = run(banks=banks)
    assert result["residual_paise"] == 10_000
    assert result["status"] == "UNEXPLAINED_VARIANCE"


def test_fee_row_change_updates_residual_exactly():
    adjs = deepcopy(ADJUSTMENTS)
    adjs[0]["amount_paise"] += 1_000
    result = run(adjs=adjs)
    assert result["residual_paise"] == -1_000
    assert result["status"] == "UNEXPLAINED_VARIANCE"


def test_unknown_adjustment_requires_review_even_if_math_would_balance():
    adjs = deepcopy(ADJUSTMENTS)
    adjs.append({"adjustment_id": "ADJ-X", "source_row_id": "SET-X", "type": "MYSTERY", "amount_paise": 10_000, "direction": "DEBIT", "batch_id": TARGET_BATCH_ID, "reference_id": "X"})
    banks = deepcopy(BANK_CREDITS)
    banks[0]["credit_paise"] -= 10_000
    result = run(adjs=adjs, banks=banks)
    assert result["residual_paise"] == 0
    assert result["status"] == "NEEDS_REVIEW"
    assert result["unknown_adjustment_ids"] == ["ADJ-X"]


def test_missing_batch_reference_blocks_false_success():
    txns = deepcopy(TRANSACTIONS)
    target = next(row for row in txns if row["pg_txn_id"] == "PTM-TXN-1140")
    target["payout_batch_id"] = None
    result = run(txns=txns)
    assert result["status"] == "INCOMPLETE_OR_UNMATCHED"
    assert "PTM-TXN-1140" in result["unassigned_transaction_ids"]


def test_duplicate_utr_is_flagged():
    txns = deepcopy(TRANSACTIONS)
    txns[1]["utr_rrn"] = txns[0]["utr_rrn"]
    result = run(txns=txns)
    assert result["status"] == "INCOMPLETE_OR_UNMATCHED"
    assert any("duplicate transaction UTR/RRN" in issue for issue in result["issues"])


def test_graph_trace_links_adjustment_through_batch_to_bank():
    graph = build_evidence_graph(TRANSACTIONS, ADJUSTMENTS, SETTLEMENT_BATCHES, BANK_CREDITS)
    path = trace_evidence(graph, "ADJ-EDI-01")
    assert path["path_found"] is True
    assert [node["id"] for node in path["nodes"]] == ["ADJ-EDI-01", TARGET_BATCH_ID, "BANK-ROW-0001"]
    assert path["edges"][0]["match_rule"].startswith("explicit batch_id")
    assert "payout UTR exact match" in path["edges"][1]["match_rule"]


def test_cross_midnight_classification_comes_from_batch_reference_not_timestamp_alone():
    txns = deepcopy(TRANSACTIONS)
    # A timestamp after midnight with an explicit current-batch reference should be counted in that batch,
    # rather than auto-classified as a shift solely due to its clock time.
    target = next(row for row in txns if row["pg_txn_id"] == "PTM-TXN-1140")
    target["payout_batch_id"] = TARGET_BATCH_ID
    banks = deepcopy(BANK_CREDITS)
    # Restore arithmetic by applying the additional amount into the current payout as a test-only fixture.
    banks[0]["credit_paise"] += 185_000
    result = run(txns=txns, banks=banks)
    assert result["known_other_batch_amount_paise"] == 0
    assert result["current_batch_gross_paise"] == 5_000_000
    assert result["residual_paise"] == 0


def test_positive_bank_overcredit_has_negative_residual():
    banks = deepcopy(BANK_CREDITS)
    banks[0]["credit_paise"] += 500
    result = run(banks=banks)
    assert result["residual_paise"] == -500
    assert result["status"] == "UNEXPLAINED_VARIANCE"


def test_two_pointer_cutoff_analysis_pairs_exact_ids_and_reports_cross_date_only():
    from engine import analyse_cutoff_events

    txns = [
        {
            "pg_txn_id": "TX-LATE", "gross_paise": 200_000,
            "capture_ts": "2026-10-26T23:59:58+05:30",
            "nodal_settled_ts": "2026-10-27T00:00:04+05:30",
            "nodal_amount_paise": 200_000, "nodal_source_row_id": "NODE-ROW-LATE", "payout_batch_id": "BATCH-NEXT",
        },
        {
            "pg_txn_id": "TX-DAY", "gross_paise": 50_000,
            "capture_ts": "2026-10-26T12:00:00+05:30",
            "nodal_settled_ts": "2026-10-26T12:00:05+05:30",
            "nodal_amount_paise": 50_000, "nodal_source_row_id": "NODE-ROW-DAY", "payout_batch_id": "BATCH-CURRENT",
        },
    ]
    result = analyse_cutoff_events(txns)
    assert result["matched_count"] == 2
    assert result["cross_midnight_count"] == 1
    assert result["cross_midnight_amount_paise"] == 200_000
    assert result["cross_midnight_examples"][0]["transaction_id"] == "TX-LATE"
    assert result["cross_midnight_examples"][0]["batch_assignment_source"] == "EXPLICIT_SOURCE_REFERENCE"
    assert result["cross_midnight_examples"][0]["amount_match"] is True


def test_cutoff_analysis_does_not_claim_amount_match_when_nodal_amount_missing():
    from engine import analyse_cutoff_events

    result = analyse_cutoff_events([{
        "pg_txn_id": "TX-NO-NODAL-AMOUNT", "gross_paise": 100,
        "capture_ts": "2026-10-26T23:59:58", "nodal_settled_ts": "2026-10-27T00:00:04", "nodal_source_row_id": "NODE-1",
    }])
    assert result["matched_count"] == 1
    assert result["cross_midnight_examples"][0]["amount_match"] is None


def test_cutoff_analysis_marks_duplicate_transaction_references_ambiguous():
    from engine import analyse_cutoff_events

    base = {
        "pg_txn_id": "TX-DUP", "gross_paise": 100,
        "capture_ts": "2026-10-26T23:59:58", "nodal_settled_ts": "2026-10-27T00:00:04", "nodal_source_row_id": "NODE-DUP",
    }
    result = analyse_cutoff_events([deepcopy(base), deepcopy(base)])
    assert result["matched_count"] == 0
    assert result["ambiguous_capture_ids"] == ["TX-DUP", "TX-DUP"]


def test_cutoff_analysis_leaves_events_outside_window_unmatched():
    from engine import analyse_cutoff_events

    result = analyse_cutoff_events([{
        "pg_txn_id": "TX-TOO-LATE", "gross_paise": 100,
        "capture_ts": "2026-10-26T10:00:00", "nodal_settled_ts": "2026-10-28T00:00:01", "nodal_source_row_id": "NODE-LATE",
    }])
    assert result["matched_count"] == 0
    assert result["unmatched_capture_ids"] == ["TX-TOO-LATE"]


def test_duplicate_payment_detector_requires_exact_order_amount_distinct_refs_and_window():
    from engine import detect_duplicate_payments

    base = {
        "order_id": "ORDER-1", "gross_paise": 85_000, "status": "SUCCESS",
        "capture_ts": "2026-10-28T10:00:00", "utr_rrn": "111111111111",
        "pg_txn_id": "TX-1", "source_row_id": "ROW-1",
    }
    second = {**base, "pg_txn_id": "TX-2", "utr_rrn": "222222222222", "capture_ts": "2026-10-28T10:01:59", "source_row_id": "ROW-2", "status": "DEEMED_SUCCESS"}
    outside_window = {**base, "pg_txn_id": "TX-3", "utr_rrn": "333333333333", "capture_ts": "2026-10-28T10:04:00", "source_row_id": "ROW-3"}
    result = detect_duplicate_payments([base, second, outside_window], window_seconds=120)
    assert len(result) == 1
    assert result[0]["order_id"] == "ORDER-1"
    assert result[0]["window_seconds"] == 119
    assert result[0]["requires_human_review"] is True


def test_cutoff_analysis_requires_a_nodal_source_row_reference():
    from engine import analyse_cutoff_events

    result = analyse_cutoff_events([{
        "pg_txn_id": "TX-NO-NODAL-SOURCE", "gross_paise": 100,
        "capture_ts": "2026-10-26T23:59:58", "nodal_settled_ts": "2026-10-27T00:00:04",
    }])
    assert result["matched_count"] == 0
    assert result["invalid_settlement_ids"] == ["TX-NO-NODAL-SOURCE"]


def test_duplicate_detector_checks_payer_identity_when_both_rows_supply_it():
    from engine import detect_duplicate_payments

    base = {
        "order_id": "ORDER-IDENTITY", "gross_paise": 25_000, "status": "SUCCESS",
        "capture_ts": "2026-10-28T10:00:00", "utr_rrn": "111111111111",
        "pg_txn_id": "TX-IDENTITY-1", "customer_vpa": "buyer-one@upi",
    }
    same_payer = {**base, "pg_txn_id": "TX-IDENTITY-2", "utr_rrn": "222222222222", "capture_ts": "2026-10-28T10:00:30", "customer_vpa": "BUYER-ONE@UPI"}
    different_payer = {**base, "pg_txn_id": "TX-IDENTITY-3", "utr_rrn": "333333333333", "capture_ts": "2026-10-28T00:00:30", "customer_vpa": "buyer-two@upi"}

    matched = detect_duplicate_payments([base, same_payer], window_seconds=120)
    contradicted = detect_duplicate_payments([base, different_payer], window_seconds=120)

    assert len(matched) == 1
    assert matched[0]["payer_identity_check"] == "MATCHED"
    assert contradicted == []


def test_duplicate_detector_labels_missing_payer_identity_as_unavailable():
    from engine import detect_duplicate_payments

    base = {
        "order_id": "ORDER-NO-VPA", "gross_paise": 25_000, "status": "SUCCESS",
        "capture_ts": "2026-10-28T10:00:00", "utr_rrn": "111111111111", "pg_txn_id": "TX-NO-VPA-1",
    }
    second = {**base, "pg_txn_id": "TX-NO-VPA-2", "utr_rrn": "222222222222", "capture_ts": "2026-10-28T10:00:30"}
    result = detect_duplicate_payments([base, second], window_seconds=120)
    assert len(result) == 1
    assert result[0]["payer_identity_check"] == "NOT_PROVIDED"
