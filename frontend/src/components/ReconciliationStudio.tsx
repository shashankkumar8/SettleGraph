import React, { useMemo, useState } from 'react'
import {
  AlertCircle, AlertTriangle, ArrowRight, ArrowUpRight, Check,
  CheckCircle2, ChevronRight, Clock3, Download, Eye, FileSearch,
  FileSpreadsheet, Filter, GitBranch, Layers, LoaderCircle,
  RefreshCw, Search, ShieldAlert, Upload, UploadCloud,
  Workflow, X,
} from 'lucide-react'

type AnyObj = Record<string, any>

type Props = {
  recon: AnyObj | null
  transactions: AnyObj[]
  adjustments: AnyObj[]
  rawPreview: AnyObj | null
  rawStaged: AnyObj[]
  money: (paise?: number | null) => string
  onUploadZip: (file: File) => Promise<void>
  onPreviewPaytmCsv: (file: File) => Promise<void>
  onStagePaytmCsv: () => Promise<void>
  onRestoreDemo: () => Promise<void>
  onTraceNode: (nodeId: string) => void
  onOpenInvestigation: (nodeId: string, note?: string) => void
  targetCaptureDate: string
  setTargetCaptureDate: (d: string) => void
  targetBatchId: string
  setTargetBatchId: (b: string) => void
  rawCaptureDate: string
  setRawCaptureDate: (d: string) => void
  rawBatchId: string
  setRawBatchId: (b: string) => void
  rawPayoutUtr: string
  setRawPayoutUtr: (u: string) => void
  rawPayoutDate: string
  setRawPayoutDate: (d: string) => void
  rawMappingAcknowledged: boolean
  setRawMappingAcknowledged: (a: boolean) => void
  importing: boolean
  rawPreviewing: boolean
  rawStaging: boolean
}

type FilterTab = 'all' | 'matched' | 'unmatched' | 'shifted' | 'adjustments'

export default function ReconciliationStudio({
  recon,
  transactions,
  adjustments,
  rawPreview,
  rawStaged,
  money,
  onUploadZip,
  onPreviewPaytmCsv,
  onStagePaytmCsv,
  onRestoreDemo,
  onTraceNode,
  onOpenInvestigation,
  targetCaptureDate,
  setTargetCaptureDate,
  targetBatchId,
  setTargetBatchId,
  rawCaptureDate,
  setRawCaptureDate,
  rawBatchId,
  setRawBatchId,
  rawPayoutUtr,
  setRawPayoutUtr,
  rawPayoutDate,
  setRawPayoutDate,
  rawMappingAcknowledged,
  setRawMappingAcknowledged,
  importing,
  rawPreviewing,
  rawStaging,
}: Props) {
  const [filterTab, setFilterTab] = useState<FilterTab>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTxn, setSelectedTxn] = useState<AnyObj | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [methodFilter, setMethodFilter] = useState('ALL')

  // Drag-and-drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    if (file.name.endsWith('.zip')) {
      void onUploadZip(file)
    } else if (file.name.endsWith('.csv')) {
      void onPreviewPaytmCsv(file)
    }
  }

  // Categorize transactions
  const matchedTxns = useMemo(() => {
    return transactions.filter(t => t.payout_batch_id === targetBatchId && t.status === 'SUCCESS')
  }, [transactions, targetBatchId])

  const unmatchedTxns = useMemo(() => {
    return transactions.filter(t => !t.payout_batch_id || t.payout_batch_id === 'MISSING REFERENCE')
  }, [transactions])

  const shiftedTxns = useMemo(() => {
    return transactions.filter(t => t.payout_batch_id && t.payout_batch_id !== targetBatchId)
  }, [transactions, targetBatchId])

  // Filtered transactions for the current view
  const displayList = useMemo(() => {
    let list: AnyObj[] = []
    if (filterTab === 'all') list = transactions
    else if (filterTab === 'matched') list = matchedTxns
    else if (filterTab === 'unmatched') list = unmatchedTxns
    else if (filterTab === 'shifted') list = shiftedTxns
    else if (filterTab === 'adjustments') return []

    const q = searchQuery.trim().toLowerCase()
    return list.filter(t => {
      const matchesSearch = !q || [
        t.pg_txn_id,
        t.utr_rrn,
        t.order_id,
        t.payout_batch_id,
        t.source_row_id,
      ].some(v => String(v || '').toLowerCase().includes(q))

      const matchesMethod = methodFilter === 'ALL' || t.instrument === methodFilter
      return matchesSearch && matchesMethod
    })
  }, [filterTab, transactions, matchedTxns, unmatchedTxns, shiftedTxns, searchQuery, methodFilter])

  const instruments = useMemo(() => {
    const set = new Set<string>()
    transactions.forEach(t => { if (t.instrument) set.add(t.instrument) })
    return Array.from(set)
  }, [transactions])

  return (
    <div className="reconciliation-studio">
      {/* 1. Drag and Drop Ingestion Zone */}
      <section
        className={`recon-upload-zone ${isDragOver ? 'drag-over' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="upload-zone-left">
          <div className="upload-icon-wrapper">
            <UploadCloud size={28} className="cloud-icon" />
          </div>
          <div className="upload-text">
            <strong>Drag & Drop Settlement CSV or ZIP Report Bundle</strong>
            <span>
              Supports canonical 4-report ZIP (transactions, adjustments, batches, bank credits) or raw Paytm merchant CSV export.
            </span>
          </div>
        </div>

        <div className="upload-controls">
          <label className="import-btn primary">
            <input
              type="file"
              accept=".zip,application/zip"
              disabled={importing}
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) void onUploadZip(f)
                e.currentTarget.value = ''
              }}
            />
            {importing ? <LoaderCircle size={14} className="spin" /> : <Upload size={14} />}
            {importing ? 'Importing ZIP...' : 'Upload Canonical ZIP'}
          </label>

          <label className="import-btn secondary">
            <input
              type="file"
              accept=".csv,text/csv"
              disabled={rawPreviewing}
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) void onPreviewPaytmCsv(f)
                e.currentTarget.value = ''
              }}
            />
            {rawPreviewing ? <LoaderCircle size={14} className="spin" /> : <FileSearch size={14} />}
            {rawPreviewing ? 'Previewing...' : 'Preview Paytm CSV'}
          </label>

          <button className="restore-demo-btn" onClick={() => void onRestoreDemo()} disabled={importing}>
            <RefreshCw size={13} /> Restore Demo Data
          </button>
        </div>
      </section>

      {/* 2. Visual Reconciliation Flow: Payment -> Settlement Batch -> Bank -> Verdict */}
      {recon && (
        <section className="reconciliation-flow-pipeline">
          <div className="flow-step">
            <div className="step-tag">STEP 1: CAPTURED</div>
            <strong>{recon.gross_captured_display}</strong>
            <small>{recon.transaction_count} merchant payments</small>
          </div>
          <div className="flow-arrow">↳</div>
          <div className="flow-step">
            <div className="step-tag">STEP 2: BATCH GROSS</div>
            <strong>{recon.current_batch_gross_display}</strong>
            <small>{recon.assigned_transaction_count} assigned to {recon.target_batch_id}</small>
          </div>
          <div className="flow-arrow">−</div>
          <div className="flow-step">
            <div className="step-tag">STEP 3: DEBIT FEES</div>
            <strong>− {money(recon.total_debit_adjustments_paise)}</strong>
            <small>{recon.adjustment_buckets.length} fee adjustments</small>
          </div>
          <div className="flow-arrow">=</div>
          <div className="flow-step">
            <div className="step-tag">STEP 4: EXPECTED NET</div>
            <strong>{recon.expected_net_display}</strong>
            <small>Authoritative calculated payout</small>
          </div>
          <div className="flow-arrow">vs</div>
          <div className="flow-step">
            <div className="step-tag">STEP 5: BANK STATEMENT</div>
            <strong>{recon.actual_bank_display}</strong>
            <small>Matched payout UTR credit</small>
          </div>
          <div className="flow-arrow">➔</div>
          <div className={`flow-verdict ${recon.residual_paise === 0 && recon.status === 'RECONCILED' ? 'good' : 'bad'}`}>
            <div className="step-tag">RECONCILIATION RESULT</div>
            <strong>{recon.residual_display}</strong>
            <span className="verdict-status-pill">{recon.status.replace(/_/g, ' ')}</span>
          </div>
        </section>
      )}

      {/* 3. Raw Paytm CSV Preview & Staging (If user selected a raw CSV) */}
      {rawPreview && (
        <section className="panel raw-preview-section">
          <div className="panel-header">
            <div className="panel-header-icon"><FileSearch size={18} /></div>
            <div className="panel-header-text">
              <h3>Raw Settlement CSV Column Mapping Preview</h3>
              <p>Exact decimal-to-paise normalization · Inspect mapped columns before staging</p>
            </div>
            <span className="badge-warn">PREVIEW ONLY</span>
          </div>

          <div className="preview-metadata-row">
            <div className="meta-box"><span>Rows Parsed</span><strong>{rawPreview.row_count}</strong></div>
            <div className="meta-box"><span>Unassigned Rows</span><strong>{rawPreview.unresolved_batch_assignment_count}</strong></div>
            <div className="meta-box"><span>File SHA-256</span><code>{rawPreview.source_file_sha256?.slice(0, 16)}...</code></div>
          </div>

          {rawPreview.notes && (
            <div className="mapping-notes-list">
              {rawPreview.notes.map((note: string, idx: number) => (
                <div key={idx} className="note-item">• {note}</div>
              ))}
            </div>
          )}

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Source Txn ID</th>
                  <th>Amount</th>
                  <th>MDR Commission</th>
                  <th>GST</th>
                  <th>Net Settled</th>
                  <th>UTR</th>
                </tr>
              </thead>
              <tbody>
                {(rawPreview.sample_rows || []).map((row: AnyObj, i: number) => (
                  <tr key={i}>
                    <td><code>{row.transaction_id}</code></td>
                    <td>{row.amount_paise != null ? money(row.amount_paise) : '—'}</td>
                    <td>{row.commission_paise != null ? money(row.commission_paise) : '—'}</td>
                    <td>{row.gst_paise != null ? money(row.gst_paise) : '—'}</td>
                    <td>{row.settled_amount_paise != null ? money(row.settled_amount_paise) : '—'}</td>
                    <td><code>{row.utr || '—'}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mapping-stage-box">
            <div className="stage-title">
              <strong>Confirm Explicit Payout Parameters</strong>
              <small>Staging creates an audit record for canonical reconciliation; it does not fabricate bank credits.</small>
            </div>
            <div className="stage-fields-grid">
              <label><span>Capture Date</span><input type="date" value={rawCaptureDate} onChange={e => setRawCaptureDate(e.target.value)} /></label>
              <label><span>Batch ID</span><input value={rawBatchId} onChange={e => setRawBatchId(e.target.value)} placeholder="BATCH-2026-10-27" /></label>
              <label><span>Payout UTR</span><input value={rawPayoutUtr} onChange={e => setRawPayoutUtr(e.target.value)} placeholder="Enter bank payout UTR" /></label>
              <label><span>Payout Date</span><input type="date" value={rawPayoutDate} onChange={e => setRawPayoutDate(e.target.value)} /></label>
            </div>
            <label className="ack-checkbox-row">
              <input type="checkbox" checked={rawMappingAcknowledged} onChange={e => setRawMappingAcknowledged(e.target.checked)} />
              <span>I confirm that the Batch ID and Payout UTR match the authoritative settlement and bank statement records.</span>
            </label>
            <button
              className="primary-button"
              disabled={rawStaging || !rawMappingAcknowledged || !rawBatchId.trim() || !rawPayoutUtr.trim()}
              onClick={() => void onStagePaytmCsv()}
            >
              {rawStaging ? <LoaderCircle size={14} className="spin" /> : <Check size={14} />}
              {rawStaging ? 'Staging...' : 'Register Staged Settlement'}
            </button>
          </div>
        </section>
      )}

      {/* 4. Filter Tabs & Search Controls */}
      <section className="table-filter-bar">
        <div className="filter-tabs">
          <button
            className={`filter-tab-btn ${filterTab === 'all' ? 'active' : ''}`}
            onClick={() => setFilterTab('all')}
          >
            All Transactions <span className="tab-count">{transactions.length}</span>
          </button>
          <button
            className={`filter-tab-btn ${filterTab === 'matched' ? 'active' : ''}`}
            onClick={() => setFilterTab('matched')}
          >
            Matched <span className="tab-count good">{matchedTxns.length}</span>
          </button>
          <button
            className={`filter-tab-btn ${filterTab === 'unmatched' ? 'active' : ''}`}
            onClick={() => setFilterTab('unmatched')}
          >
            Unassigned / Missing <span className="tab-count warn">{unmatchedTxns.length}</span>
          </button>
          <button
            className={`filter-tab-btn ${filterTab === 'shifted' ? 'active' : ''}`}
            onClick={() => setFilterTab('shifted')}
          >
            Shifted Cutoff <span className="tab-count">{shiftedTxns.length}</span>
          </button>
          <button
            className={`filter-tab-btn ${filterTab === 'adjustments' ? 'active' : ''}`}
            onClick={() => setFilterTab('adjustments')}
          >
            MDR & Fee Adjustments <span className="tab-count">{adjustments.length}</span>
          </button>
        </div>

        <div className="filter-search-group">
          <select
            className="select-channel"
            value={methodFilter}
            onChange={e => setMethodFilter(e.target.value)}
          >
            <option value="ALL">All Methods</option>
            {instruments.map(inst => (
              <option key={inst} value={inst}>{inst}</option>
            ))}
          </select>

          <div className="search-box">
            <Search size={14} />
            <input
              type="text"
              placeholder="Search Transaction ID, UTR, Order..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* 5. Main Transactions / Adjustments Table */}
      <section className="panel table-panel">
        <div className="table-wrap">
          {filterTab === 'adjustments' ? (
            <table>
              <thead>
                <tr>
                  <th>Adjustment ID</th>
                  <th>Category</th>
                  <th>Amount</th>
                  <th>Direction</th>
                  <th>Reference</th>
                  <th>Batch ID</th>
                  <th>Source Row</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {adjustments.map((adj: AnyObj) => (
                  <tr key={adj.adjustment_id}>
                    <td><code>{adj.adjustment_id}</code></td>
                    <td>
                      <span className={`badge-pill ${adj.type.includes('UNKNOWN') ? 'warn' : 'neutral'}`}>
                        {adj.type}
                      </span>
                    </td>
                    <td className="amount-cell">{adj.amount_display || money(adj.amount_paise)}</td>
                    <td>{adj.direction}</td>
                    <td><code>{adj.reference_id || '—'}</code></td>
                    <td><code>{adj.batch_id}</code></td>
                    <td className="subtle-cell">{adj.source_row_id}</td>
                    <td>
                      <button className="text-button" onClick={() => onTraceNode(adj.adjustment_id)}>
                        Trace <ArrowRight size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Transaction ID</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th>Assigned Batch</th>
                  <th>Capture Timestamp</th>
                  <th>Reconciliation State</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayList.slice(0, 20).map((t: AnyObj) => {
                  const isAssigned = t.payout_batch_id === targetBatchId
                  const isShifted = t.payout_batch_id && t.payout_batch_id !== targetBatchId
                  return (
                    <tr
                      key={t.pg_txn_id}
                      className={selectedTxn?.pg_txn_id === t.pg_txn_id ? 'selected-row' : ''}
                      onClick={() => setSelectedTxn(t)}
                    >
                      <td>
                        <strong><code>{t.pg_txn_id}</code></strong>
                        {t.order_id && <small className="table-sub">Order: {t.order_id}</small>}
                      </td>
                      <td className="amount-cell">{t.gross_display || money(t.gross_paise)}</td>
                      <td>{t.instrument}</td>
                      <td>
                        <span className={`status-pill ${t.status === 'SUCCESS' ? 'status-good' : 'status-warn'}`}>
                          {t.status}
                        </span>
                      </td>
                      <td>
                        {t.payout_batch_id ? (
                          <code>{t.payout_batch_id}</code>
                        ) : (
                          <span className="unassigned-badge">UNASSIGNED</span>
                        )}
                      </td>
                      <td className="subtle-cell">{t.capture_ts?.slice(0, 19).replace('T', ' ') || '—'}</td>
                      <td>
                        {isAssigned ? (
                          <span className="badge-pill good">RECONCILED</span>
                        ) : isShifted ? (
                          <span className="badge-pill info">SHIFTED BATCH</span>
                        ) : (
                          <span className="badge-pill warn">UNASSIGNED CUTOFF</span>
                        )}
                      </td>
                      <td>
                        <div className="row-action-btns">
                          <button
                            className="icon-action-btn"
                            title="Trace in Settlement Graph"
                            onClick={e => {
                              e.stopPropagation()
                              onTraceNode(t.pg_txn_id)
                            }}
                          >
                            <GitBranch size={13} />
                          </button>
                          <button
                            className="icon-action-btn"
                            title="Open Investigation"
                            onClick={e => {
                              e.stopPropagation()
                              onOpenInvestigation(t.pg_txn_id, `Investigation into transaction ${t.pg_txn_id}`)
                            }}
                          >
                            <ShieldAlert size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          {displayList.length > 20 && (
            <div className="table-caption">
              Showing 20 of {displayList.length} matching rows. Use search to filter specific records.
            </div>
          )}

          {displayList.length === 0 && filterTab !== 'adjustments' && (
            <div className="empty-state">
              <CheckCircle2 size={24} className="text-emerald-500" />
              <strong>No transactions match the selected filter</strong>
              <p>Try switching filter tabs or clearing your search term.</p>
            </div>
          )}
        </div>
      </section>

      {/* 6. Transaction Detail Slide-Over Drawer */}
      {selectedTxn && (
        <aside className="transaction-detail-drawer">
          <div className="drawer-header">
            <div className="drawer-type-badge">TRANSACTION DETAIL</div>
            <button className="icon-btn close-drawer" onClick={() => setSelectedTxn(null)}>
              <X size={15} />
            </button>
          </div>

          <div className="drawer-body">
            <h3><code>{selectedTxn.pg_txn_id}</code></h3>
            <div className="txn-amount-highlight">
              <span>Gross Captured</span>
              <strong>{selectedTxn.gross_display || money(selectedTxn.gross_paise)}</strong>
            </div>

            <div className="drawer-section">
              <h4>Reconciliation Match Diagnosis</h4>
              <div className="diagnosis-box">
                {selectedTxn.payout_batch_id === targetBatchId ? (
                  <div className="diag-item good">
                    <CheckCircle2 size={16} />
                    <div>
                      <strong>Matched to Active Settlement Batch</strong>
                      <p>Transaction carries explicit batch ID <code>{selectedTxn.payout_batch_id}</code> and matches the settlement report.</p>
                    </div>
                  </div>
                ) : selectedTxn.payout_batch_id ? (
                  <div className="diag-item info">
                    <Clock3 size={16} />
                    <div>
                      <strong>Shifted to Batch {selectedTxn.payout_batch_id}</strong>
                      <p>Nodal cutoff window shifted this transaction to another payout batch. It does not contribute to current batch credit.</p>
                    </div>
                  </div>
                ) : (
                  <div className="diag-item warn">
                    <AlertTriangle size={16} />
                    <div>
                      <strong>Unassigned Payout Reference</strong>
                      <p>Transaction was captured on <code>{selectedTxn.capture_ts?.slice(0, 10)}</code> but has no authoritative payout_batch_id.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="drawer-section">
              <h4>Audit Attributes</h4>
              <div className="metadata-table">
                <div className="meta-row"><span>Order ID</span><b>{selectedTxn.order_id || '—'}</b></div>
                <div className="meta-row"><span>UTR / RRN</span><code>{selectedTxn.utr_rrn || '—'}</code></div>
                <div className="meta-row"><span>Payment Method</span><b>{selectedTxn.instrument}</b></div>
                <div className="meta-row"><span>Status</span><span className="badge-good">{selectedTxn.status}</span></div>
                <div className="meta-row"><span>Source Row ID</span><code>{selectedTxn.source_row_id}</code></div>
                <div className="meta-row"><span>Capture Timestamp</span><span>{selectedTxn.capture_ts || '—'}</span></div>
                {selectedTxn.nodal_settled_ts && (
                  <div className="meta-row"><span>Nodal Settlement TS</span><span>{selectedTxn.nodal_settled_ts}</span></div>
                )}
              </div>
            </div>

            <div className="drawer-actions">
              <button
                className="primary-button wide"
                onClick={() => {
                  onOpenInvestigation(selectedTxn.pg_txn_id, `Investigation into transaction ${selectedTxn.pg_txn_id}`)
                  setSelectedTxn(null)
                }}
              >
                <ShieldAlert size={14} /> Open Investigation Case
              </button>
              <button
                className="secondary-button wide"
                onClick={() => {
                  onTraceNode(selectedTxn.pg_txn_id)
                  setSelectedTxn(null)
                }}
              >
                <GitBranch size={14} /> Trace in Evidence Graph
              </button>
            </div>
          </div>
        </aside>
      )}
    </div>
  )
}

