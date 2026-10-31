"""Deterministic synthetic data for the SettleGraph MVP.

This is demo data, not a Paytm API export and not a statement of actual Paytm fees.
The example reproduces the arithmetic shown in the submitted pitch while keeping every
fee/adjustment as an explicit synthetic source row.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

TARGET_CAPTURE_DATE = "2026-10-26"
TARGET_BATCH_ID = "BATCH-2026-10-27"
NEXT_BATCH_ID = "BATCH-2026-10-28"
BANK_TRANSFER_UTR = "PAYTM-NODAL-20261027-UTR-DEMO"


def build_transactions() -> list[dict[str, Any]]:
    # 138 individual normal UPI rows totalling exactly ₹43,650.00.
    # One generated final row absorbs the integer-paise remainder so the fixture is exact.
    amounts = [28_000 + ((i * 193) % 7_000) for i in range(137)]
    amounts.append(4_365_000 - sum(amounts))
    assert len(amounts) == 138 and sum(amounts) == 4_365_000 and all(x > 0 for x in amounts)

    rows: list[dict[str, Any]] = []
    base = datetime.fromisoformat("2026-10-26T10:00:00")
    for i, amount in enumerate(amounts):
        captured = base + timedelta(minutes=(i * 7) % 700, seconds=i % 55)
        rows.append({
            "pg_txn_id": f"PTM-TXN-{1001 + i}",
            "source_row_id": f"PAY-ROW-{i + 1:04d}",
            "utr_rrn": f"629810{i + 1:06d}",
            "order_id": f"ORD-{8801 + i}",
            "gross_paise": amount,
            "instrument": "UPI_BANK",
            "capture_ts": captured.isoformat(),
            "nodal_settled_ts": (captured + timedelta(seconds=3 + (i % 7))).isoformat(),
            "nodal_amount_paise": amount,
            "nodal_source_row_id": f"NODAL-ROW-{i + 1:04d}",
            "status": "SUCCESS",
            "payout_batch_id": TARGET_BATCH_ID,
            "settlement_reference": f"SETTLE-ROW-{i + 1:04d}",
        })

    rows.append({
        "pg_txn_id": "PTM-TXN-1139",
        "source_row_id": "PAY-ROW-0139",
        "utr_rrn": "629810445566",
        "order_id": "ORD-8939",
        "gross_paise": 450_000,
        "instrument": "RUPAY_CC_UPI",
        "capture_ts": "2026-10-26T19:45:00",
        "nodal_settled_ts": "2026-10-26T19:45:08",
        "nodal_amount_paise": 450_000,
        "nodal_source_row_id": "NODAL-ROW-0139",
        "status": "SUCCESS",
        "payout_batch_id": TARGET_BATCH_ID,
        "settlement_reference": "SETTLE-ROW-0139",
    })
    rows.append({
        "pg_txn_id": "PTM-TXN-1140",
        "source_row_id": "PAY-ROW-0140",
        "utr_rrn": "629810998877",
        "order_id": "ORD-8940",
        "gross_paise": 185_000,
        "instrument": "UPI_BANK",
        "capture_ts": "2026-10-26T23:59:52",
        "nodal_settled_ts": "2026-10-27T00:00:04",
        "nodal_amount_paise": 185_000,
        "nodal_source_row_id": "NODAL-ROW-0140",
        "status": "DEEMED_SUCCESS",
        # This explicit source-backed batch assignment, not timestamp alone, drives the timing classification.
        "payout_batch_id": NEXT_BATCH_ID,
        "settlement_reference": "SETTLE-ROW-0140",
    })
    # Isolated, off-day fixtures power the duplicate-debit detector and local POS
    # sync. They do not change the 26 Oct payout example used by the main dashboard.
    rows.extend([
        {
            "pg_txn_id": "PTM-POS-3310", "source_row_id": "PAY-ROW-POS-3310",
            "utr_rrn": "629899201000", "order_id": "ORD-DEMO-3310",
            "gross_paise": 129_900, "instrument": "UPI_BANK",
            "capture_ts": "2026-10-28T10:00:00", "nodal_settled_ts": "2026-10-28T10:00:07",
            "nodal_amount_paise": 129_900, "nodal_source_row_id": "NODAL-POS-3310", "status": "SUCCESS",
            "payout_batch_id": NEXT_BATCH_ID, "settlement_reference": "SETTLE-POS-3310",
        },
        {
            "pg_txn_id": "PTM-DUP-5512-A", "source_row_id": "PAY-ROW-DUP-5512-A",
            "utr_rrn": "629811001992", "order_id": "ORD-5512", "customer_vpa": "demo-customer-5512@upi",
            "gross_paise": 85_000, "instrument": "UPI_BANK",
            "capture_ts": "2026-10-28T19:14:00", "nodal_settled_ts": "2026-10-28T19:14:05",
            "nodal_amount_paise": 85_000, "nodal_source_row_id": "NODAL-DUP-5512-A", "status": "SUCCESS",
            "payout_batch_id": NEXT_BATCH_ID, "settlement_reference": "SETTLE-DUP-5512-A",
        },
        {
            "pg_txn_id": "PTM-DUP-5512-B", "source_row_id": "PAY-ROW-DUP-5512-B",
            "utr_rrn": "629811002993", "order_id": "ORD-5512", "customer_vpa": "demo-customer-5512@upi",
            "gross_paise": 85_000, "instrument": "UPI_BANK",
            "capture_ts": "2026-10-28T19:15:32", "nodal_settled_ts": "2026-10-28T19:15:38",
            "nodal_amount_paise": 85_000, "nodal_source_row_id": "NODAL-DUP-5512-B", "status": "DEEMED_SUCCESS",
            "payout_batch_id": NEXT_BATCH_ID, "settlement_reference": "SETTLE-DUP-5512-B",
        },
    ])
    assert len(rows) == 143
    assert sum(x["gross_paise"] for x in rows if x["capture_ts"].startswith(TARGET_CAPTURE_DATE)) == 5_000_000
    return rows


def build_adjustments() -> list[dict[str, Any]]:
    # These are explicitly synthetic report rows. Fees are imported from the fixture,
    # not inferred by hard-coded production fee policy.
    return [
        {"adjustment_id": "ADJ-MDR-01", "source_row_id": "SET-ROW-0001", "type": "MDR", "amount_paise": 9_000, "direction": "DEBIT", "batch_id": TARGET_BATCH_ID, "reference_id": "PTM-TXN-1139", "description": "Synthetic example MDR row"},
        {"adjustment_id": "ADJ-GST-01", "source_row_id": "SET-ROW-0002", "type": "GST_ON_MDR", "amount_paise": 1_620, "direction": "DEBIT", "batch_id": TARGET_BATCH_ID, "reference_id": "ADJ-MDR-01", "description": "Synthetic GST row linked to MDR"},
        {"adjustment_id": "ADJ-SWITCH-01", "source_row_id": "SET-ROW-0003", "type": "SWITCH_FEE", "amount_paise": 20, "direction": "DEBIT", "batch_id": TARGET_BATCH_ID, "reference_id": "PTM-TXN-1139", "description": "Synthetic example switch-fee row; not a universal Paytm rule"},
        {"adjustment_id": "ADJ-EDI-01", "source_row_id": "SET-ROW-0004", "type": "LOAN_EDI", "amount_paise": 120_000, "direction": "DEBIT", "batch_id": TARGET_BATCH_ID, "reference_id": "LOAN-9921", "description": "Synthetic merchant loan EDI row"},
        {"adjustment_id": "ADJ-RNT-02", "source_row_id": "SET-ROW-0005", "type": "SOUNDBOX_RENTAL", "amount_paise": 12_500, "direction": "DEBIT", "batch_id": TARGET_BATCH_ID, "reference_id": "SBX-DEV-4410", "description": "Synthetic Soundbox rental row"},
        {"adjustment_id": "ADJ-HLD-03", "source_row_id": "SET-ROW-0006", "type": "UDIR_HOLD", "amount_paise": 100_000, "direction": "DEBIT", "batch_id": TARGET_BATCH_ID, "reference_id": "DSP-2048", "description": "Synthetic dispute-hold row"},
    ]


def build_settlement_batches() -> list[dict[str, Any]]:
    return [
        {"batch_id": TARGET_BATCH_ID, "payout_utr": BANK_TRANSFER_UTR, "payout_date": "2026-10-27", "source_row_id": "BATCH-ROW-0001"},
        {"batch_id": NEXT_BATCH_ID, "payout_utr": "PAYTM-NODAL-20261028-UTR-DEMO", "payout_date": "2026-10-28", "source_row_id": "BATCH-ROW-0002"},
    ]


def build_bank_credits() -> list[dict[str, Any]]:
    return [{
        "bank_row_id": "BANK-ROW-0001",
        "batch_id": TARGET_BATCH_ID,
        "transfer_utr": BANK_TRANSFER_UTR,
        "credit_paise": 4_571_860,
        "credit_date": "2026-10-27",
        "source_file": "synthetic_bank_statement.csv",
    }]


TRANSACTIONS = build_transactions()
ADJUSTMENTS = build_adjustments()
SETTLEMENT_BATCHES = build_settlement_batches()
BANK_CREDITS = build_bank_credits()


def build_dispute_cases() -> list[dict[str, Any]]:
    """Create synthetic dispute evidence cases linked to exact seeded payment rows."""
    by_utr: dict[str, list[dict[str, Any]]] = {}
    for transaction in TRANSACTIONS:
        utr = str(transaction.get("utr_rrn") or "").strip()
        if utr:
            by_utr.setdefault(utr, []).append(transaction)

    specifications = [
        {
            "case_id": "DSP-DEMO-2049", "disputed_paise": 450_000,
            "utr_rrn": "629810445566", "order_id": "ORD-8939",
            "order_status": "DELIVERED", "invoice_amount_paise": 450_000,
            "invoice_source_row_id": "POS-INVOICE-8939",
            "awb": "DLV-DEMO-992104", "courier_status": "DELIVERED",
            "otp_verified": True, "courier_source_row_id": "COURIER-DELIVERY-8939",
            "description": "Synthetic delivery dispute with a source-linked nodal payment and matching POS/courier fixture evidence.",
        },
        {
            "case_id": "DSP-DEMO-2052", "disputed_paise": 85_000,
            "utr_rrn": "629811001992", "order_id": "ORD-5512",
            "order_status": "DELIVERED", "invoice_amount_paise": 85_000,
            "invoice_source_row_id": "POS-INVOICE-5512",
            "awb": "LOCAL-PICKUP-DEMO", "courier_status": "DELIVERED",
            "otp_verified": True, "courier_source_row_id": "COURIER-PICKUP-5512",
            "description": "Synthetic duplicate-payment review case; the duplicate is detected from two loaded payment rows, not from this case ID.",
        },
    ]
    cases: list[dict[str, Any]] = []
    for specification in specifications:
        case = dict(specification)
        matches = by_utr.get(str(case["utr_rrn"]), [])
        case["payment_reference_match_count"] = len(matches)
        payment = matches[0] if len(matches) == 1 else None
        case["nodal_status"] = payment.get("status") if payment else None
        case["nodal_amount_paise"] = payment.get("nodal_amount_paise") if payment else None
        case["nodal_source_row_id"] = payment.get("nodal_source_row_id") if payment else None
        case["payment_order_id"] = payment.get("order_id") if payment else None
        case["payment_order_mismatch"] = bool(payment and case.get("order_id") and payment.get("order_id") != case.get("order_id"))
        case["source_mode"] = "BUILT_IN_SYNTHETIC_FIXTURE"
        cases.append(case)
    return cases


DISPUTE_CASES = build_dispute_cases()
