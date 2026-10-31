import json
import pytest

from paytm_settlement_adapter import adapt_paytm_settlement_csv, parse_inr_paise


def test_parse_rupee_values_to_exact_paise():
    assert parse_inr_paise("₹1,234.56") == 123456
    assert parse_inr_paise("INR 45,718.80") == 4571880
    assert parse_inr_paise("(12.50)") == -1250
    assert parse_inr_paise("") is None


def test_reject_more_than_two_decimal_places_and_int64_overflow():
    with pytest.raises(ValueError, match="more than two decimal"):
        parse_inr_paise("1.001")
    with pytest.raises(ValueError, match="int64"):
        parse_inr_paise("99999999999999999.99")


def test_adapter_maps_documented_report_headers_and_preserves_provenance():
    csv_bytes = (
        "Transaction ID,Order ID,Transaction Date,Updated Date,Transaction Type,Status,Amount,Commission,GST,Settled Amount,Settled Date,UTR No,Split Flag,Payment Mode\n"
        "TX-1,ORD-1,2026-10-26,2026-10-26,Acquiring,Success,1,000.00,10.00,1.80,988.20,2026-10-27,UTR-1,false,UPI\n"
    ).encode("utf-8")
    # Amount with comma is quoted in real CSV; ensure CSV parser handles it.
    csv_bytes = csv_bytes.replace(b"1,000.00", b'"1,000.00"')
    result = adapt_paytm_settlement_csv(csv_bytes, "settlement.csv")
    row = result["rows"][0]
    assert result["row_count"] == 1
    assert row["transaction_id"] == "TX-1"
    assert row["transaction_type"] == "ACQUIRING"
    assert row["status"] == "SUCCESS"
    assert row["amount_paise"] == 100000
    assert row["commission_paise"] == 1000
    assert row["gst_paise"] == 180
    assert row["settled_amount_paise"] == 98820
    assert row["utr"] == "UTR-1"
    assert row["payout_batch_id"] is None
    assert len(row["source_file_sha256"]) == 64
    assert len(row["source_row_sha256"]) == 64


def test_missing_optional_fee_fields_remain_null_not_zero():
    csv_bytes = (
        "Transaction ID,Transaction Type,Status,Amount\n"
        "TX-2,Acquiring,Success,250.00\n"
    ).encode()
    row = adapt_paytm_settlement_csv(csv_bytes, "minimal.csv")["rows"][0]
    assert row["commission_paise"] is None
    assert row["gst_paise"] is None
    assert row["settled_amount_paise"] is None
    assert row["order_id"] is None


def test_invalid_row_rejects_whole_preview_instead_of_partial_activation():
    csv_bytes = (
        "Transaction ID,Transaction Type,Status,Amount\n"
        "TX-1,Acquiring,Success,100.00\n"
        "TX-2,Refund,Success,10.001\n"
    ).encode()
    with pytest.raises(ValueError) as exc:
        adapt_paytm_settlement_csv(csv_bytes, "bad.csv")
    payload = json.loads(str(exc.value))
    assert payload["message"] == "CSV validation failed; no rows activated"
    assert payload["errors"][0]["source_row_number"] == 3
