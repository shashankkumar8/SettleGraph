"""Vendor cash-flow desk: deterministic, source-labelled demo calculations.

All built-in records are synthetic. Statutory workflow dates follow the structure
of MSMED Act 2006 sections 2(b), 15 and 16; eligibility still requires verification
against the supplier's actual Udyam record and supply activity. Interest is only
estimated when an operator explicitly supplies/confirms a bank-rate assumption.
No external message, claim, payment or refund is sent from this module.
"""
from __future__ import annotations

from copy import deepcopy
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

from engine import sha256_json

# RBI's rates page exposed 5.50% as at 10 July 2026 in the source review.
# It is intentionally NOT treated as a live/current rate. The UI requires an
# operator to pass this (or another verified rate) before an estimate is shown.
REFERENCE_BANK_RATE_BPS = 550
REFERENCE_BANK_RATE_AS_OF = "2026-07-10"
INTEREST_MULTIPLIER = 3
STATUTORY_MAX_AGREEMENT_DAYS = 45
NO_AGREEMENT_OBJECTION_WINDOW_DAYS = 15

SYNTHETIC_RECEIVABLES: dict[str, Any] = {
    "vendor": "ABC Manufacturing (synthetic)",
    "supplier": {
        "udyam_registered": True,
        "enterprise_size": "MICRO",
        "activity": "MANUFACTURING",
    },
    "invoice": {
        "id": "INV-1042",
        "amount_paise": 24_000_000,
        "invoice_date": "2026-08-10",
        "po_id": "PO-771",
        "po_amount_paise": 24_000_000,
        "has_written_agreement": True,
        # A lawful baseline of 45 days; the UI can inject a 60-day fault.
        "agreed_due_days": 45,
    },
    "grn": {
        "id": "GRN-5530",
        "delivery_date": "2026-08-14",
        "accepted_paise": 24_000_000,
        "objection_date": None,
        "objection_resolved_date": None,
    },
    "payments": [{"id": "BNK-9001", "date": "2026-09-30", "amount_paise": 21_000_000}],
    "credit_notes": [],
    # Supplier-issued debit notes increase the amount receivable; buyer debit
    # notes/claims reduce it. Keep the direction explicit to avoid sign guessing.
    "supplier_debit_notes": [],
    "buyer_debit_notes": [],
}


def _parse_date(value: str, field: str) -> date:
    try:
        parsed = date.fromisoformat(str(value))
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{field} must be an ISO date (YYYY-MM-DD)") from exc
    return parsed


def _nonnegative_int(value: Any, field: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise ValueError(f"{field} must be a non-negative integer number of paise")
    return value


def _next_month_anniversary(day: date) -> date:
    year = day.year + (1 if day.month == 12 else 0)
    month = 1 if day.month == 12 else day.month + 1
    # Clamp month-end dates (e.g. 31 Jan -> 28/29 Feb).
    import calendar
    return date(year, month, min(day.day, calendar.monthrange(year, month)[1]))


def _interest_monthly_rests_illustration(
    principal_paise: int, start_date: date, as_of: date, annual_rate_bps: int,
    dated_events: list[tuple[date, int]],
) -> int:
    """Illustrative monthly-rest accrual over dated principal movements.

    Positive events increase principal; negative events reduce it. Accrued interest
    is capitalised at monthly anniversaries, and an event on a rest date is applied
    after that rest. This is an explanatory model, not a legal/accounting calculator.
    """
    if principal_paise <= 0 or as_of <= start_date or annual_rate_bps <= 0:
        return 0
    rate = Decimal(annual_rate_bps) / Decimal(10_000)
    balance = Decimal(principal_paise)
    accrued = Decimal(0)
    cursor = start_date
    grouped: dict[date, int] = {}
    for event_date, signed_amount in dated_events:
        if start_date <= event_date <= as_of:
            grouped[event_date] = grouped.get(event_date, 0) + int(signed_amount)
    # Events on the first interest day are treated as effective before that day's accrual.
    if start_date in grouped:
        balance = max(balance + Decimal(grouped.pop(start_date)), Decimal(0))
    next_rest = _next_month_anniversary(start_date)
    while cursor < as_of:
        future_events = [event_day for event_day in grouped if event_day > cursor]
        next_event = min(future_events) if future_events else as_of
        boundary = min(next_rest, next_event, as_of)
        days = (boundary - cursor).days
        if days > 0 and balance > 0:
            accrued += balance * rate * Decimal(days) / Decimal(365)
        cursor = boundary
        if cursor == next_rest:
            balance += accrued.quantize(Decimal("1"), rounding=ROUND_HALF_UP)
            accrued = Decimal(0)
            next_rest = _next_month_anniversary(next_rest)
        if cursor in grouped:
            # Principal events are applied to the accrued balance on their recorded date.
            balance += accrued.quantize(Decimal("1"), rounding=ROUND_HALF_UP)
            accrued = Decimal(0)
            balance = max(balance + Decimal(grouped.pop(cursor)), Decimal(0))
    ending_balance = balance + accrued
    net_principal_after_events = Decimal(principal_paise + sum(
        amount for event_day, amount in dated_events if start_date <= event_day <= as_of
    ))
    return max(int((ending_balance - net_principal_after_events).quantize(Decimal("1"), rounding=ROUND_HALF_UP)), 0)


def _acceptance_date(grn: dict[str, Any] | None, as_of_day: date) -> tuple[date | None, list[str]]:
    if not grn:
        return None, ["GRN_MISSING: delivery/acceptance evidence is not supplied"]
    delivery_raw = grn.get("delivery_date") or grn.get("accepted_date")
    if not delivery_raw:
        return None, ["DELIVERY_DATE_MISSING: statutory acceptance date cannot be derived"]
    delivery = _parse_date(delivery_raw, "grn.delivery_date")
    objection_raw = grn.get("objection_date")
    resolved_raw = grn.get("objection_resolved_date")
    if not objection_raw:
        return delivery, []
    objection = _parse_date(objection_raw, "grn.objection_date")
    if objection < delivery:
        raise ValueError("grn.objection_date cannot precede delivery_date")
    # The selected as-of snapshot must not be changed by an objection that had
    # not yet happened on that date.
    if objection > as_of_day:
        return delivery, []
    if objection <= delivery + timedelta(days=NO_AGREEMENT_OBJECTION_WINDOW_DAYS):
        if not resolved_raw:
            return None, ["BUYER_OBJECTION_UNRESOLVED: written objection within 15 days; acceptance date awaits resolution"]
        resolved = _parse_date(resolved_raw, "grn.objection_resolved_date")
        if resolved < objection:
            raise ValueError("grn.objection_resolved_date cannot precede objection_date")
        if resolved > as_of_day:
            return None, ["BUYER_OBJECTION_UNRESOLVED_AS_OF_DATE: resolution occurred after the selected as-of date"]
        return resolved, []
    # Objection made after the statutory 15-day window does not move the
    # acceptance date under the Act's deemed-acceptance definition.
    return delivery, ["LATE_BUYER_OBJECTION: does not defer deemed acceptance in this model; legal review advised"]


def evaluate_receivable(
    data: dict[str, Any] | None = None,
    as_of: str | None = None,
    toggles: dict[str, bool] | None = None,
    *,
    bank_rate_bps: int | None = None,
) -> dict[str, Any]:
    """Evaluate a synthetic PO/GRN/invoice/payment trail in integer paise.

    MSMED Section 15/16 timeline is shown only when the supplier is recorded as
    Udyam-registered Micro/Small and manufacturing/service. Eligibility and the
    source documents are not independently authenticated by this local demo.
    """
    d = deepcopy(data if data is not None else SYNTHETIC_RECEIVABLES)
    t = toggles or {}
    as_of_day = _parse_date(as_of or date.today().isoformat(), "as_of")
    supplier = d.get("supplier") or {}
    invoice = d.get("invoice") or {}
    grn = deepcopy(d.get("grn"))
    flags: list[str] = []

    if t.get("remove_grn"):
        grn = None
    if t.get("short_grn") and grn is not None:
        grn["accepted_paise"] = max(int(grn.get("accepted_paise") or 0) - 1_500_000, 0)
    if t.get("inflate_invoice"):
        invoice["amount_paise"] = int(invoice.get("amount_paise") or 0) + 500_000
    if t.get("add_credit_note"):
        d.setdefault("credit_notes", []).append({"id": "CN-DEMO-77", "amount_paise": 1_000_000, "reason": "synthetic quality rebate"})
    if t.get("extend_agreement_over_45"):
        invoice["has_written_agreement"] = True
        invoice["agreed_due_days"] = 60

    invoice_amount = _nonnegative_int(invoice.get("amount_paise"), "invoice.amount_paise")
    po_amount = _nonnegative_int(invoice.get("po_amount_paise", invoice_amount), "invoice.po_amount_paise")
    dated_events: list[tuple[date, int]] = []
    event_dates_complete = True

    def collect_events(rows: list[dict[str, Any]], amount_field: str, event_name: str, sign: int) -> int:
        nonlocal event_dates_complete
        total = 0
        for row in rows:
            amount = _nonnegative_int(row.get(amount_field), f"{event_name}.amount_paise")
            raw_date = row.get("date") or row.get("payment_date") or row.get("note_date")
            if not raw_date:
                event_dates_complete = False
                flags.append(f"{event_name.upper()}_DATE_MISSING: this row is not included in the as-of balance")
                continue
            event_date = _parse_date(raw_date, f"{event_name}.date")
            if event_date <= as_of_day:
                total += amount
                dated_events.append((event_date, sign * amount))
        return total

    received = collect_events(d.get("payments", []), "amount_paise", "payment", -1)
    credit_notes = collect_events(d.get("credit_notes", []), "amount_paise", "credit_note", -1)
    supplier_debits = collect_events(d.get("supplier_debit_notes", []), "amount_paise", "supplier_debit_note", 1)
    buyer_debits = collect_events(d.get("buyer_debit_notes", []), "amount_paise", "buyer_debit_note", -1)
    outstanding = invoice_amount + supplier_debits - received - credit_notes - buyer_debits

    if invoice_amount != po_amount:
        flags.append("INVOICE_PO_MISMATCH: invoice amount differs from the recorded purchase order")
    if grn is None:
        flags.append("GRN_MISSING: no goods-receipt evidence; follow-up pack is locked")
    else:
        grn_accepted = _nonnegative_int(grn.get("accepted_paise"), "grn.accepted_paise")
        if grn_accepted != invoice_amount:
            flags.append("GRN_VALUE_MISMATCH: accepted goods value differs from invoice value")

    acceptance, acceptance_flags = _acceptance_date(grn, as_of_day)
    flags.extend(acceptance_flags)

    enterprise_size = str(supplier.get("enterprise_size") or "").strip().upper()
    activity = str(supplier.get("activity") or "").strip().upper()
    if activity in {"SERVICE", "SERVICES"}:
        activity = "SERVICES"
    if not supplier.get("udyam_registered"):
        eligibility_note = "Udyam registration is not recorded; MSMED delayed-payment treatment is not enabled."
    elif enterprise_size not in {"MICRO", "SMALL"}:
        eligibility_note = "The recorded enterprise size is not Micro or Small; this model does not apply the MSE delayed-payment workflow."
    elif activity not in {"MANUFACTURING", "SERVICES"}:
        eligibility_note = "The recorded activity is not manufacturing/services; eligibility must be reviewed and is not assumed."
    else:
        eligibility_note = "Recorded as Udyam Micro/Small manufacturing/service; actual registration, activity and supply-date eligibility still require verification."
    eligible = bool(supplier.get("udyam_registered")) and enterprise_size in {"MICRO", "SMALL"} and activity in {"MANUFACTURING", "SERVICES"}

    statutory: dict[str, Any] | None = None
    if not eligible:
        flags.append("MSMED_ELIGIBILITY_NOT_ESTABLISHED: verify supplier category, activity and registration before applying Sections 15/16")
    elif acceptance is None:
        flags.append("ACCEPTANCE_DATE_UNRESOLVED: statutory timeline cannot be calculated yet")
    else:
        has_agreement = bool(invoice.get("has_written_agreement"))
        agreed_days = int(invoice.get("agreed_due_days") or 0)
        if has_agreement:
            if agreed_days < 0:
                raise ValueError("invoice.agreed_due_days cannot be negative")
            if agreed_days > STATUTORY_MAX_AGREEMENT_DAYS:
                flags.append("AGREED_PERIOD_EXCEEDS_45_DAYS: Section 15 does not permit a written payment period beyond 45 days from acceptance")
            effective_days = min(agreed_days, STATUTORY_MAX_AGREEMENT_DAYS)
            due_date = acceptance + timedelta(days=effective_days)
            interest_start = due_date + timedelta(days=1)
            appointed_day = None
            timeline_rule = "WRITTEN_AGREEMENT_CAPPED_AT_45_DAYS"
        else:
            appointed_day = acceptance + timedelta(days=NO_AGREEMENT_OBJECTION_WINDOW_DAYS + 1)
            due_date = appointed_day - timedelta(days=1)
            interest_start = appointed_day
            timeline_rule = "NO_WRITTEN_AGREEMENT_APPOINTED_DAY"

        overdue_days = max((as_of_day - due_date).days, 0)
        interest_days = max((as_of_day - interest_start).days, 0)
        indicative_interest: int | None = None
        annual_rate_bps: int | None = None
        interest_mode = "NOT_CALCULATED_OPERATOR_RATE_CONFIRMATION_REQUIRED"
        interest_notes_have_dates = event_dates_complete
        if bank_rate_bps is not None:
            rate = _nonnegative_int(bank_rate_bps, "bank_rate_bps")
            if rate <= 0 or rate > 3_000:
                raise ValueError("bank_rate_bps must be between 1 and 3000 basis points")
            annual_rate_bps = rate * INTEREST_MULTIPLIER
            if not interest_notes_have_dates:
                interest_mode = "NOT_CALCULATED_SOURCE_EVENT_DATE_MISSING"
            else:
                principal_at_interest_start = invoice_amount
                for event_day, signed_amount in dated_events:
                    if event_day < interest_start:
                        principal_at_interest_start += signed_amount
                principal_at_interest_start = max(principal_at_interest_start, 0)
                indicative_interest = _interest_monthly_rests_illustration(
                    principal_at_interest_start, interest_start, as_of_day, annual_rate_bps, dated_events,
                )
                interest_mode = "ILLUSTRATIVE_DATED_CASHFLOW_MONTHLY_REST_ESTIMATE_OPERATOR_RATE_CONFIRMED"
        statutory = {
            "eligible_by_recorded_fields": True,
            "eligibility_note": eligibility_note,
            "acceptance_date": acceptance.isoformat(),
            "timeline_rule": timeline_rule,
            "statutory_due_date": due_date.isoformat(),
            "appointed_day": appointed_day.isoformat() if appointed_day else None,
            "interest_start_date": interest_start.isoformat(),
            "overdue_days": overdue_days,
            "interest_days": interest_days,
            "bank_rate_bps": bank_rate_bps,
            "bank_rate_source": "OPERATOR_SUPPLIED_NOT_AUTO_VERIFIED" if bank_rate_bps is not None else None,
            "reference_bank_rate_bps": REFERENCE_BANK_RATE_BPS,
            "reference_bank_rate_as_of": REFERENCE_BANK_RATE_AS_OF,
            "annual_interest_rate_bps": annual_rate_bps,
            "indicative_interest_paise": indicative_interest,
            "interest_mode": interest_mode,
            "note": (
                "Interest is an illustration, not a legal/accounting determination. Dated principal receipts/notes are applied to the balance and interest is capitalised at monthly anniversaries. "
                "The bank rate is a single operator-supplied input; rate changes over the full period, payment appropriation, exact conventions, eligibility and evidence must be verified."
                if bank_rate_bps is not None else
                "Due date and overdue days are shown from the recorded acceptance evidence. Interest is withheld until an operator supplies a verified RBI bank-rate input and all principal-changing source rows have dates."
            ),
        }

    if outstanding < 0:
        flags.append("CREDIT_BALANCE: recorded credits/notes exceed invoice plus supplier debit notes; review source directions")

    if outstanding <= 0:
        status = "PAID_IN_FULL" if outstanding == 0 else "CREDIT_BALANCE_REVIEW"
    elif received + credit_notes + buyer_debits > 0:
        status = "PARTIALLY_PAID"
    else:
        status = "UNPAID"

    if flags and outstanding > 0:
        action = "RESOLVE_EVIDENCE_OR_ELIGIBILITY_BEFORE_FOLLOW_UP"
    elif outstanding > 0:
        action = "REQUEST_PAYMENT_CLARIFICATION"
    else:
        action = "NONE"
    unexplained = max(outstanding, 0) if not credit_notes and not buyer_debits and not supplier_debits else 0

    result: dict[str, Any] = {
        "vendor": str(d.get("vendor") or "Unlabelled supplier"),
        "invoice_id": str(invoice.get("id") or "UNKNOWN_INVOICE"),
        "invoice_paise": invoice_amount,
        "received_paise": received,
        "credit_notes_paise": credit_notes,
        "supplier_debit_notes_paise": supplier_debits,
        "buyer_debit_notes_paise": buyer_debits,
        "outstanding_paise": outstanding,
        "unexplained_paise": unexplained,
        "goods_received": grn is not None,
        "payment_status": status,
        "flags": flags,
        "statutory": statutory,
        "eligibility_note": eligibility_note,
        "recommended_action": action,
        "follow_up_pack_allowed": not flags and outstanding > 0,
        "as_of": as_of_day.isoformat(),
        "synthetic_data": True,
    }
    result["evidence_sha256"] = sha256_json({
        "inputs": d, "toggles": t, "as_of": as_of_day.isoformat(),
        "bank_rate_bps": bank_rate_bps,
        "policy": {"max_agreement_days": STATUTORY_MAX_AGREEMENT_DAYS,
                   "objection_window_days": NO_AGREEMENT_OBJECTION_WINDOW_DAYS,
                   "interest_multiplier": INTEREST_MULTIPLIER},
    })
    return result


# --- Duplicate capture detector ---------------------------------------------
SYNTHETIC_ATTEMPTS = [
    {"order_id": "ORD-5512", "order_amount_paise": 120_000, "captured_paise": 120_000, "txn_id": "PG-A1", "status": "SUCCESS", "reversed": False},
    {"order_id": "ORD-5512", "order_amount_paise": 120_000, "captured_paise": 120_000, "txn_id": "PG-A2", "status": "SUCCESS", "reversed": False},
    {"order_id": "ORD-5600", "order_amount_paise": 50_000, "captured_paise": 50_000, "txn_id": "PG-B1", "status": "SUCCESS", "reversed": False},
    {"order_id": "ORD-5601", "order_amount_paise": 75_000, "captured_paise": 75_000, "txn_id": "PG-C1", "status": "SUCCESS", "reversed": False},
    {"order_id": "ORD-5601", "order_amount_paise": 75_000, "captured_paise": 75_000, "txn_id": "PG-C2", "status": "SUCCESS", "reversed": True},
]


def detect_duplicates(attempts: list[dict[str, Any]] | None = None) -> list[dict[str, Any]]:
    """Find over-captured orders; reject inconsistent or duplicated source IDs."""
    source = SYNTHETIC_ATTEMPTS if attempts is None else attempts
    by_order: dict[str, list[dict[str, Any]]] = {}
    seen_txn: set[str] = set()
    for row in source:
        order_id = str(row.get("order_id") or "").strip()
        txn_id = str(row.get("txn_id") or "").strip()
        if not order_id or not txn_id or txn_id in seen_txn:
            continue
        seen_txn.add(txn_id)
        by_order.setdefault(order_id, []).append(row)

    found: list[dict[str, Any]] = []
    for order_id, rows in sorted(by_order.items()):
        amounts = {row.get("order_amount_paise") for row in rows}
        if len(amounts) != 1 or None in amounts:
            continue
        order_amount = _nonnegative_int(next(iter(amounts)), "order_amount_paise")
        live = [row for row in rows if str(row.get("status", "")).upper() in {"SUCCESS", "DEEMED_SUCCESS"} and not row.get("reversed")]
        if len(live) < 2:
            continue
        captured = sum(_nonnegative_int(row.get("captured_paise"), "captured_paise") for row in live)
        over = captured - order_amount
        if over <= 0:
            continue
        found.append({
            "order_id": order_id,
            "order_amount_paise": order_amount,
            "captured_paise": captured,
            "overpayment_paise": over,
            "txn_ids": [str(row["txn_id"]) for row in live],
            "evidence_sha256": sha256_json({"order": order_id, "attempts": live}),
            "next_step": "STAGE_REFUND_FOR_HUMAN_APPROVAL",
            "synthetic_data": attempts is None,
        })
    return found


# --- Exception inbox ---------------------------------------------------------
_PRIORITY = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}


def build_exception_inbox(residual_paise: int, receivable: dict[str, Any],
                          duplicates: list[dict[str, Any]], pending_approvals: int) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    if residual_paise != 0:
        items.append({"id": "EX-SETTLE", "kind": "UNMATCHED_SETTLEMENT", "priority": "HIGH",
                      "amount_paise": abs(int(residual_paise)), "action": "Check batch/payout UTR references and source statement"})
    for duplicate in duplicates:
        items.append({"id": f"EX-DUP-{duplicate.get('candidate_id', duplicate['order_id'])}", "kind": "DUPLICATE_PAYMENT", "priority": "HIGH",
                      "amount_paise": duplicate.get("candidate_amount_paise", duplicate.get("overpayment_paise", 0)), "action": "Verify order total and stage a human review"})
    if receivable["outstanding_paise"] > 0:
        overdue = (receivable.get("statutory") or {}).get("overdue_days", 0)
        items.append({"id": f"EX-RCV-{receivable['invoice_id']}", "kind": "VENDOR_INVOICE_SHORT_PAID",
                      "priority": "HIGH" if overdue > 0 else "MEDIUM",
                      "amount_paise": receivable["outstanding_paise"], "action": receivable["recommended_action"]})
    if pending_approvals:
        items.append({"id": "EX-APPROVALS", "kind": "APPROVALS_WAITING", "priority": "MEDIUM",
                      "amount_paise": 0, "action": f"{pending_approvals} human decision(s) pending"})
    return sorted(items, key=lambda item: (_PRIORITY[item["priority"]], -item["amount_paise"]))


# --- Scenario: Kirana payout (synthetic) -------------------------------------
KIRANA = {"gross_paise": 8_000_000, "bank_paise": 7_650_000, "items": [
    {"kind": "REFUND", "paise": 120_000, "ref": "RF-221", "documented": True},
    {"kind": "DEVICE_SUBSCRIPTION", "paise": 15_000, "ref": "RENT-10", "documented": True},
    {"kind": "COMMISSION_GST", "paise": 35_000, "ref": "FEE-10", "documented": True},
    {"kind": "CHARGEBACK", "paise": 80_000, "ref": "CB-77", "documented": True},
]}


def kirana_payout(data: dict[str, Any] | None = None) -> dict[str, Any]:
    d = deepcopy(KIRANA if data is None else data)
    gross = _nonnegative_int(d.get("gross_paise"), "gross_paise")
    bank = _nonnegative_int(d.get("bank_paise"), "bank_paise")
    items = d.get("items", [])
    explained = sum(_nonnegative_int(i.get("paise"), "item.paise") for i in items if i.get("documented") is True)
    gap = gross - bank
    unmatched = gap - explained
    if unmatched == 0:
        status = "RECONCILED"
    elif unmatched > 0:
        status = "NEEDS_INVESTIGATION"
    else:
        status = "EVIDENCE_EXCEEDS_PAYOUT_GAP"
    return {"gross_paise": gross, "bank_paise": bank, "gap_paise": gap,
            "explained_paise": explained, "unmatched_paise": unmatched, "items": items,
            "status": status,
            "next_step": None if unmatched == 0 else "Check source references; do not auto-label unexplained amounts",
            "synthetic_data": data is None}


# --- RBI failed-transaction TAT scenarios -----------------------------------
TAT_RULES = {
    "UPI_P2M_CONFIRMATION_MISSING": {
        "days": 5,
        "description": "Customer debited; transaction confirmation not received at merchant location (UPI payment to merchant)",
        "deadline_action": "Acquirer to initiate credit adjustment",
    },
    "UPI_P2P_BENEFICIARY_NOT_CREDITED": {
        "days": 1,
        "description": "Customer debited; beneficiary account not credited (UPI fund transfer)",
        "deadline_action": "Beneficiary bank to auto-reverse if beneficiary cannot be credited",
    },
}


def tat_check(
    transaction_date: str,
    as_of: str | None = None,
    reversed_: bool = False,
    *,
    transaction_type: str = "UPI_P2M_CONFIRMATION_MISSING",
    reversal_date: str | None = None,
) -> dict[str, Any]:
    """RBI 2019 failed-transaction TAT illustration for two precise UPI categories."""
    kind = transaction_type.strip().upper()
    if kind not in TAT_RULES:
        raise ValueError(f"unsupported transaction_type: {transaction_type}")
    txn = _parse_date(transaction_date, "transaction_date")
    today = _parse_date(as_of or date.today().isoformat(), "as_of")
    due = txn + timedelta(days=TAT_RULES[kind]["days"])
    if reversed_ and reversal_date is None:
        # Compatibility: old demo flag means the reversal happened on the due day.
        reversal = due
    elif reversal_date:
        reversal = _parse_date(reversal_date, "reversal_date")
        if reversal < txn:
            raise ValueError("reversal_date cannot precede transaction_date")
        if reversal > today:
            raise ValueError("reversal_date cannot be after the evaluation as_of date")
    else:
        reversal = None
    evaluation_end = reversal if reversal is not None else today
    days_late = max((evaluation_end - due).days, 0)
    compensation = days_late * 10_000  # ₹100.00/day = 10,000 paise/day
    if reversal is None and today > due:
        state = "REVERSAL_PENDING_POTENTIAL_COMPENSATION"
    elif reversal is not None and days_late > 0:
        state = "REVERSED_LATE_COMPENSATION_APPLICABLE"
    elif reversal is not None:
        state = "REVERSED_WITHIN_TAT"
    else:
        state = "WITHIN_TAT"
    return {
        "transaction_date": txn.isoformat(), "transaction_type": kind,
        "transaction_description": TAT_RULES[kind]["description"],
        "deadline_action": TAT_RULES[kind]["deadline_action"],
        "tat_days": TAT_RULES[kind]["days"], "auto_reversal_due": due.isoformat(),
        "reversal_date": reversal.isoformat() if reversal else None,
        "reversed": reversal is not None, "as_of": today.isoformat(),
        "days_late": days_late, "compensation_paise": compensation,
        "compensation_status": state,
        "scope_note": "RBI DPSS.CO.PD No.629/02.01.014/2019-20 (20 Sep 2019), specified UPI failure category only. This local date calculation does not verify that the underlying transaction meets the circular's failed-transaction conditions or that compensation was paid.",
        "synthetic_data": True,
    }


# --- Small deterministic Hinglish intent router ------------------------------
def answer_query(text: str, snapshot: dict[str, Any]) -> dict[str, Any]:
    q = text.strip().lower()
    if not q:
        return {"intent": "UNKNOWN", "reply_hi": "Kripya apna sawaal type karein.", "paise": None, "source": "deterministic_local_router"}
    has = lambda *words: any(word in q for word in words)
    if has("pending", "baaki", "बाकी", "outstanding", "vendor", "invoice"):
        intent, paise = "VENDOR_OUTSTANDING", int(snapshot["outstanding_paise"])
    elif has("duplicate", "double", "dobara", "दो बार", "overpaid"):
        intent, paise = "DUPLICATE_OVERPAID", int(snapshot["duplicate_paise"])
    elif has("payout", "settlement", "kam", "कम", "gap"):
        intent, paise = "PAYOUT_GAP", int(snapshot["gap_paise"])
    else:
        return {"intent": "UNKNOWN", "reply_hi": "Maaf kijiye, yeh sawaal samajh nahi aaya. Aap pending invoice, duplicate payment ya payout gap pooch sakte hain.", "paise": None, "source": "deterministic_local_router"}
    sign = "−" if paise < 0 else ""
    amount = abs(paise)
    rupees = f"{sign}₹{amount // 100:,}.{amount % 100:02d}"
    label = {"VENDOR_OUTSTANDING": "vendor ka baaki", "DUPLICATE_OVERPAID": "double payment ka extra", "PAYOUT_GAP": "payout ka antar"}[intent]
    return {"intent": intent, "paise": paise, "reply_hi": f"Aapka {label} {rupees} hai.",
            "source": "computed_from_local_ledger_not_ai", "synthetic_data": True}
