"""Deterministic reconciliation and evidence-graph core for the SettleGraph MVP."""
from __future__ import annotations

import hashlib
import json
from datetime import datetime, timedelta, timezone
from collections import defaultdict
from typing import Any

import networkx as nx

KNOWN_ADJUSTMENT_TYPES = {
    "MDR": "Merchant discount rate",
    "GST_ON_MDR": "GST on recorded MDR",
    "SWITCH_FEE": "Switch fee (source-recorded)",
    "LOAN_EDI": "Loan EDI recovery",
    "SOUNDBOX_RENTAL": "Soundbox/POS rental",
    "UDIR_HOLD": "Dispute hold",
    "REFUND": "Refund",
    "CHARGEBACK": "Chargeback",
    "REVERSAL": "Reversal",
    "RECOVERY": "Recovery",
}


def money(paise: int) -> str:
    """Format an integer-paise amount without float arithmetic."""
    sign = "-" if paise < 0 else ""
    amount = abs(int(paise))
    rupees, cents = divmod(amount, 100)
    return f"{sign}₹{rupees:,}.{cents:02d}"


def sha256_json(value: Any) -> str:
    canonical = json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def build_merkle_tree(records: list[tuple[str, str, dict[str, Any]]]) -> dict[str, Any]:
    """Build a deterministic SHA-256 Merkle tree over canonical source rows.

    Leaf and parent domains are prefixed to avoid ambiguous encodings. An odd node
    is promoted by pairing it with itself. This proves snapshot integrity only.
    """
    ordered = sorted(records, key=lambda item: (item[0], item[1]))
    leaves: list[dict[str, Any]] = []
    hashes: list[str] = []
    for kind, record_id, row in ordered:
        canonical = {"kind": kind, "id": record_id, "row": row}
        leaf_hash = hashlib.sha256(("leaf:" + json.dumps(canonical, sort_keys=True, ensure_ascii=False, separators=(",", ":"))).encode("utf-8")).hexdigest()
        leaves.append({"kind": kind, "id": record_id, "leaf_sha256": leaf_hash})
        hashes.append(leaf_hash)
    if not hashes:
        empty = hashlib.sha256(b"EMPTY_SETTLEGRAPH_MERKLE").hexdigest()
        return {"root_sha256": empty, "leaf_count": 0, "leaves": [], "proofs": {}}

    levels = [hashes]
    while len(levels[-1]) > 1:
        current = levels[-1]
        next_level: list[str] = []
        for i in range(0, len(current), 2):
            left = current[i]
            right = current[i + 1] if i + 1 < len(current) else left
            next_level.append(hashlib.sha256(("node:" + left + right).encode("ascii")).hexdigest())
        levels.append(next_level)

    proofs: dict[str, list[dict[str, str]]] = {}
    for leaf_index, leaf in enumerate(leaves):
        idx = leaf_index
        proof: list[dict[str, str]] = []
        for level in levels[:-1]:
            sibling_index = idx - 1 if idx % 2 else idx + 1
            if sibling_index >= len(level):
                sibling_index = idx
            proof.append({"side": "left" if sibling_index < idx else "right", "sha256": level[sibling_index]})
            idx //= 2
        proofs[f"{leaf['kind']}:{leaf['id']}"] = proof
    return {"root_sha256": levels[-1][0], "leaf_count": len(leaves), "leaves": leaves, "proofs": proofs}


def verify_merkle_proof(leaf_sha256: str, proof: list[dict[str, str]], root_sha256: str) -> bool:
    current = leaf_sha256
    for step in proof:
        sibling = step["sha256"]
        if step["side"] == "left":
            current = hashlib.sha256(("node:" + sibling + current).encode("ascii")).hexdigest()
        else:
            current = hashlib.sha256(("node:" + current + sibling).encode("ascii")).hexdigest()
    return current == root_sha256


def dispute_evidence_merkle_tree(case: dict[str, Any]) -> dict[str, Any]:
    """Hash the three evidence domains promised by the SettleGraph pitch.

    The leaves bind the nodal payment, POS invoice/order, and courier delivery
    evidence. This is an integrity fingerprint over the fields supplied to this
    local evaluation; it does not authenticate the upstream providers.
    """
    case_id = str(case.get("case_id") or "UNIDENTIFIED_CASE")
    records = [
        ("NODAL_PAYMENT", f"{case_id}:nodal", {
            "utr_rrn": case.get("utr_rrn"),
            "status": case.get("nodal_status"),
            "amount_paise": case.get("nodal_amount_paise"),
            "source_row_id": case.get("nodal_source_row_id"),
            "linked_order_id": case.get("payment_order_id"),
        }),
        ("POS_ORDER_INVOICE", f"{case_id}:pos", {
            "order_id": case.get("order_id"),
            "status": case.get("order_status"),
            "invoice_amount_paise": case.get("invoice_amount_paise"),
            "source_row_id": case.get("invoice_source_row_id"),
        }),
        ("COURIER_DELIVERY", f"{case_id}:courier", {
            "awb": case.get("awb"),
            "status": case.get("courier_status"),
            "otp_verified": case.get("otp_verified") is True,
            "source_row_id": case.get("courier_source_row_id"),
        }),
    ]
    tree = build_merkle_tree(records)
    tree["evidence_model"] = "THREE_WAY_NODAL_POS_COURIER"
    tree["source_authenticity_verified"] = False
    return tree


def _parse_event_time(value: Any) -> datetime | None:
    """Parse ISO timestamps into UTC for interval comparisons.

    Naive timestamps are interpreted as UTC only for ordering; deployments should
    provide timezone-aware source timestamps and document the merchant timezone.
    """
    if value is None or not str(value).strip():
        return None
    try:
        parsed = datetime.fromisoformat(str(value).strip().replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def analyse_cutoff_events(
    transactions: list[dict[str, Any]],
    *,
    before_minutes: int = 15,
    after_hours: int = 36,
) -> dict[str, Any]:
    """Pair capture and nodal events with a two-pointer time window.

    Exact transaction IDs establish a pair; the time window only bounds candidate
    search. Amount, timestamp or proximity alone never assign a payout batch. The
    batch remains the explicit source field on the matched transaction record.
    """
    if before_minutes < 0 or after_hours < 0:
        raise ValueError("cutoff window values must be non-negative")
    captures: list[dict[str, Any]] = []
    settlements: list[dict[str, Any]] = []
    invalid_capture_ids: list[str] = []
    invalid_settlement_ids: list[str] = []

    for row in transactions:
        ref = str(row.get("pg_txn_id") or "").strip()
        capture_time = _parse_event_time(row.get("capture_ts"))
        if capture_time is None:
            invalid_capture_ids.append(ref or "UNKNOWN")
            continue
        captures.append({"ref": ref, "time": capture_time, "local_date": str(row.get("capture_ts"))[:10], "row": row})
        settled_raw = row.get("nodal_settled_ts")
        if settled_raw:
            if not str(row.get("nodal_source_row_id") or "").strip():
                invalid_settlement_ids.append(ref or "UNKNOWN")
                continue
            settled_time = _parse_event_time(settled_raw)
            if settled_time is None:
                invalid_settlement_ids.append(ref or "UNKNOWN")
            else:
                settlements.append({"ref": ref, "time": settled_time, "local_date": str(settled_raw)[:10], "row": row})

    if not settlements:
        return {
            "available": False,
            "algorithm": "TWO_POINTER_BOUNDED_WINDOW_EXACT_REFERENCE",
            "reason": "No nodal_settled_ts event field is present in the loaded source rows.",
            "capture_event_count": len(captures),
            "nodal_event_count": 0,
            "matched_count": 0,
            "cross_midnight_count": 0,
            "cross_midnight_amount_paise": 0,
            "unmatched_capture_ids": [row["ref"] for row in captures],
            "ambiguous_capture_ids": [],
            "invalid_capture_ids": invalid_capture_ids,
            "invalid_settlement_ids": invalid_settlement_ids,
            "examples": [],
        }

    captures.sort(key=lambda item: (item["time"], item["ref"]))
    settlements.sort(key=lambda item: (item["time"], item["ref"]))
    capture_ref_counts: dict[str, int] = defaultdict(int)
    for event in captures:
        capture_ref_counts[event["ref"]] += 1
    lower_window = timedelta(minutes=before_minutes)
    upper_window = timedelta(hours=after_hours)
    left = 0
    right = 0
    consumed: set[int] = set()
    settlement_indexes_by_ref: dict[str, list[int]] = defaultdict(list)
    for index, event in enumerate(settlements):
        settlement_indexes_by_ref[event["ref"]].append(index)
    matched: list[dict[str, Any]] = []
    unmatched: list[str] = []
    ambiguous: list[str] = []

    # Both streams are time-sorted. The left/right pointers move only forward;
    # an ID index avoids scanning every event inside each overlapping window.
    # Matching is O(n + m) plus the number of repeated IDs reported as conflicts.
    for capture in captures:
        if capture_ref_counts[capture["ref"]] > 1:
            ambiguous.append(capture["ref"])
            continue
        while left < len(settlements) and settlements[left]["time"] < capture["time"] - lower_window:
            left += 1
        if right < left:
            right = left
        while right < len(settlements) and settlements[right]["time"] <= capture["time"] + upper_window:
            right += 1
        all_indexes = settlement_indexes_by_ref.get(capture["ref"], [])
        candidates = [index for index in all_indexes if left <= index < right]
        if len(all_indexes) > 1 or len(candidates) > 1:
            ambiguous.append(capture["ref"])
            continue
        if len(candidates) != 1:
            unmatched.append(capture["ref"])
            continue
        index = candidates[0]
        if index in consumed:
            ambiguous.append(capture["ref"])
            continue
        consumed.add(index)
        settled = settlements[index]
        row = capture["row"]
        amount_paise = int(row.get("gross_paise", 0))
        nodal_amount = settled["row"].get("nodal_amount_paise")
        amount_match = None if nodal_amount is None else amount_paise == int(nodal_amount)
        is_cross_midnight = capture["local_date"] != settled["local_date"]
        matched.append({
            "transaction_id": capture["ref"],
            "capture_ts": row.get("capture_ts"),
            "nodal_settled_ts": settled["row"].get("nodal_settled_ts"),
            "capture_date": capture["local_date"],
            "settlement_date": settled["local_date"],
            "cross_midnight": is_cross_midnight,
            "amount_paise": amount_paise,
            "amount_match": amount_match,
            "payout_batch_id": row.get("payout_batch_id"),
            "batch_assignment_source": "EXPLICIT_SOURCE_REFERENCE" if row.get("payout_batch_id") else "UNASSIGNED",
            "capture_source_row_id": row.get("source_row_id"),
            "settlement_source_row_id": row.get("nodal_source_row_id") or row.get("source_row_id"),
        })

    cross_midnight = [row for row in matched if row["cross_midnight"]]
    return {
        "available": True,
        "algorithm": "TWO_POINTER_BOUNDED_WINDOW_EXACT_REFERENCE",
        "window": {"before_minutes": before_minutes, "after_hours": after_hours},
        "capture_event_count": len(captures),
        "nodal_event_count": len(settlements),
        "matched_count": len(matched),
        "cross_midnight_count": len(cross_midnight),
        "cross_midnight_amount_paise": sum(row["amount_paise"] for row in cross_midnight),
        "unmatched_capture_ids": unmatched,
        "ambiguous_capture_ids": ambiguous,
        "invalid_capture_ids": invalid_capture_ids,
        "invalid_settlement_ids": invalid_settlement_ids,
        "examples": matched[:8],
        "cross_midnight_examples": cross_midnight[:12],
        "note": "Exact transaction ID establishes the event pair. Amount comparison is reported only when a nodal amount field is present. The time window does not infer payout batch membership; batch IDs remain source-provided.",
    }


def detect_duplicate_payments(
    transactions: list[dict[str, Any]], *, window_seconds: int = 120,
) -> list[dict[str, Any]]:
    """Find exact same-order/same-paise successful payment pairs within a window.

    Uses sorted timestamp groups and a sliding two-pointer window. It returns
    candidates for review; it does not initiate or recommend an automatic refund.
    """
    if window_seconds < 0:
        raise ValueError("window_seconds must be non-negative")
    groups: dict[tuple[str, int], list[dict[str, Any]]] = defaultdict(list)
    for row in transactions:
        if str(row.get("status", "")).upper() not in {"SUCCESS", "DEEMED_SUCCESS"}:
            continue
        if row.get("reversed") is True or str(row.get("reversal_status") or "").upper() in {"REVERSED", "REFUNDED", "CHARGEBACK_REVERSED"}:
            continue
        order_id = str(row.get("order_id") or "").strip()
        ref = str(row.get("pg_txn_id") or "").strip()
        utr = str(row.get("utr_rrn") or "").strip()
        try:
            amount = int(row.get("gross_paise"))
        except (TypeError, ValueError):
            continue
        event_time = _parse_event_time(row.get("capture_ts"))
        if not order_id or not ref or not utr or amount <= 0 or event_time is None:
            continue
        groups.setdefault((order_id, amount), []).append({"time": event_time, "row": row})

    matches: list[dict[str, Any]] = []
    window = timedelta(seconds=window_seconds)
    for (order_id, amount), rows in groups.items():
        rows.sort(key=lambda item: (item["time"], str(item["row"].get("pg_txn_id"))))
        left = 0
        for right in range(len(rows)):
            while rows[right]["time"] - rows[left]["time"] > window:
                left += 1
            for first_index in range(left, right):
                first = rows[first_index]["row"]
                second = rows[right]["row"]
                if first.get("pg_txn_id") == second.get("pg_txn_id") or first.get("utr_rrn") == second.get("utr_rrn"):
                    continue
                first_payer = str(first.get("customer_vpa") or first.get("payer_vpa") or "").strip().casefold()
                second_payer = str(second.get("customer_vpa") or second.get("payer_vpa") or "").strip().casefold()
                if first_payer and second_payer and first_payer != second_payer:
                    # Same order/amount is not sufficient when two populated payer
                    # identities contradict one another. Leave the pair for a richer
                    # case-management/review path rather than asserting a duplicate.
                    continue
                payer_check = "MATCHED" if first_payer and second_payer else "NOT_PROVIDED"
                delta = int((rows[right]["time"] - rows[first_index]["time"]).total_seconds())
                matches.append({
                    "order_id": order_id,
                    "amount_paise": amount,
                    "window_seconds": delta,
                    "payer_identity_check": payer_check,
                    "payment_references": [
                        {"transaction_id": first.get("pg_txn_id"), "utr_rrn": first.get("utr_rrn"), "status": first.get("status"), "capture_ts": first.get("capture_ts"), "source_row_id": first.get("source_row_id")},
                        {"transaction_id": second.get("pg_txn_id"), "utr_rrn": second.get("utr_rrn"), "status": second.get("status"), "capture_ts": second.get("capture_ts"), "source_row_id": second.get("source_row_id")},
                    ],
                    "rule": "EXACT_ORDER_AND_AMOUNT_DISTINCT_SUCCESS_REFERENCES_WINDOW_AND_PAYER_CONSISTENCY_WHEN_AVAILABLE",
                    "requires_human_review": True,
                })
                if len(matches) >= 50:
                    return matches
    return matches


def dataset_merkle_tree(
    transactions: list[dict[str, Any]], adjustments: list[dict[str, Any]],
    settlement_batches: list[dict[str, Any]], bank_credits: list[dict[str, Any]],
) -> dict[str, Any]:
    records: list[tuple[str, str, dict[str, Any]]] = []
    for kind, rows, key in (
        ("payment", transactions, "pg_txn_id"),
        ("adjustment", adjustments, "adjustment_id"),
        ("settlement_batch", settlement_batches, "batch_id"),
        ("bank_credit", bank_credits, "bank_row_id"),
    ):
        for row in rows:
            records.append((kind, str(row.get(key, "")), row))
    return build_merkle_tree(records)


def _index_unique(rows: list[dict[str, Any]], key: str, kind: str) -> list[str]:
    seen: set[str] = set()
    duplicates: list[str] = []
    for row in rows:
        value = str(row.get(key, "")).strip()
        if not value:
            duplicates.append(f"missing {key} in {kind} row")
        elif value in seen:
            duplicates.append(f"duplicate {kind} {key}: {value}")
        seen.add(value)
    return duplicates


def reconcile(
    transactions: list[dict[str, Any]],
    adjustments: list[dict[str, Any]],
    settlement_batches: list[dict[str, Any]],
    bank_credits: list[dict[str, Any]],
    target_capture_date: str,
    target_batch_id: str,
) -> dict[str, Any]:
    """Reconcile a capture day to one explicit payout batch.

    Core rule: transaction assignment is driven by the batch reference in source data;
    timestamps help explain records but never silently decide a financial match.
    Adjustment values are counted only when they are explicit debit rows assigned to
    the selected batch. Unknown categories remain visible and require review.
    """
    issues: list[str] = []
    issues += _index_unique(transactions, "pg_txn_id", "transaction")
    # A blank/missing UTR is an unresolved reference, not proof of fraud. Reuse of
    # a populated UTR across distinct transaction rows is a data-integrity conflict.
    populated_utrs = [str(row.get("utr_rrn")).strip() for row in transactions if str(row.get("utr_rrn") or "").strip()]
    seen_utrs: set[str] = set()
    for utr in populated_utrs:
        if utr in seen_utrs:
            issues.append(f"duplicate transaction UTR/RRN reference: {utr}")
        seen_utrs.add(utr)
    issues += _index_unique(adjustments, "adjustment_id", "adjustment")
    issues += _index_unique(settlement_batches, "batch_id", "settlement batch")
    issues += _index_unique(bank_credits, "bank_row_id", "bank")

    by_batch = {str(b.get("batch_id", "")): b for b in settlement_batches}
    if target_batch_id not in by_batch:
        issues.append(f"target settlement batch not found: {target_batch_id}")
    target_batch = by_batch.get(target_batch_id, {})

    capture_rows: list[dict[str, Any]] = []
    for row in transactions:
        try:
            amount = int(row["gross_paise"])
            if amount < 0:
                issues.append(f"negative transaction amount: {row.get('pg_txn_id', '?')}")
            raw_timestamp = str(row.get("capture_ts", "")).replace("Z", "+00:00")
            captured_at = datetime.fromisoformat(raw_timestamp)
            if row.get("status") in {"SUCCESS", "DEEMED_SUCCESS"} and captured_at.date().isoformat() == target_capture_date:
                capture_rows.append(row)
        except (KeyError, TypeError, ValueError):
            issues.append(f"invalid monetary or timestamp data: {row.get('pg_txn_id', '?')}")

    gross_captured = sum(int(r["gross_paise"]) for r in capture_rows)
    known_batch_ids = set(by_batch)
    assigned_rows = [r for r in capture_rows if r.get("payout_batch_id") == target_batch_id]
    shifted_rows = [r for r in capture_rows if r.get("payout_batch_id") in known_batch_ids and r.get("payout_batch_id") != target_batch_id]
    unassigned_rows = [r for r in capture_rows if r.get("payout_batch_id") in {None, ""} or r.get("payout_batch_id") not in known_batch_ids]
    current_batch_gross = sum(int(r["gross_paise"]) for r in assigned_rows)
    shift_paise = sum(int(r["gross_paise"]) for r in shifted_rows)
    if unassigned_rows:
        issues.append(f"{len(unassigned_rows)} transaction(s) have no valid authoritative payout batch reference")
    for row in adjustments:
        if row.get("batch_id") not in known_batch_ids:
            issues.append(f"adjustment {row.get('adjustment_id', '?')} references an unknown or missing batch")

    # Explicit batch references, not guesswork from amount/time, determine this payout's eligible rows.
    selected_adjustments = [a for a in adjustments if a.get("batch_id") == target_batch_id]
    adjustment_buckets: dict[str, int] = defaultdict(int)
    unknown_adjustments: list[dict[str, Any]] = []
    for row in selected_adjustments:
        try:
            amount = int(row["amount_paise"])
            direction = str(row.get("direction", "DEBIT")).upper()
            if amount < 0:
                issues.append(f"negative adjustment amount: {row.get('adjustment_id', '?')}")
            if direction not in {"DEBIT", "CREDIT"}:
                issues.append(f"invalid adjustment direction: {row.get('adjustment_id', '?')}")
                continue
            signed_amount = amount if direction == "DEBIT" else -amount
            adjustment_buckets[str(row.get("type", "UNKNOWN"))] += signed_amount
            if row.get("type") not in KNOWN_ADJUSTMENT_TYPES:
                unknown_adjustments.append(row)
        except (KeyError, TypeError, ValueError):
            issues.append(f"invalid adjustment row: {row.get('adjustment_id', '?')}")

    total_adjustments = sum(adjustment_buckets.values())
    expected_net = current_batch_gross - total_adjustments
    selected_bank_rows = [b for b in bank_credits if b.get("batch_id") == target_batch_id]
    matching_bank_rows = [b for b in selected_bank_rows if b.get("transfer_utr") == target_batch.get("payout_utr")]
    unmatched_bank_rows = [b for b in selected_bank_rows if b not in matching_bank_rows]
    if not matching_bank_rows:
        issues.append(f"no bank credit row for {target_batch_id} has the authoritative payout UTR")
    for row in unmatched_bank_rows:
        issues.append(f"bank row {row.get('bank_row_id', '?')} has a transfer UTR that does not match the payout batch")
    actual_bank = sum(int(b.get("credit_paise", 0)) for b in matching_bank_rows)
    residual = expected_net - actual_bank

    if issues:
        status = "INCOMPLETE_OR_UNMATCHED"
    elif residual != 0:
        status = "UNEXPLAINED_VARIANCE"
    elif unknown_adjustments:
        status = "NEEDS_REVIEW"
    else:
        status = "RECONCILED"

    buckets = []
    for kind, amount in sorted(adjustment_buckets.items()):
        buckets.append({
            "type": kind,
            "label": KNOWN_ADJUSTMENT_TYPES.get(kind, "Unknown adjustment category"),
            "amount_paise": amount,
            "amount_display": money(amount),
            "known_category": kind in KNOWN_ADJUSTMENT_TYPES,
        })

    source_snapshot = {
        "transactions": sorted(transactions, key=lambda r: str(r.get("pg_txn_id", ""))),
        "adjustments": sorted(adjustments, key=lambda r: str(r.get("adjustment_id", ""))),
        "settlement_batches": sorted(settlement_batches, key=lambda r: str(r.get("batch_id", ""))),
        "bank_credits": sorted(bank_credits, key=lambda r: str(r.get("bank_row_id", ""))),
    }
    # This is a snapshot SHA-256, not a claim of a complete Merkle tree or source authenticity.
    snapshot_hash = sha256_json(source_snapshot)
    merkle = dataset_merkle_tree(transactions, adjustments, settlement_batches, bank_credits)

    return {
        "target_capture_date": target_capture_date,
        "target_batch_id": target_batch_id,
        "status": status,
        "status_explanation": {
            "RECONCILED": "The source-backed batch, adjustment entries and bank credit balance to zero residual.",
            "UNEXPLAINED_VARIANCE": "The calculated expected net and matched bank credit differ.",
            "NEEDS_REVIEW": "Amounts balance, but one or more adjustment categories are unknown.",
            "INCOMPLETE_OR_UNMATCHED": "Required references or rows are missing, duplicated, invalid or conflicting.",
        }[status],
        "transaction_count": len(capture_rows),
        "assigned_transaction_count": len(assigned_rows),
        "shifted_transaction_count": len(shifted_rows),
        "gross_captured_paise": gross_captured,
        "gross_captured_display": money(gross_captured),
        "current_batch_gross_paise": current_batch_gross,
        "current_batch_gross_display": money(current_batch_gross),
        "known_other_batch_amount_paise": shift_paise,
        "known_other_batch_amount_display": money(shift_paise),
        "total_adjustments_paise": total_adjustments,
        "total_adjustments_display": money(total_adjustments),
        "expected_net_paise": expected_net,
        "expected_net_display": money(expected_net),
        "actual_bank_paise": actual_bank,
        "actual_bank_display": money(actual_bank),
        "residual_paise": residual,
        "residual_display": money(residual),
        "adjustment_buckets": buckets,
        "unknown_adjustment_ids": [str(a.get("adjustment_id")) for a in unknown_adjustments],
        "unassigned_transaction_ids": [str(t.get("pg_txn_id")) for t in unassigned_rows],
        "shifted_transactions": [{"pg_txn_id": t["pg_txn_id"], "amount_paise": int(t["gross_paise"]), "amount_display": money(int(t["gross_paise"])), "payout_batch_id": t.get("payout_batch_id"), "source_row_id": t.get("source_row_id")} for t in shifted_rows],
        "issues": issues,
        "snapshot_sha256": snapshot_hash,
        "snapshot_hash_note": "Integrity fingerprint of this canonical demo snapshot; not proof that the original source data is truthful.",
        "merkle_root_sha256": merkle["root_sha256"],
        "merkle_leaf_count": merkle["leaf_count"],
        "merkle_note": "Merkle root verifies that rows have not changed relative to this captured dataset; it does not establish source authenticity or truth.",
        "synthetic_data": True,
    }


def build_evidence_graph(
    transactions: list[dict[str, Any]],
    adjustments: list[dict[str, Any]],
    settlement_batches: list[dict[str, Any]],
    bank_credits: list[dict[str, Any]],
) -> nx.DiGraph:
    graph = nx.DiGraph()
    for batch in settlement_batches:
        bid = str(batch["batch_id"])
        graph.add_node(bid, node_type="settlement_batch", label=bid, details={"payout_utr": batch.get("payout_utr"), "payout_date": batch.get("payout_date"), "source_row_id": batch.get("source_row_id")})
    for txn in transactions:
        tid = str(txn["pg_txn_id"])
        graph.add_node(tid, node_type="payment", label=tid, details={"amount_paise": int(txn["gross_paise"]), "amount_display": money(int(txn["gross_paise"])), "utr_rrn": txn.get("utr_rrn"), "order_id": txn.get("order_id"), "status": txn.get("status"), "source_row_id": txn.get("source_row_id"), "capture_ts": txn.get("capture_ts")})
        bid = txn.get("payout_batch_id")
        settlement_ref = txn.get("settlement_reference")
        if settlement_ref:
            line_id = "SETLINE:" + str(txn.get("source_row_id") or settlement_ref)
            graph.add_node(line_id, node_type="settlement_line", label=str(settlement_ref), details={"settlement_reference": settlement_ref, "source_row_id": txn.get("source_row_id"), "reported_settled_amount_paise": txn.get("settled_amount_paise"), "source_file": txn.get("source_file")})
            graph.add_edge(tid, line_id, relation="HAS_SETTLEMENT_LINE", match_rule="explicit settlement_reference in payment/settlement source row", evidence_ref=txn.get("source_row_id"))
            if bid and str(bid) in graph:
                graph.add_edge(line_id, str(bid), relation="ASSIGNED_TO_PAYOUT_BATCH", match_rule="explicit payout_batch_id in source row; not timestamp inference", evidence_ref=txn.get("source_row_id"))
        elif bid and str(bid) in graph:
            graph.add_edge(tid, str(bid), relation="ASSIGNED_TO_BATCH", match_rule="explicit payout_batch_id in transaction source row", evidence_ref=txn.get("source_row_id"))
    for adj in adjustments:
        aid = str(adj["adjustment_id"])
        graph.add_node(aid, node_type="adjustment", label=aid, details={"type": adj.get("type"), "amount_paise": int(adj["amount_paise"]), "amount_display": money(int(adj["amount_paise"])), "direction": adj.get("direction"), "reference_id": adj.get("reference_id"), "description": adj.get("description"), "source_row_id": adj.get("source_row_id")})
        bid = adj.get("batch_id")
        if bid and str(bid) in graph:
            graph.add_edge(aid, str(bid), relation="BATCH_ADJUSTMENT", match_rule="explicit batch_id in settlement adjustment row", evidence_ref=adj.get("source_row_id"))
    for bank in bank_credits:
        bank_id = str(bank["bank_row_id"])
        graph.add_node(bank_id, node_type="bank_credit", label=bank_id, details={"amount_paise": int(bank["credit_paise"]), "amount_display": money(int(bank["credit_paise"])), "transfer_utr": bank.get("transfer_utr"), "credit_date": bank.get("credit_date"), "source_file": bank.get("source_file")})
        bid = str(bank.get("batch_id", ""))
        batch = next((b for b in settlement_batches if str(b.get("batch_id")) == bid), None)
        # Only connect when both the batch ID and authoritative payout UTR agree.
        if batch and str(batch.get("payout_utr")) == str(bank.get("transfer_utr")) and bid in graph:
            graph.add_edge(bid, bank_id, relation="BANK_CREDIT_FOR_PAYOUT", match_rule="batch_id + payout UTR exact match", evidence_ref=bank.get("bank_row_id"))
    return graph


def trace_evidence(graph: nx.DiGraph, node_id: str) -> dict[str, Any]:
    if node_id not in graph:
        raise KeyError(node_id)
    paths: list[list[str]] = []
    for target in nx.descendants(graph, node_id) | {node_id}:
        if graph.nodes[target].get("node_type") == "bank_credit":
            try:
                paths.append(nx.shortest_path(graph, node_id, target))
            except nx.NetworkXNoPath:
                pass
    if paths:
        path = min(paths, key=len)
    else:
        descendants = nx.descendants(graph, node_id)
        batches = [n for n in descendants if graph.nodes[n].get("node_type") == "settlement_batch"]
        path = [node_id]
        if batches:
            path.append(sorted(batches)[0])
    nodes = [{"id": node, **graph.nodes[node]} for node in path]
    edges = []
    for left, right in zip(path, path[1:]):
        edges.append({"from": left, "to": right, **graph.edges[left, right]})
    return {
        "start_node_id": node_id,
        "path_found": any(graph.nodes[n].get("node_type") == "bank_credit" for n in path),
        "nodes": nodes,
        "edges": edges,
        "message": "Source-linked path found to a bank credit." if path and graph.nodes[path[-1]].get("node_type") == "bank_credit" else "The source is linked to a batch, but no matching bank credit path was established.",
    }
