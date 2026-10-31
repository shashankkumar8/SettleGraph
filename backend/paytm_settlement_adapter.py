"""Conservative normalizer for Paytm-style settlement CSV exports.

This is a preview adapter, not a live Paytm API client. Header aliases are inferred
from the publicly documented settlement-report field names and must be checked
against the merchant's actual downloaded export before production use.

All raw values are preserved. Missing numeric fields remain None rather than being
silently interpreted as zero. This module does not infer payout-batch membership.
"""
from __future__ import annotations

import csv
import hashlib
import io
import json
import re
from decimal import Decimal, InvalidOperation
from typing import Any


ALIASES: dict[str, tuple[str, ...]] = {
    "transaction_id": ("Transaction ID", "Txn ID", "PG Transaction ID"),
    "order_id": ("Order ID", "Merchant Order ID"),
    "transaction_date": ("Transaction Date", "Txn Date"),
    "updated_date": ("Updated Date", "Updated At", "Success Date"),
    "transaction_type": ("Transaction Type", "Order Type", "Txn Type"),
    "status": ("Status", "Transaction Status"),
    "amount": ("Amount", "Transaction Amount", "Gross Amount"),
    "commission": ("Commission", "MDR", "Commission Amount"),
    "gst": ("GST", "GST Amount"),
    "settled_amount": ("Settled Amount", "Net Settled Amount"),
    "settled_date": ("Settled Date", "Settlement Date"),
    "utr": ("UTR No", "UTR", "Bank UTR", "Settlement UTR"),
    "split_flag": ("Split Flag", "Split"),
    "payment_mode": ("Payment Mode", "Pay Mode", "Instrument"),
}

REQUIRED = ("transaction_id", "transaction_type", "status", "amount")


def _header_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", str(value).strip().lower())


def _canonical_headers(fieldnames: list[str] | None) -> dict[str, str]:
    if not fieldnames:
        raise ValueError("CSV has no header row")
    lookup = {_header_key(name): name for name in fieldnames if name is not None}
    result: dict[str, str] = {}
    for canonical, aliases in ALIASES.items():
        for alias in aliases:
            key = _header_key(alias)
            if key in lookup:
                result[canonical] = lookup[key]
                break
    missing = [name for name in REQUIRED if name not in result]
    if missing:
        raise ValueError("CSV is missing required columns: " + ", ".join(missing))
    return result


def parse_inr_paise(raw: Any, *, field_name: str = "amount") -> int | None:
    """Parse a rupee string into exact integer paise. Blank remains None."""
    if raw is None or str(raw).strip() == "":
        return None
    value = str(raw).strip().replace(",", "")
    value = re.sub(r"^(INR|Rs\.?|₹)\s*", "", value, flags=re.IGNORECASE).strip()
    negative_parentheses = value.startswith("(") and value.endswith(")")
    if negative_parentheses:
        value = value[1:-1].strip()
    try:
        amount = Decimal(value)
    except InvalidOperation as exc:
        raise ValueError(f"invalid {field_name}: {raw!r}") from exc
    if not amount.is_finite():
        raise ValueError(f"non-finite {field_name}: {raw!r}")
    if negative_parentheses:
        amount = -abs(amount)
    paise = amount * Decimal(100)
    if paise != paise.to_integral_value():
        raise ValueError(f"{field_name} has more than two decimal places: {raw!r}")
    result = int(paise)
    # Enforce signed int64 for the financial kernel's interchange contract.
    if not -(2**63) <= result <= 2**63 - 1:
        raise ValueError(f"{field_name} exceeds signed int64 paise range")
    return result


def _canonical_json_sha256(value: Any) -> str:
    payload = json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def adapt_paytm_settlement_csv(content: bytes, filename: str) -> dict[str, Any]:
    """Parse and normalize a Paytm-style settlement export without guessing.

    The output intentionally leaves `payout_batch_id` unset. The documented report
    fields include UTR/settled date/split flag, but the exact batch relationship must
    be established from the relevant settlement-level export/API or explicit mapping.
    """
    if not filename.lower().endswith(".csv"):
        raise ValueError("upload must be a .csv file")
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise ValueError("CSV must be UTF-8 or UTF-8 with BOM; choose an explicit encoding adapter otherwise") from exc
    reader = csv.DictReader(io.StringIO(text, newline=""))
    header_map = _canonical_headers(reader.fieldnames)
    file_hash = hashlib.sha256(content).hexdigest()
    normalized: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []

    for line_no, raw_row in enumerate(reader, start=2):
        if not raw_row or all(value is None or str(value).strip() == "" for value in raw_row.values()):
            continue
        try:
            def get(name: str) -> str | None:
                original_header = header_map.get(name)
                if original_header is None:
                    return None
                value = raw_row.get(original_header)
                return None if value is None or str(value).strip() == "" else str(value).strip()

            raw = {str(k): ("" if v is None else str(v)) for k, v in raw_row.items() if k is not None}
            amount = parse_inr_paise(get("amount"), field_name="amount")
            commission = parse_inr_paise(get("commission"), field_name="commission")
            gst = parse_inr_paise(get("gst"), field_name="gst")
            settled_amount = parse_inr_paise(get("settled_amount"), field_name="settled_amount")
            row = {
                "transaction_id": get("transaction_id"),
                "order_id": get("order_id"),
                "transaction_date": get("transaction_date"),
                "updated_date": get("updated_date"),
                "transaction_type": (get("transaction_type") or "").strip().upper().replace(" ", "_"),
                "status": (get("status") or "").strip().upper().replace(" ", "_"),
                "amount_paise": amount,
                "commission_paise": commission,
                "gst_paise": gst,
                "settled_amount_paise": settled_amount,
                "settled_date": get("settled_date"),
                "utr": get("utr"),
                "split_flag": get("split_flag"),
                "payment_mode": get("payment_mode"),
                "source_file": filename,
                "source_row_number": line_no,
                "source_file_sha256": file_hash,
                "source_row_sha256": _canonical_json_sha256(raw),
                "raw": raw,
                "payout_batch_id": None,
                "batch_assignment_note": "Not inferred from timestamp; requires authoritative payout/batch mapping.",
            }
            if not row["transaction_id"]:
                raise ValueError("transaction ID is blank")
            normalized.append(row)
        except ValueError as exc:
            errors.append({"source_file": filename, "source_row_number": line_no, "error": str(exc), "raw": raw_row})

    if errors:
        # Preview is atomic: caller must not activate a partial dataset.
        raise ValueError(json.dumps({"message": "CSV validation failed; no rows activated", "errors": errors}, ensure_ascii=False))
    return {
        "source_file": filename,
        "source_file_sha256": file_hash,
        "row_count": len(normalized),
        "header_mapping": header_map,
        "rows": normalized,
        "notes": [
            "This adapter normalizes a Paytm-style CSV export; verify header names against the merchant's actual export.",
            "Missing commission/GST/settled values remain null, not zero.",
            "Payout batch assignment is not inferred from timestamps.",
            "A source hash detects changes after ingestion; it does not prove source authenticity.",
        ],
    }
