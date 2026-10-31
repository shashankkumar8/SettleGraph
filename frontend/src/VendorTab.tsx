import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, BadgeCheck, CalendarClock, CheckCircle2, ClipboardCheck,
  FileCheck2, RefreshCw, ShieldAlert, Store, Wallet,
} from 'lucide-react'

type AnyObj = Record<string, any>
type RequestFn = (path: string, init?: RequestInit) => Promise<any>
type Props = { request: RequestFn; money: (paise?: number | null) => string }

type Toggles = {
  remove_grn: boolean
  short_grn: boolean
  inflate_invoice: boolean
  add_credit_note: boolean
  extend_agreement_over_45: boolean
}

const DEFAULT_TOGGLES: Toggles = {
  remove_grn: false,
  short_grn: false,
  inflate_invoice: false,
  add_credit_note: false,
  extend_agreement_over_45: false,
}

function localDate(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function postJson(path: string, body: AnyObj = {}): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

function badgeClass(priority?: string): string {
  if (priority === 'HIGH') return 'status-pill status-bad'
  if (priority === 'MEDIUM') return 'status-pill status-warn'
  return 'status-pill status-neutral'
}

export default function VendorTab({ request, money }: Props) {
  const [asOf, setAsOf] = useState(localDate())
  const [bankRate, setBankRate] = useState('')
  const [confirmRate, setConfirmRate] = useState(false)
  const [tatDate, setTatDate] = useState('2026-10-20')
  const [tatType, setTatType] = useState('UPI_P2M_CONFIRMATION_MISSING')
  const [reversalDate, setReversalDate] = useState('')
  const [toggles, setToggles] = useState<Toggles>(DEFAULT_TOGGLES)
  const [receivable, setReceivable] = useState<AnyObj | null>(null)
  const [exceptions, setExceptions] = useState<AnyObj[]>([])
  const [duplicates, setDuplicates] = useState<AnyObj[]>([])
  const [kirana, setKirana] = useState<AnyObj | null>(null)
  const [tat, setTat] = useState<AnyObj | null>(null)
  const [query, setQuery] = useState('Mere kitne payment pending hain?')
  const [answer, setAnswer] = useState<AnyObj | null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const requestBody = useMemo(() => ({
    as_of: asOf,
    bank_rate_bps: confirmRate ? Number.parseInt(bankRate, 10) : null,
    ...toggles,
  }), [asOf, bankRate, confirmRate, toggles])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const tatParams = new URLSearchParams({
        transaction_date: tatDate,
        transaction_type: tatType,
        as_of: asOf,
      })
      if (reversalDate) tatParams.set('reversal_date', reversalDate)
      const [r, ex, dup, kir, failed] = await Promise.all([
        request('/vendor/receivables/evaluate', postJson('/vendor/receivables/evaluate', requestBody)),
        request('/exceptions'),
        request('/duplicates'),
        request('/scenarios/kirana-payout'),
        request(`/scenarios/pending-success?${tatParams.toString()}`),
      ])
      setReceivable(r)
      setExceptions(ex.items || [])
      setDuplicates(dup || [])
      setKirana(kir)
      setTat(failed)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load vendor operations')
    } finally {
      setLoading(false)
    }
  }, [request, requestBody, tatDate, tatType, asOf, reversalDate])

  useEffect(() => { void refresh() }, [refresh])

  const stage = async (path: string, body: AnyObj = {}) => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await request(path, postJson(path, body))
      const id = result?.approval?.approval_id || 'approval record'
      setNotice(`Staged ${id} for human review. No email, refund or external API action was executed.`)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action was blocked')
    } finally {
      setBusy(false)
    }
  }

  const stageFollowUp = () => void stage('/vendor/receivables/stage-follow-up', requestBody)
  const isLocked = Boolean(receivable && !receivable.follow_up_pack_allowed)
  const rateValid = Number.isInteger(Number(bankRate)) && Number(bankRate) > 0 && Number(bankRate) <= 3000

  const askLedger = async () => {
    if (!query.trim()) return
    setBusy(true)
    setError('')
    try {
      setAnswer(await request('/assistant/query', postJson('/assistant/query', { text: query })))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not query the local ledger')
    } finally {
      setBusy(false)
    }
  }

  return <>
    <section className="intro-row vendor-intro">
      <div>
        <h2>Vendor cash-flow & exception desk</h2>
        <p>Connect purchase orders, goods receipt, invoices and payments. Track due dates, flag duplicate captures and route follow-ups for human review.</p>
      </div>
      <span className="status-pill status-warn">LOCAL SYNTHETIC WORKSPACE</span>
    </section>

    {error && <div className="alert alert-error"><AlertTriangle size={16} /><span>{error}</span></div>}
    {notice && <div className="alert alert-success"><CheckCircle2 size={16} /><span>{notice}</span></div>}

    <section className="vendor-control-row">
      <label><span>Evaluation date</span><input type="date" value={asOf} onChange={e => setAsOf(e.target.value)} /></label>
      <div className="vendor-rate-control">
        <label><span>Verified RBI bank rate (basis points)</span><input inputMode="numeric" placeholder="Enter verified rate" value={bankRate} onChange={e => { setBankRate(e.target.value.replace(/\D/g, '').slice(0, 4)); setConfirmRate(false) }} /></label>
        <label className="mapping-ack"><input type="checkbox" checked={confirmRate} onChange={e => setConfirmRate(e.target.checked)} disabled={!rateValid} /><span>I verified this rate for the relevant period. Use only for an illustrative estimate.</span></label>
        <small className="vendor-rate-note">The prior RBI reference captured in this research was 5.50% on 10 July 2026; it is not auto-assumed to be current. <a href="https://m.rbi.org.in/scripts/faqview.aspx?id=130" target="_blank" rel="noreferrer">Check RBI bank rate</a>.</small>
      </div>
      <button className="secondary-button" onClick={() => void refresh()} disabled={loading}><RefreshCw size={14} className={loading ? 'spin' : ''} /> Re-evaluate</button>
    </section>

    {loading && !receivable ? <div className="empty-state">Loading vendor evidence…</div> : null}

    {receivable && <section className="panel vendor-receivable-panel">
      <div className="panel-header">
        <div className="panel-header-icon"><Store size={18} /></div>
        <div className="panel-header-text"><h3>{receivable.vendor} · {receivable.invoice_id}</h3><p>Three-way review: PO → GRN → invoice → received payments</p></div>
        <span className={`status-pill ${isLocked ? 'status-bad' : 'status-good'}`}>{String(receivable.payment_status).replace(/_/g, ' ')}</span>
      </div>
      <div className="vendor-metrics">
        <div className="decision-fact"><span>Invoice value</span><strong>{money(receivable.invoice_paise)}</strong></div>
        <div className="decision-fact"><span>Payments received</span><strong>{money(receivable.received_paise)}</strong></div>
        <div className="decision-fact"><span>Outstanding</span><strong>{money(receivable.outstanding_paise)}</strong></div>
        <div className="decision-fact"><span>Unexplained balance</span><strong>{money(receivable.unexplained_paise)}</strong></div>
      </div>
      <div className="vendor-eligibility"><BadgeCheck size={15} /><span>{receivable.eligibility_note}</span></div>
      {receivable.statutory && <div className="vendor-statutory-grid">
        <div className="decision-fact"><span>Acceptance date</span><strong>{receivable.statutory.acceptance_date}</strong></div>
        <div className="decision-fact"><span>Statutory due date</span><strong>{receivable.statutory.statutory_due_date}</strong></div>
        <div className="decision-fact"><span>Days overdue</span><strong>{receivable.statutory.overdue_days}</strong></div>
        <div className="decision-fact"><span>Interest start</span><strong>{receivable.statutory.interest_start_date}</strong></div>
        <div className="decision-fact"><span>Indicative interest</span><strong>{receivable.statutory.indicative_interest_paise == null ? 'Rate confirmation needed' : money(receivable.statutory.indicative_interest_paise)}</strong></div>
        <div className="decision-fact"><span>Annual rate used</span><strong>{receivable.statutory.annual_interest_rate_bps == null ? 'Not calculated' : `${(receivable.statutory.annual_interest_rate_bps / 100).toFixed(2)}%`}</strong></div>
      </div>}
      {receivable.statutory?.note && <p className="panel-footnote vendor-note">{receivable.statutory.note}</p>}
      <div className="mapping-form vendor-fault-panel">
        <div className="mapping-title"><strong>Break the vendor evidence</strong><span>Inject a fixture discrepancy and watch the follow-up gate lock. These changes affect only the in-memory demo evaluation.</span></div>
        <div className="vendor-faults">
          {([
            ['remove_grn', 'Remove goods-receipt evidence'],
            ['short_grn', 'Reduce accepted GRN value'],
            ['inflate_invoice', 'Change invoice value'],
            ['add_credit_note', 'Add a documented credit note'],
            ['extend_agreement_over_45', 'Inject a 60-day written payment term'],
          ] as [keyof Toggles, string][]).map(([key, label]) => <label className="mapping-ack" key={key}>
            <input type="checkbox" checked={toggles[key]} onChange={e => setToggles(current => ({ ...current, [key]: e.target.checked }))} />
            <span>{label}</span>
          </label>)}
        </div>
        <div className="vendor-action-row">
          <button className="secondary-button" onClick={() => setToggles(DEFAULT_TOGGLES)}>Reset faults</button>
          <button className="primary-button" disabled={busy || loading || isLocked || receivable.outstanding_paise <= 0} onClick={stageFollowUp}>
            <ClipboardCheck size={15} /> {isLocked ? 'Follow-up locked: resolve evidence' : 'Stage vendor follow-up for approval'}
          </button>
        </div>
      </div>
      {receivable.flags?.length > 0 && <div className="vendor-flags">{receivable.flags.map((flag: string) => <div className="utr-result warn" key={flag}><strong>{flag.split(':')[0].replace(/_/g, ' ')}</strong><p>{flag.split(':').slice(1).join(':').trim()}</p></div>)}</div>}
      <p className="panel-footnote">Evidence SHA-256: <code>{receivable.evidence_sha256}</code> · Integrity fingerprint only; it does not prove supplier or document authenticity.</p>
    </section>}

    <section className="content-grid vendor-lower-grid">
      <section className="panel">
        <div className="panel-header"><div className="panel-header-icon"><ShieldAlert size={18} /></div><div className="panel-header-text"><h3>Action inbox</h3><p>{exceptions.length} source-linked or synthetic exception(s), ordered by priority</p></div></div>
        {exceptions.length === 0 ? <div className="empty-state">No exceptions in the current demo data.</div> : <div className="table-wrap"><table><thead><tr><th>Priority</th><th>Exception</th><th>Amount</th><th>Suggested action</th></tr></thead><tbody>
          {exceptions.map(item => <tr key={item.id}><td><span className={badgeClass(item.priority)}>{item.priority}</span></td><td>{String(item.kind).replace(/_/g, ' ')}</td><td className="amount-cell">{money(item.amount_paise)}</td><td>{item.action}</td></tr>)}
        </tbody></table></div>}
      </section>

      <section className="panel">
        <div className="panel-header"><div className="panel-header-icon"><Wallet size={18} /></div><div className="panel-header-text"><h3>Duplicate capture review</h3><p>Active source payment pairs within 120 seconds; candidate only</p></div></div>
        {duplicates.length === 0 ? <div className="empty-state">No qualifying duplicate-capture candidates found in the currently loaded payment rows.</div> : duplicates.map(item => <div className="vendor-duplicate-row" key={item.candidate_id || item.order_id}>
          <div><strong>{item.order_id}</strong><small>{item.txn_ids.join(' + ')}</small><small>{item.capture_cluster_size} captures · {item.cluster_span_seconds ?? '—'}s overall span · max linked pair {item.capture_window_seconds}s · payer: {item.payer_identity_check || 'not available'}</small></div>
          <div><span>Candidate amount · not confirmed overpayment</span><strong>{money(item.candidate_amount_paise ?? item.overpayment_paise)}</strong></div>
          <button className="secondary-button" disabled={busy} onClick={() => void stage(`/duplicates/${encodeURIComponent(item.candidate_id || item.order_id)}/stage-review`)}><FileCheck2 size={14} /> Stage review</button>
        </div>)}
        <p className="panel-footnote">A duplicate candidate is not a confirmed overpayment: this source bundle has no independently verified order total. Review the original order amount, successful payment references, reversal status and payer evidence before any manual follow-up. Staging creates a review record only; no refund call is available.</p>
      </section>
    </section>

    {kirana && <section className="panel">
      <div className="panel-header"><div className="panel-header-icon"><Wallet size={18} /></div><div className="panel-header-text"><h3>Kirana payout decomposition</h3><p>₹80,000 synthetic collection example · only documented rows are explained</p></div><span className={`status-pill ${kirana.unmatched_paise === 0 ? 'status-good' : 'status-warn'}`}>{kirana.status.replace(/_/g, ' ')}</span></div>
      <div className="vendor-metrics vendor-kirana-metrics">
        <div className="decision-fact"><span>Collected</span><strong>{money(kirana.gross_paise)}</strong></div>
        <div className="decision-fact"><span>Bank credited</span><strong>{money(kirana.bank_paise)}</strong></div>
        <div className="decision-fact"><span>Documented deductions</span><strong>{money(kirana.explained_paise)}</strong></div>
        <div className="decision-fact"><span>Unmatched amount</span><strong>{money(kirana.unmatched_paise)}</strong></div>
      </div>
      <div className="table-wrap"><table><thead><tr><th>Evidence type</th><th>Reference</th><th>Amount</th></tr></thead><tbody>
        {kirana.items.map((item: AnyObj) => <tr key={item.ref}><td>{String(item.kind).replace(/_/g, ' ')}</td><td><code>{item.ref}</code></td><td className="amount-cell">{money(item.paise)}</td></tr>)}
      </tbody></table></div>
      <p className="panel-footnote">{kirana.next_step || 'The recorded documented amounts equal the payout gap.'} The system never labels an unexplained residual as a fee or fraud without source evidence.</p>
    </section>}

    {tat && <section className="panel">
      <div className="panel-header"><div className="panel-header-icon"><CalendarClock size={18} /></div><div className="panel-header-text"><h3>Failed-payment turnaround monitor</h3><p>RBI TAT example for the selected UPI failure category</p></div><span className={`status-pill ${tat.days_late > 0 ? 'status-warn' : 'status-good'}`}>{String(tat.compensation_status).replace(/_/g, ' ')}</span></div>
      <div className="mapping-fields vendor-tat-fields">
        <label><span>Transaction date</span><input type="date" value={tatDate} onChange={e => setTatDate(e.target.value)} /></label>
        <label><span>Failure category</span><select value={tatType} onChange={e => setTatType(e.target.value)}><option value="UPI_P2M_CONFIRMATION_MISSING">UPI merchant confirmation missing · T+5</option><option value="UPI_P2P_BENEFICIARY_NOT_CREDITED">UPI beneficiary not credited · T+1</option></select></label>
        <label><span>Actual reversal date (optional)</span><input type="date" value={reversalDate} onChange={e => setReversalDate(e.target.value)} /></label>
      </div>
      <div className="vendor-metrics vendor-tat-metrics">
        <div className="decision-fact"><span>Applicable TAT</span><strong>T+{tat.tat_days}</strong></div>
        <div className="decision-fact"><span>Outer due date</span><strong>{tat.auto_reversal_due}</strong></div>
        <div className="decision-fact"><span>Days beyond TAT</span><strong>{tat.days_late}</strong></div>
        <div className="decision-fact"><span>Potential compensation</span><strong>{money(tat.compensation_paise)}</strong></div>
      </div>
      <p className="panel-footnote">{tat.transaction_description}. {tat.deadline_action}. ₹100/day is shown only for this RBI schedule category and is a local calculation, not confirmation of a bank liability or payment.</p>
    </section>}

    <section className="panel">
      <div className="panel-header"><div className="panel-header-icon"><CheckCircle2 size={18} /></div><div className="panel-header-text"><h3>Ask the local ledger (Hindi / Hinglish)</h3><p>Deterministic intent routing. No LLM produces amounts or legal conclusions here.</p></div></div>
      <div className="vendor-query-row"><input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void askLedger() }} placeholder="Mere kitne payment pending hain?" /><button className="primary-button" disabled={busy || !query.trim()} onClick={() => void askLedger()}>Ask ledger</button></div>
      {answer && <div className="utr-result good"><strong>{String(answer.intent).replace(/_/g, ' ')}</strong><p>{answer.reply_hi}</p><small>{answer.source}</small></div>}
    </section>

    <section className="panel vendor-regulatory-note">
      <div className="panel-header"><div className="panel-header-icon"><FileCheck2 size={18} /></div><div className="panel-header-text"><h3>Regulatory scope & source notes</h3><p>Reference material, not legal advice or an automated eligibility determination</p></div></div>
      <p>MSMED Act 2006 Sections 2(b), 15 and 16 define acceptance/deemed acceptance, the appointed day, the 45-day maximum for a written agreement and compound interest with monthly rests at three times the RBI bank rate. Ministry guidance says delayed-payment provisions apply to eligible Micro and Small manufacturing/service suppliers; trading activity is excluded from the MSEFC scheme guidance.</p>
      <p>Reference: <a href="https://www.indiacode.nic.in/bitstream/123456789/5872/1/a2006-27.pdf" target="_blank" rel="noreferrer">India Code — MSMED Act 2006</a> · <a href="https://ramp.msme.gov.in/ramp/pdf-documents/scheme-guidelines/msefc.pdf" target="_blank" rel="noreferrer">MSME MSEFC guidance</a> · <a href="https://rbi.org.in/commonman/Upload/English/Notification/PDFs/CIRCULAR677EC931A7A65E4D99AA957D8E85BC0A2A.PDF" target="_blank" rel="noreferrer">RBI failed-transaction TAT circular</a>.</p>
      <p className="panel-footnote">All built-in invoices, GRNs, payment attempts and payout figures are synthetic. The local engine does not verify Udyam registration, source authenticity, a buyer's objection, actual payment status, or whether a statutory claim is legally maintainable.</p>
    </section>
  </>
}
