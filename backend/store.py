"""SQLite persistence for active imports, investigations and audit events.

Local-demo persistence only. The database is not a tamper-proof production ledger.
"""
from __future__ import annotations

import json
import os
import sqlite3
import hashlib
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

DB_PATH = Path(os.getenv("SETTLEGRAPH_DB", Path(__file__).with_name("settlegraph.db")))
AUDIT_GENESIS = "0" * 64


def _connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    return conn


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def init_db() -> None:
    with _connect() as conn:
        conn.execute("""CREATE TABLE IF NOT EXISTS investigations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at TEXT NOT NULL,
            status TEXT NOT NULL,
            residual_paise INTEGER NOT NULL,
            note TEXT NOT NULL,
            source_node_id TEXT,
            snapshot_sha256 TEXT NOT NULL
        )""")
        conn.execute("""CREATE TABLE IF NOT EXISTS audit_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at TEXT NOT NULL,
            actor TEXT NOT NULL,
            event_type TEXT NOT NULL,
            detail TEXT NOT NULL,
            snapshot_sha256 TEXT,
            prev_event_sha256 TEXT,
            event_sha256 TEXT
        )""")
        # Migrate existing local-demo databases without dropping audit history.
        audit_columns = {row[1] for row in conn.execute("PRAGMA table_info(audit_events)").fetchall()}
        if "prev_event_sha256" not in audit_columns:
            conn.execute("ALTER TABLE audit_events ADD COLUMN prev_event_sha256 TEXT")
        if "event_sha256" not in audit_columns:
            conn.execute("ALTER TABLE audit_events ADD COLUMN event_sha256 TEXT")
        legacy_rows = conn.execute("SELECT * FROM audit_events ORDER BY id").fetchall()
        if legacy_rows and any(row["event_sha256"] is None or row["prev_event_sha256"] is None for row in legacy_rows):
            previous = AUDIT_GENESIS
            for row in legacy_rows:
                payload = {
                    "id": int(row["id"]), "created_at": row["created_at"], "actor": row["actor"],
                    "event_type": row["event_type"], "detail": row["detail"],
                    "snapshot_sha256": row["snapshot_sha256"], "prev_event_sha256": previous,
                }
                digest = _audit_digest(payload)
                conn.execute("UPDATE audit_events SET prev_event_sha256=?, event_sha256=? WHERE id=?", (previous, digest, row["id"]))
                previous = digest
        conn.execute("""CREATE TABLE IF NOT EXISTS active_dataset (
            singleton_id INTEGER PRIMARY KEY CHECK(singleton_id = 1),
            saved_at TEXT NOT NULL,
            capture_date TEXT NOT NULL,
            batch_id TEXT NOT NULL,
            source_mode TEXT NOT NULL,
            source_file_sha256 TEXT,
            payload_json TEXT NOT NULL
        )""")
        conn.execute("""CREATE TABLE IF NOT EXISTS staged_paytm_exports (
            stage_id TEXT PRIMARY KEY,
            created_at TEXT NOT NULL,
            source_file TEXT NOT NULL,
            source_file_sha256 TEXT NOT NULL UNIQUE,
            row_count INTEGER NOT NULL,
            capture_date TEXT NOT NULL,
            batch_id TEXT NOT NULL,
            payout_utr TEXT NOT NULL,
            payout_date TEXT NOT NULL,
            mapping_acknowledged INTEGER NOT NULL,
            status TEXT NOT NULL,
            payload_json TEXT NOT NULL
        )""")
        conn.execute("""CREATE TABLE IF NOT EXISTS human_approvals (
            approval_id TEXT PRIMARY KEY,
            idempotency_key TEXT NOT NULL UNIQUE,
            case_id TEXT NOT NULL,
            action_type TEXT NOT NULL,
            amount_paise INTEGER NOT NULL,
            evidence_sha256 TEXT NOT NULL,
            status TEXT NOT NULL,
            requested_by TEXT NOT NULL,
            decided_by TEXT,
            decision_note TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )""")
        conn.execute("""CREATE TABLE IF NOT EXISTS demo_pos_orders (
            order_id TEXT PRIMARY KEY,
            payment_utr TEXT NOT NULL,
            amount_paise INTEGER NOT NULL,
            payment_status TEXT NOT NULL,
            order_status TEXT NOT NULL,
            synced_at TEXT,
            sync_idempotency_key TEXT
        )""")
        conn.execute(
            """INSERT OR IGNORE INTO demo_pos_orders
               (order_id, payment_utr, amount_paise, payment_status, order_status)
               VALUES(?,?,?,?,?)""",
            ("ORD-DEMO-3310", "629899201000", 129900, "SUCCESS", "PAYMENT_PENDING"),
        )


def save_active_dataset(
    dataset: dict[str, list[dict[str, Any]]], capture_date: str,
    batch_id: str, source_mode: str, source_file_sha256: str | None = None,
) -> None:
    payload = json.dumps(dataset, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    with _connect() as conn:
        conn.execute(
            """INSERT INTO active_dataset(singleton_id, saved_at, capture_date, batch_id,
               source_mode, source_file_sha256, payload_json) VALUES(1,?,?,?,?,?,?)
               ON CONFLICT(singleton_id) DO UPDATE SET saved_at=excluded.saved_at,
               capture_date=excluded.capture_date, batch_id=excluded.batch_id,
               source_mode=excluded.source_mode, source_file_sha256=excluded.source_file_sha256,
               payload_json=excluded.payload_json""",
            (_now(), capture_date, batch_id, source_mode, source_file_sha256, payload),
        )


def load_active_dataset() -> dict[str, Any] | None:
    with _connect() as conn:
        row = conn.execute("SELECT * FROM active_dataset WHERE singleton_id=1").fetchone()
    if not row:
        return None
    try:
        payload = json.loads(row["payload_json"])
    except (TypeError, json.JSONDecodeError):
        return None
    required = {"transactions", "adjustments", "settlement_batches", "bank_credits"}
    allowed = required | {"disputes"}
    if not isinstance(payload, dict) or not required.issubset(payload) or not set(payload).issubset(allowed):
        return None
    if not all(isinstance(payload[k], list) for k in payload):
        return None
    # Backward-compatible migration: older local bundles stored the four core
    # reports only. They must not inherit stale dispute fixtures after restart.
    payload.setdefault("disputes", [])
    return {
        "dataset": payload,
        "capture_date": row["capture_date"],
        "batch_id": row["batch_id"],
        "source_mode": row["source_mode"],
        "source_file_sha256": row["source_file_sha256"],
        "saved_at": row["saved_at"],
    }


def clear_active_dataset() -> None:
    with _connect() as conn:
        conn.execute("DELETE FROM active_dataset WHERE singleton_id=1")


def _audit_digest(payload: dict[str, Any]) -> str:
    canonical = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _insert_audit_event(
    conn: sqlite3.Connection, actor: str, event_type: str, detail: str,
    snapshot_sha256: str | None = None,
) -> int:
    previous_row = conn.execute("SELECT event_sha256 FROM audit_events ORDER BY id DESC LIMIT 1").fetchone()
    previous_hash = str(previous_row["event_sha256"]) if previous_row and previous_row["event_sha256"] else AUDIT_GENESIS
    created_at = _now()
    cur = conn.execute(
        "INSERT INTO audit_events(created_at, actor, event_type, detail, snapshot_sha256, prev_event_sha256, event_sha256) VALUES(?,?,?,?,?,?,?)",
        (created_at, actor, event_type, detail, snapshot_sha256, previous_hash, ""),
    )
    event_id = int(cur.lastrowid)
    digest = _audit_digest({
        "id": event_id, "created_at": created_at, "actor": actor, "event_type": event_type,
        "detail": detail, "snapshot_sha256": snapshot_sha256, "prev_event_sha256": previous_hash,
    })
    conn.execute("UPDATE audit_events SET event_sha256=? WHERE id=?", (digest, event_id))
    return event_id


def record_audit(actor: str, event_type: str, detail: str, snapshot_sha256: str | None = None) -> None:
    with _connect() as conn:
        conn.execute("BEGIN IMMEDIATE")
        _insert_audit_event(conn, actor, event_type, detail, snapshot_sha256)


def verify_audit_chain() -> dict[str, Any]:
    with _connect() as conn:
        rows = conn.execute("SELECT * FROM audit_events ORDER BY id").fetchall()
    previous = AUDIT_GENESIS
    for row in rows:
        payload = {
            "id": int(row["id"]), "created_at": row["created_at"], "actor": row["actor"],
            "event_type": row["event_type"], "detail": row["detail"],
            "snapshot_sha256": row["snapshot_sha256"], "prev_event_sha256": row["prev_event_sha256"],
        }
        expected = _audit_digest(payload)
        if row["prev_event_sha256"] != previous or row["event_sha256"] != expected:
            return {"integrity_valid": False, "event_count": len(rows), "first_invalid_event_id": int(row["id"]), "note": "The local hash chain is inconsistent. This detects ordinary in-place edits and interior deletions; tail truncation is not detectable without an externally anchored head, and a local administrator with database access can rewrite the entire chain."}
        previous = str(row["event_sha256"])
    return {"integrity_valid": True, "event_count": len(rows), "first_invalid_event_id": None, "head_sha256": previous, "note": "The local hash chain is internally consistent; an unanchored tail deletion cannot be detected, and this is not a tamper-proof or externally anchored audit ledger."}


def create_investigation(status: str, residual_paise: int, note: str, source_node_id: str | None, snapshot_sha256: str) -> dict[str, Any]:
    now = _now()
    with _connect() as conn:
        cur = conn.execute(
            "INSERT INTO investigations(created_at, status, residual_paise, note, source_node_id, snapshot_sha256) VALUES(?,?,?,?,?,?)",
            (now, status, int(residual_paise), note, source_node_id, snapshot_sha256),
        )
        inv_id = int(cur.lastrowid)
        _insert_audit_event(conn, "DEMO_OPERATOR", "INVESTIGATION_CREATED", f"Investigation {inv_id}: {note}", snapshot_sha256)
    return {"id": inv_id, "created_at": now, "status": status, "residual_paise": int(residual_paise), "note": note, "source_node_id": source_node_id, "snapshot_sha256": snapshot_sha256}


def list_investigations() -> list[dict[str, Any]]:
    with _connect() as conn:
        rows = conn.execute("SELECT * FROM investigations ORDER BY id DESC LIMIT 100").fetchall()
    return [dict(r) for r in rows]


def list_audit_events() -> list[dict[str, Any]]:
    with _connect() as conn:
        rows = conn.execute("SELECT * FROM audit_events ORDER BY id DESC LIMIT 100").fetchall()
    return [dict(r) for r in rows]


# Local proof-of-concept workflows below. These records never call a payment,
# Paytm, NPCI, courier, or merchant POS provider.
def stage_paytm_export(
    *, stage_id: str, source_file: str, source_file_sha256: str, row_count: int,
    capture_date: str, batch_id: str, payout_utr: str, payout_date: str,
    payload: dict[str, Any],
) -> dict[str, Any]:
    now = _now()
    serialized = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    with _connect() as conn:
        conn.execute("BEGIN IMMEDIATE")
        existing = conn.execute(
            "SELECT * FROM staged_paytm_exports WHERE source_file_sha256=?",
            (source_file_sha256,),
        ).fetchone()
        if existing:
            return {key: existing[key] for key in (
                "stage_id", "created_at", "source_file", "source_file_sha256", "row_count",
                "capture_date", "batch_id", "payout_utr", "payout_date", "mapping_acknowledged", "status",
            )} | {"idempotent_replay": True}
        conn.execute(
            """INSERT INTO staged_paytm_exports
               (stage_id,created_at,source_file,source_file_sha256,row_count,capture_date,
                batch_id,payout_utr,payout_date,mapping_acknowledged,status,payload_json)
               VALUES(?,?,?,?,?,?,?,?,?,?,?,?)""",
            (stage_id, now, source_file, source_file_sha256, int(row_count), capture_date,
             batch_id, payout_utr, payout_date, 1, "STAGED_FOR_CANONICAL_RECONCILIATION", serialized),
        )
        _insert_audit_event(
            conn, "DEMO_OPERATOR", "PAYTM_EXPORT_STAGED",
            f"Staged {row_count} Paytm-style rows for batch {batch_id}; manual mapping acknowledged; bank/source completeness still required.",
            source_file_sha256,
        )
        return {
            "stage_id": stage_id, "created_at": now, "source_file": source_file,
            "source_file_sha256": source_file_sha256, "row_count": int(row_count),
            "capture_date": capture_date, "batch_id": batch_id, "payout_utr": payout_utr,
            "payout_date": payout_date, "mapping_acknowledged": True,
            "status": "STAGED_FOR_CANONICAL_RECONCILIATION", "idempotent_replay": False,
        }


def list_staged_paytm_exports() -> list[dict[str, Any]]:
    with _connect() as conn:
        rows = conn.execute(
            """SELECT stage_id,created_at,source_file,source_file_sha256,row_count,capture_date,
                      batch_id,payout_utr,payout_date,mapping_acknowledged,status
               FROM staged_paytm_exports ORDER BY created_at DESC LIMIT 50"""
        ).fetchall()
    return [dict(row) for row in rows]


def create_human_approval(
    *, case_id: str, action_type: str, amount_paise: int, evidence_sha256: str,
    requested_by: str = "DEMO_OPERATOR",
) -> dict[str, Any]:
    """Idempotently stage a proposal. This function cannot execute a refund."""
    canonical = f"{case_id}|{action_type}|{int(amount_paise)}|{evidence_sha256}"
    idem = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    approval_id = "APR-" + idem[:16].upper()
    now = _now()
    with _connect() as conn:
        conn.execute("BEGIN IMMEDIATE")
        existing = conn.execute(
            "SELECT * FROM human_approvals WHERE idempotency_key=?", (idem,)
        ).fetchone()
        if existing:
            return {**dict(existing), "idempotent_replay": True, "external_action_executed": False}
        conn.execute(
            """INSERT INTO human_approvals
               (approval_id,idempotency_key,case_id,action_type,amount_paise,evidence_sha256,
                status,requested_by,created_at,updated_at)
               VALUES(?,?,?,?,?,?,?,?,?,?)""",
            (approval_id, idem, case_id, action_type, int(amount_paise), evidence_sha256,
             "PENDING_HUMAN_APPROVAL", requested_by, now, now),
        )
        _insert_audit_event(
            conn, requested_by, "HUMAN_APPROVAL_STAGED",
            f"{approval_id} staged {action_type} for {case_id}; external execution disabled.",
            evidence_sha256,
        )
        row = conn.execute("SELECT * FROM human_approvals WHERE approval_id=?", (approval_id,)).fetchone()
    return {**dict(row), "idempotent_replay": False, "external_action_executed": False}


def list_human_approvals() -> list[dict[str, Any]]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM human_approvals ORDER BY created_at DESC LIMIT 100"
        ).fetchall()
    return [{**dict(row), "external_action_executed": False} for row in rows]


def decide_human_approval(
    approval_id: str, decision: str, decided_by: str, decision_note: str = "",
) -> dict[str, Any] | None:
    normalized = decision.strip().upper()
    if normalized not in {"APPROVE", "REJECT"}:
        raise ValueError("decision must be APPROVE or REJECT")
    now = _now()
    target = "APPROVED_FOR_MANUAL_HANDOFF" if normalized == "APPROVE" else "REJECTED"
    with _connect() as conn:
        conn.execute("BEGIN IMMEDIATE")
        row = conn.execute("SELECT * FROM human_approvals WHERE approval_id=?", (approval_id,)).fetchone()
        if not row:
            return None
        if row["status"] != "PENDING_HUMAN_APPROVAL":
            return {**dict(row), "decision_replay": True, "external_action_executed": False}
        conn.execute(
            """UPDATE human_approvals SET status=?,decided_by=?,decision_note=?,updated_at=?
               WHERE approval_id=? AND status='PENDING_HUMAN_APPROVAL'""",
            (target, decided_by, decision_note[:500], now, approval_id),
        )
        _insert_audit_event(
            conn, decided_by, "HUMAN_APPROVAL_DECIDED",
            f"{approval_id} {normalized.lower()}d; status={target}; manual handoff only, no money movement.",
            row["evidence_sha256"],
        )
        updated = conn.execute("SELECT * FROM human_approvals WHERE approval_id=?", (approval_id,)).fetchone()
    return {**dict(updated), "decision_replay": False, "external_action_executed": False}


def list_demo_pos_orders() -> list[dict[str, Any]]:
    with _connect() as conn:
        rows = conn.execute("SELECT * FROM demo_pos_orders ORDER BY order_id").fetchall()
    return [dict(row) for row in rows]


def sync_demo_pos_order(order_id: str, idempotency_key: str, evidence_sha256: str) -> dict[str, Any] | None:
    """Idempotent local mock POS sync; does not call a merchant POS API."""
    now = _now()
    with _connect() as conn:
        conn.execute("BEGIN IMMEDIATE")
        row = conn.execute("SELECT * FROM demo_pos_orders WHERE order_id=?", (order_id,)).fetchone()
        if not row:
            return None
        if row["sync_idempotency_key"] == idempotency_key or row["order_status"] == "PAID":
            return {**dict(row), "sync_result": "IDEMPOTENT_NO_OP", "external_pos_called": False}
        if row["payment_status"] != "SUCCESS":
            raise ValueError("Mock order cannot sync without a successful payment record")
        conn.execute(
            """UPDATE demo_pos_orders SET order_status='PAID',synced_at=?,sync_idempotency_key=?
               WHERE order_id=? AND order_status='PAYMENT_PENDING'""",
            (now, idempotency_key, order_id),
        )
        _insert_audit_event(
            conn, "DEMO_OPERATOR", "MOCK_POS_ORDER_SYNCED",
            f"{order_id} changed from PAYMENT_PENDING to PAID using local synthetic payment proof; no external POS API called.",
            evidence_sha256,
        )
        updated = conn.execute("SELECT * FROM demo_pos_orders WHERE order_id=?", (order_id,)).fetchone()
    return {**dict(updated), "sync_result": "MOCK_SYNCED", "external_pos_called": False}
