"""Four-exhibit PDF compiler for SettleGraph's local evidence packet.

The packet is an operator evidence summary, not a statutory/legal filing and not
proof that a source record is authentic. Missing evidence is explicitly identified.
"""
from __future__ import annotations

import io
import os
from html import escape
from typing import Any

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def _register_devanagari_font() -> str | None:
    candidates = [
        os.getenv("SETTLEGRAPH_DEVANAGARI_FONT", ""),
        "/usr/share/fonts/truetype/noto/NotoSerifDevanagari-Regular.ttf",
        "/usr/share/fonts/truetype/noto/NotoSerifDevanagari-Light.ttf",
        r"C:\\Windows\\Fonts\\Nirmala.ttf",
        r"C:\\Windows\\Fonts\\NirmalaS.ttf",
        r"C:\\Windows\\Fonts\\mangal.ttf",
    ]
    for path in candidates:
        if path and os.path.isfile(path):
            try:
                if "SettleGraphDevanagari" not in pdfmetrics.getRegisteredFontNames():
                    pdfmetrics.registerFont(TTFont("SettleGraphDevanagari", path, shapable=True))
                return "SettleGraphDevanagari"
            except Exception:
                continue
    return None


def _safe_text(value: Any) -> str:
    if value is None or value == "":
        return "—"
    return escape(str(value)).replace("\n", "<br/>")


def _money(paise: int) -> str:
    sign = "-" if int(paise) < 0 else ""
    amount = abs(int(paise))
    return f"{sign}₹{amount // 100:,}.{amount % 100:02d}"


def compile_four_exhibit_pdf(
    reconciliation: dict[str, Any],
    transactions: list[dict[str, Any]],
    adjustments: list[dict[str, Any]],
    settlement_batches: list[dict[str, Any]],
    bank_credits: list[dict[str, Any]],
    *,
    dispute_case: dict[str, Any] | None = None,
    voice_transcript: str | None = None,
    voice_language_code: str | None = None,
) -> bytes:
    """Create a four-section PDF whose claims are limited to the supplied records."""
    voice_transcript = (voice_transcript or "").strip()[:2500]
    dev_font = _register_devanagari_font()
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="SGTitle", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=17, leading=21, textColor=colors.HexColor("#14263b"), spaceAfter=6))
    styles.add(ParagraphStyle(name="SGSubtitle", parent=styles["Normal"], fontName="Helvetica", fontSize=8, leading=11, textColor=colors.HexColor("#53677d"), spaceAfter=10))
    styles.add(ParagraphStyle(name="SGHeading", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=12, leading=15, textColor=colors.HexColor("#173a5d"), spaceBefore=3, spaceAfter=8))
    styles.add(ParagraphStyle(name="SGBody", parent=styles["BodyText"], fontName="Helvetica", fontSize=8.2, leading=11, textColor=colors.HexColor("#26384b"), spaceAfter=5))
    styles.add(ParagraphStyle(name="SGSmall", parent=styles["BodyText"], fontName="Helvetica", fontSize=7, leading=9, textColor=colors.HexColor("#526579")))
    styles.add(ParagraphStyle(name="SGHindi", parent=styles["BodyText"], fontName=dev_font or "Helvetica", fontSize=9, leading=14, textColor=colors.HexColor("#172d42"), wordWrap="CJK"))

    def para(text: Any, style: str = "SGBody") -> Paragraph:
        return Paragraph(_safe_text(text), styles[style])

    def table(rows: list[list[Any]], widths: list[float] | None = None) -> Table:
        converted = [[cell if isinstance(cell, Paragraph) else para(cell, "SGSmall") for cell in row] for row in rows]
        result = Table(converted, colWidths=widths, repeatRows=1, hAlign="LEFT")
        result.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e8eff6")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#173a5d")),
            ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#d7e0e9")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        return result

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=16 * mm, leftMargin=16 * mm, topMargin=16 * mm, bottomMargin=17 * mm, title="SettleGraph Four-Exhibit Evidence Packet", author="SettleGraph local prototype")
    story: list[Any] = []
    mode = "SYNTHETIC FIXTURE" if reconciliation.get("synthetic_data", True) else "LOCAL IMPORT"
    common = f"SETTLEGRAPH · {mode} · Capture date {reconciliation.get('target_capture_date', '—')} · Batch {reconciliation.get('target_batch_id', '—')}"

    # EXHIBIT A — deterministic financial computation.
    story += [para("SETTLEGRAPH — FOUR-EXHIBIT EVIDENCE PACKET", "SGTitle"), para(common, "SGSubtitle"), para("EXHIBIT A — PAYOUT RECONCILIATION", "SGHeading"), para("This exhibit reproduces the deterministic integer-paise computation over the currently loaded source rows. Batch membership is taken from explicit source references; timestamps do not assign transactions to a payout batch.")]
    summary_rows = [
        ["Field", "Computed value"],
        ["Reconciliation status", reconciliation.get("status")],
        ["Gross captured on date", reconciliation.get("gross_captured_display")],
        ["Amount explicitly assigned to selected batch", reconciliation.get("current_batch_gross_display")],
        ["Known amount assigned to other batch(es)", reconciliation.get("known_other_batch_amount_display")],
        ["Source-recorded adjustments", reconciliation.get("total_adjustments_display")],
        ["Expected payout", reconciliation.get("expected_net_display")],
        ["Matched bank credit(s)", reconciliation.get("actual_bank_display")],
        ["Residual (expected minus bank)", reconciliation.get("residual_display")],
        ["Source snapshot SHA-256", reconciliation.get("snapshot_sha256")],
        ["Merkle root SHA-256", reconciliation.get("merkle_root_sha256")],
        ["Merkle source row count", reconciliation.get("merkle_leaf_count")],
    ]
    cutoff = reconciliation.get("cutoff_analysis") or {}
    summary_rows += [
        ["Capture / nodal event pairs", f"{cutoff.get('matched_count', 0)} / {cutoff.get('capture_event_count', 0)}" if cutoff.get("available") else "Nodal event evidence unavailable"],
        ["Cross-date event count", cutoff.get("cross_midnight_count", 0)],
        ["Cross-date amount", _money(int(cutoff.get("cross_midnight_amount_paise", 0)))],
        ["Unmatched / ambiguous event IDs", f"{len(cutoff.get('unmatched_capture_ids', []))} / {len(cutoff.get('ambiguous_capture_ids', []))}"],
    ]
    story += [table(summary_rows, [70 * mm, 108 * mm]), Spacer(1, 8)]
    buckets = [["Adjustment category", "Amount", "Classification"]]
    for item in reconciliation.get("adjustment_buckets", []):
        buckets.append([item.get("type"), item.get("amount_display"), "Known" if item.get("known_category") else "Needs review"])
    if len(buckets) > 1:
        story += [para("Adjustment breakdown", "SGHeading"), table(buckets, [75 * mm, 45 * mm, 58 * mm])]
    if reconciliation.get("issues"):
        story += [para("Open reconciliation issues", "SGHeading"), para("; ".join(reconciliation["issues"][:12]))]
    story += [para("Integrity note: hashes detect changes relative to this captured dataset. They do not establish source authenticity, source completeness or legal truth.", "SGSmall"), PageBreak()]

    # EXHIBIT B — bank and UTR/reference matching.
    story += [para("EXHIBIT B — UTR, SETTLEMENT AND BANK EVIDENCE", "SGTitle"), para(common, "SGSubtitle")]
    batch = next((row for row in settlement_batches if str(row.get("batch_id")) == str(reconciliation.get("target_batch_id"))), None)
    story += [para("Selected payout reference", "SGHeading"), table([
        ["Source field", "Recorded value"],
        ["Batch ID", batch.get("batch_id") if batch else "Not found"],
        ["Payout UTR", batch.get("payout_utr") if batch else "Not supplied"],
        ["Payout date", batch.get("payout_date") if batch else "Not supplied"],
        ["Batch source row", batch.get("source_row_id") if batch else "Not supplied"],
    ], [60 * mm, 118 * mm]), Spacer(1, 8)]
    matching_banks = [row for row in bank_credits if batch and row.get("batch_id") == batch.get("batch_id") and row.get("transfer_utr") == batch.get("payout_utr")]
    bank_rows = [["Bank row", "Transfer UTR", "Credit", "Credit date", "Source file"]]
    for row in matching_banks[:8]:
        bank_rows.append([row.get("bank_row_id"), row.get("transfer_utr"), _money(int(row.get("credit_paise", 0))), row.get("credit_date"), row.get("source_file")])
    if len(bank_rows) == 1:
        bank_rows.append(["No exact batch + payout UTR match", "—", "—", "—", "—"])
    story += [para("Bank credits matched by exact batch ID + payout UTR", "SGHeading"), table(bank_rows, [34 * mm, 43 * mm, 30 * mm, 30 * mm, 41 * mm]), Spacer(1, 8)]
    tx_rows = [["Transaction ID", "UTR/RRN", "Gross amount", "Batch reference", "Source row"]]
    selected_tx = [row for row in transactions if row.get("payout_batch_id") == reconciliation.get("target_batch_id")]
    for row in selected_tx[:10]:
        tx_rows.append([row.get("pg_txn_id"), row.get("utr_rrn") or "Not supplied", _money(int(row.get("gross_paise", 0))), row.get("payout_batch_id"), row.get("source_row_id")])
    if len(tx_rows) == 1:
        tx_rows.append(["No transaction assigned to this batch", "—", "—", "—", "—"])
    story += [para(f"Payment source rows assigned to this batch ({len(selected_tx)} total; first 10 shown)", "SGHeading"), table(tx_rows, [34 * mm, 39 * mm, 30 * mm, 40 * mm, 35 * mm]), para("A missing or unmatched UTR in local data is an unresolved reference; it is not a fraud verdict. UTR/RRN matches shown here are limited to the uploaded or synthetic records.", "SGSmall"), PageBreak()]

    # EXHIBIT C — invoice/order/fulfilment evidence or explicit absence.
    story += [para("EXHIBIT C — ORDER, INVOICE AND DISPUTE EVIDENCE", "SGTitle"), para(common, "SGSubtitle")]
    if dispute_case:
        case_rows = [["Field", "Recorded value"]]
        preferred = ["case_id", "disputed_paise", "utr_rrn", "nodal_status", "nodal_amount_paise", "order_id", "order_status", "invoice_amount_paise", "awb", "courier_status", "otp_verified", "description"]
        for key in preferred:
            if key in dispute_case:
                value = dispute_case[key]
                if key.endswith("_paise"):
                    value = _money(int(value))
                case_rows.append([key.replace("_", " "), value])
        story += [para(f"Synthetic dispute case {dispute_case.get('case_id', '')}", "SGHeading"), table(case_rows, [62 * mm, 116 * mm]), Spacer(1, 8)]
        story += [para("Dispute evidence fingerprint", "SGHeading"), para(dispute_case.get("evidence_snapshot_sha256", "Not supplied"))]
        dispute_merkle = dispute_case.get("dispute_merkle") or {}
        story += [para("Three-way Nodal · POS · Courier Merkle root", "SGHeading"), para(dispute_merkle.get("root_sha256", "Not supplied"))]
        leaf_rows = [["Evidence leaf", "Record ID", "SHA-256"]]
        for leaf in dispute_merkle.get("leaves", []):
            leaf_rows.append([leaf.get("kind"), leaf.get("id"), leaf.get("leaf_sha256")])
        if len(leaf_rows) > 1:
            story += [table(leaf_rows, [52 * mm, 52 * mm, 74 * mm])]
        story += [para("Merkle scope: these three leaves fingerprint the supplied nodal, POS/invoice and courier fields. They do not authenticate source systems or establish legal truth.", "SGSmall")]
    else:
        story += [para("No dispute case was attached to this packet.", "SGHeading"), para("The current source bundle supplies payout, adjustment, settlement-batch and bank-credit rows. It does not contain an independently verified POS invoice, item-level order status, courier AWB or delivery OTP for this payout. No delivery claim is made from the payment or UTR rows alone.")]
    order_rows = [["Order ID", "Transaction ID", "Payment status", "Gross amount", "Source row"]]
    seen_orders: set[str] = set()
    max_order_rows = 4 if dispute_case else 8  # Reserve room for the three-way dispute Merkle proof.
    for row in selected_tx:
        order_id = str(row.get("order_id") or "")
        if order_id and order_id not in seen_orders:
            seen_orders.add(order_id)
            order_rows.append([order_id, row.get("pg_txn_id"), row.get("status"), _money(int(row.get("gross_paise", 0))), row.get("source_row_id")])
        if len(order_rows) >= max_order_rows + 1:
            break
    if len(order_rows) == 1:
        order_rows.append(["No order ID provided in source rows", "—", "—", "—", "—"])
    story += [para("Order references present in the selected payout", "SGHeading"), table(order_rows, [38 * mm, 34 * mm, 30 * mm, 34 * mm, 42 * mm]), para("A payment/settlement record is not, by itself, proof of delivery. Conflicting or absent order and courier evidence must stay in human review.", "SGSmall"), PageBreak()]

    # EXHIBIT D — voice intake.
    story += [para("EXHIBIT D — MERCHANT VOICE INTAKE", "SGTitle"), para(common, "SGSubtitle"), para("Voice transcript", "SGHeading")]
    if voice_transcript:
        story += [para(f"Recognised language: {voice_language_code or 'auto-detected / not reported'}"), para("Transcript (ASR output; verify all amounts, IDs and references against the source reports):", "SGBody")]
        if voice_transcript.isascii():
            story.append(para(voice_transcript, "SGBody"))
        elif dev_font:
            story.append(para(voice_transcript, "SGHindi"))
        else:
            # Do not silently emit unreadable Devanagari glyphs if the runtime lacks a font.
            try:
                voice_transcript.encode("cp1252")
                story.append(para(voice_transcript, "SGBody"))
            except UnicodeEncodeError:
                story.append(para("A transcript was supplied, but this runtime has no Devanagari font. The transcript is retained by the voice API response and is not embedded in this PDF.", "SGBody"))
    else:
        story += [para("No voice transcript was attached to this packet."), para("When Sarvam Saaras is configured, its transcript can be supplied here. Speech recognition output is an intake hint only: merchant references must be confirmed against source records before any workflow advances.")]
    story += [Spacer(1, 10), para("Human control and system boundary", "SGHeading"), para("The assistant may summarise evidence and call allow-listed read-only tools. It does not calculate financial values, issue refunds, move money, upload a dispute to Paytm/NPCI, or promise a dispute outcome. Any real financial or dispute action requires an authorised provider integration and a human approval workflow."), Spacer(1, 14), para("Packet status: locally generated evidence summary · not a statutory form · not a live Paytm/NPCI submission · hashes are integrity fingerprints only.", "SGSmall")]

    def footer(canvas, _doc):
        canvas.saveState()
        canvas.setStrokeColor(colors.HexColor("#d5dee8"))
        canvas.line(16 * mm, 13 * mm, A4[0] - 16 * mm, 13 * mm)
        canvas.setFont("Helvetica", 7)
        canvas.setFillColor(colors.HexColor("#63778b"))
        canvas.drawString(16 * mm, 8.5 * mm, "SETTLEGRAPH · LOCAL EVIDENCE SUMMARY · SOURCE AUTHENTICITY NOT ASSERTED")
        canvas.drawRightString(A4[0] - 16 * mm, 8.5 * mm, f"Page {_doc.page}")
        canvas.restoreState()

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return buffer.getvalue()
