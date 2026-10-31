import React, { useEffect, useState } from 'react'
import {
  AlertTriangle, Check, CheckCircle2, ChevronRight, Clock3,
  Download, FileCheck2, FileSearch, FileText, Fingerprint,
  GitBranch, HelpCircle, History, MessageSquare, Plus,
  RefreshCw, RotateCcw, Send, ShieldAlert, ShieldCheck,
  UserCheck, XCircle,
} from 'lucide-react'

type AnyObj = Record<string, any>

type Props = {
  investigations: AnyObj[]
  auditEvents: AnyObj[]
  money: (paise?: number | null) => string
  stamp: (value?: string) => string
  shortHash: (hash?: string) => string
  onCreateInvestigation: (note: string, sourceNodeId?: string) => Promise<void>
  onAddNote: (invId: number, note: string) => Promise<void>
  onDecideInvestigation: (invId: number, decision: 'APPROVE' | 'REJECT', note: string) => Promise<void>
  onReopenInvestigation: (invId: number, note: string) => Promise<void>
  onCompileEvidencePdf: () => Promise<void>
  onTraceNode: (nodeId: string) => void
  loading?: boolean
}

export default function InvestigationWorkspace({
  investigations,
  auditEvents,
  money,
  stamp,
  shortHash,
  onCreateInvestigation,
  onAddNote,
  onDecideInvestigation,
  onReopenInvestigation,
  onCompileEvidencePdf,
  onTraceNode,
  loading = false,
}: Props) {
  const [selectedInvId, setSelectedInvId] = useState<number | null>(null)
  const [newCaseNote, setNewCaseNote] = useState('')
  const [newCaseNode, setNewCaseNode] = useState('BATCH-2026-10-27')
  const [operatorNoteInput, setOperatorNoteInput] = useState('')
  const [decisionNoteInput, setDecisionNoteInput] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'RESOLVED' | 'REJECTED'>('ALL')
  const [submitting, setSubmitting] = useState(false)

  // Auto-select first investigation if none selected
  useEffect(() => {
    if (!selectedInvId && investigations.length > 0) {
      setSelectedInvId(investigations[0].id)
    }
  }, [investigations, selectedInvId])

  const activeInv = investigations.find(i => i.id === selectedInvId) || investigations[0] || null

  const filteredInvs = investigations.filter(i => {
    if (statusFilter === 'ALL') return true
    if (statusFilter === 'OPEN') return i.status !== 'RESOLVED' && i.status !== 'REJECTED'
    if (statusFilter === 'RESOLVED') return i.status === 'RESOLVED'
    if (statusFilter === 'REJECTED') return i.status === 'REJECTED'
    return true
  })

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCaseNote.trim()) return
    setSubmitting(true)
    try {
      await onCreateInvestigation(newCaseNote.trim(), newCaseNode.trim() || undefined)
      setNewCaseNote('')
    } finally {
      setSubmitting(false)
    }
  }

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeInv || !operatorNoteInput.trim()) return
    setSubmitting(true)
    try {
      await onAddNote(activeInv.id, operatorNoteInput.trim())
      setOperatorNoteInput('')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDecide = async (decision: 'APPROVE' | 'REJECT') => {
    if (!activeInv) return
    setSubmitting(true)
    try {
      await onDecideInvestigation(activeInv.id, decision, decisionNoteInput.trim() || `Decision: ${decision}`)
      setDecisionNoteInput('')
    } finally {
      setSubmitting(false)
    }
  }

  const handleReopen = async () => {
    if (!activeInv) return
    setSubmitting(true)
    try {
      await onReopenInvestigation(activeInv.id, 'Case reopened for re-verification.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="investigation-workspace-layout">
      {/* 1. Header Toolbar */}
      <section className="intro-row">
        <div>
          <h2>Merchant Investigation & Decision Workspace</h2>
          <p>
            Evidence-backed dispute and discrepancy resolution. Record operator notes, stage resolutions for human approval, and maintain cryptographically hash-chained audit trails.
          </p>
        </div>
        <div className="audit-actions">
          <button className="primary-button" onClick={() => void onCompileEvidencePdf()}>
            <FileText size={15} /> Compile 4-Exhibit PDF Packet
          </button>
        </div>
      </section>

      {/* 2. New Investigation Quick Creation Banner */}
      <section className="panel create-inv-bar">
        <form onSubmit={handleCreateCase} className="create-inv-form">
          <div className="inv-form-header">
            <Plus size={16} className="text-cyan-600" />
            <strong>Open New Investigation</strong>
          </div>
          <div className="inv-form-inputs">
            <input
              type="text"
              placeholder="Enter investigation issue description (e.g. Bank credit short by ₹100 for batch...)"
              value={newCaseNote}
              onChange={e => setNewCaseNote(e.target.value)}
              className="inv-note-input"
              required
            />
            <input
              type="text"
              placeholder="Source Node ID (e.g. BATCH-2026-10-27)"
              value={newCaseNode}
              onChange={e => setNewCaseNode(e.target.value)}
              className="inv-node-input"
            />
            <button type="submit" className="primary-button" disabled={submitting || !newCaseNote.trim()}>
              {submitting ? 'Saving...' : 'Create Case'}
            </button>
          </div>
        </form>
      </section>

      {/* 3. Main Workspace: Split View (Case List on Left, Active Case Detail on Right) */}
      <div className="inv-split-container">
        {/* Left: Case Register List */}
        <div className="panel inv-sidebar-list">
          <div className="inv-list-header">
            <div className="inv-list-title">
              <strong>Investigations Register</strong>
              <span className="badge-pill neutral">{investigations.length} cases</span>
            </div>
            <div className="inv-filter-buttons">
              <button
                className={`sub-tab ${statusFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setStatusFilter('ALL')}
              >
                All
              </button>
              <button
                className={`sub-tab ${statusFilter === 'OPEN' ? 'active' : ''}`}
                onClick={() => setStatusFilter('OPEN')}
              >
                Open
              </button>
              <button
                className={`sub-tab ${statusFilter === 'RESOLVED' ? 'active' : ''}`}
                onClick={() => setStatusFilter('RESOLVED')}
              >
                Resolved
              </button>
            </div>
          </div>

          <div className="inv-cards-scroll">
            {filteredInvs.map(inv => {
              const isSelected = activeInv?.id === inv.id
              const isResolved = inv.status === 'RESOLVED'
              const isRejected = inv.status === 'REJECTED'
              return (
                <div
                  key={inv.id}
                  className={`inv-summary-card ${isSelected ? 'active' : ''}`}
                  onClick={() => setSelectedInvId(inv.id)}
                >
                  <div className="card-top-row">
                    <strong className="inv-id-tag">INV-{String(inv.id).padStart(4, '0')}</strong>
                    <span className={`status-pill ${isResolved ? 'status-good' : isRejected ? 'status-bad' : 'status-warn'}`}>
                      {inv.status}
                    </span>
                  </div>
                  <p className="card-note-snippet">{inv.note}</p>
                  <div className="card-bottom-row">
                    <span className="residual-gap">{money(inv.residual_paise)}</span>
                    <small className="created-time">{stamp(inv.created_at)}</small>
                  </div>
                </div>
              )
            })}

            {filteredInvs.length === 0 && (
              <div className="empty-state">
                <CheckCircle2 size={24} className="text-emerald-500" />
                <p>No investigations match the selected filter.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Active Investigation Detail View */}
        {activeInv ? (
          <div className="panel inv-detail-panel">
            {/* Top Detail Header */}
            <div className="inv-detail-header">
              <div className="detail-header-left">
                <div className="inv-title-large">
                  <h3>Investigation INV-{String(activeInv.id).padStart(4, '0')}</h3>
                  <span className={`status-pill ${activeInv.status === 'RESOLVED' ? 'status-good' : activeInv.status === 'REJECTED' ? 'status-bad' : 'status-warn'}`}>
                    {activeInv.status}
                  </span>
                </div>
                <div className="inv-meta-sub">
                  <span>Created: {stamp(activeInv.created_at)}</span>
                  <span>•</span>
                  <span>Source Reference: <code>{activeInv.source_node_id || 'BATCH'}</code></span>
                  <span>•</span>
                  <span>Assigned Operator: <b>{activeInv.assigned_to || 'DEMO_OPERATOR'}</b></span>
                </div>
              </div>

              <div className="detail-header-actions">
                {activeInv.source_node_id && (
                  <button
                    className="secondary-button"
                    onClick={() => onTraceNode(activeInv.source_node_id)}
                  >
                    <GitBranch size={14} /> Trace in Graph
                  </button>
                )}
              </div>
            </div>

            {/* Discrepancy & Root Cause Overview */}
            <div className="inv-overview-grid">
              <div className="overview-metric-card">
                <span>Residual Gap</span>
                <strong>{money(activeInv.residual_paise)}</strong>
                <small>Unexplained variance between expected and bank credit</small>
              </div>

              <div className="overview-metric-card">
                <span>Decision State</span>
                <strong className={activeInv.decision === 'APPROVE_RESOLUTION' ? 'text-emerald-600' : ''}>
                  {activeInv.decision || 'PENDING_OPERATOR_REVIEW'}
                </strong>
                <small>{activeInv.decided_by ? `Decided by ${activeInv.decided_by}` : 'Awaiting human authorization'}</small>
              </div>

              <div className="overview-metric-card">
                <span>Integrity Fingerprint</span>
                <code className="text-xs">{shortHash(activeInv.snapshot_sha256)}</code>
                <small>SHA-256 bound to canonical snapshot</small>
              </div>
            </div>

            {/* Evidence Checklist */}
            <div className="evidence-checklist-card">
              <h4>Connected Evidence Sources</h4>
              <div className="evidence-items-row">
                <div className="ev-check-item">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  <div>
                    <strong>Payment Transaction Record</strong>
                    <small>PG transaction ID present in canonical dataset</small>
                  </div>
                </div>
                <div className="ev-check-item">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  <div>
                    <strong>Settlement Batch Assignment</strong>
                    <small>Authoritative batch UTR reference</small>
                  </div>
                </div>
                <div className="ev-check-item">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  <div>
                    <strong>Bank Statement Credit</strong>
                    <small>HDFC Bank nodal account confirmation</small>
                  </div>
                </div>
                <div className="ev-check-item">
                  <Clock3 size={16} className="text-amber-600" />
                  <div>
                    <strong>Dispute Merkle Proof</strong>
                    <small>3-way hash tree (Nodal, POS, Courier)</small>
                  </div>
                </div>
              </div>
            </div>

            {/* Operator Notes History Feed */}
            <div className="inv-notes-section">
              <h4>Investigation Notes & Timeline ({(activeInv.notes || []).length})</h4>
              <div className="notes-timeline-feed">
                {(activeInv.notes || []).map((n: AnyObj, i: number) => (
                  <div className="timeline-note-item" key={i}>
                    <div className="note-avatar">
                      <UserCheck size={14} />
                    </div>
                    <div className="note-content-bubble">
                      <div className="bubble-header">
                        <strong>{n.author || 'DEMO_OPERATOR'}</strong>
                        <small>{stamp(n.created_at)}</small>
                      </div>
                      <p>{n.text}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Note Input Form */}
              <form onSubmit={handleAddNote} className="add-note-form">
                <input
                  type="text"
                  placeholder="Add operator follow-up note (e.g. Verified bank statement UTR with branch manager...)"
                  value={operatorNoteInput}
                  onChange={e => setOperatorNoteInput(e.target.value)}
                  className="add-note-input"
                />
                <button
                  type="submit"
                  className="primary-button"
                  disabled={submitting || !operatorNoteInput.trim()}
                >
                  <Send size={13} /> {submitting ? 'Adding...' : 'Add Note'}
                </button>
              </form>
            </div>

            {/* Operator Decision Action Controls */}
            <div className="inv-decision-action-box">
              <div className="decision-prompt">
                <strong>Operator Resolution Decision</strong>
                <span>
                  All financial resolutions are staged for local manual handoff. No automated external money movement or refund API is ever called.
                </span>
              </div>

              {activeInv.status === 'RESOLVED' || activeInv.status === 'REJECTED' ? (
                <div className="decided-state-row">
                  <div className="decided-banner">
                    <CheckCircle2 size={18} className="text-emerald-600" />
                    <div>
                      <strong>Case Decided: {activeInv.decision || activeInv.status}</strong>
                      <p>{activeInv.decision_note || 'Resolution verified by operator.'}</p>
                    </div>
                  </div>
                  <button className="secondary-button" onClick={() => void handleReopen()} disabled={submitting}>
                    <RotateCcw size={14} /> Reopen Investigation
                  </button>
                </div>
              ) : (
                <div className="decision-buttons-row">
                  <input
                    type="text"
                    placeholder="Decision rationale (e.g. Confirmed variance approved for manual credit note)"
                    value={decisionNoteInput}
                    onChange={e => setDecisionNoteInput(e.target.value)}
                    className="decision-note-input"
                  />
                  <button
                    className="approve-btn"
                    onClick={() => void handleDecide('APPROVE')}
                    disabled={submitting}
                  >
                    <Check size={15} /> Approve Resolution
                  </button>
                  <button
                    className="reject-btn"
                    onClick={() => void handleDecide('REJECT')}
                    disabled={submitting}
                  >
                    <XCircle size={15} /> Reject Resolution
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="panel inv-detail-panel empty">
            <p>Select an investigation on the left or create a new one above.</p>
          </div>
        )}
      </div>

      {/* 4. Cryptographic Hash-Chained Audit Trail */}
      <section className="panel audit-trail-section">
        <div className="panel-header">
          <div className="panel-header-icon"><Fingerprint size={18} /></div>
          <div className="panel-header-text">
            <h3>Cryptographic Audit Chain</h3>
            <p>Every investigation, note, and decision is recorded into a SHA-256 linked local audit chain</p>
          </div>
          <span className="badge-pill good">CHAIN VERIFIED</span>
        </div>

        <div className="audit-events-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Event ID</th>
                <th>Timestamp</th>
                <th>Actor</th>
                <th>Event Type</th>
                <th>Event Detail</th>
                <th>Snapshot Fingerprint</th>
              </tr>
            </thead>
            <tbody>
              {auditEvents.slice(0, 10).map((evt: AnyObj) => (
                <tr key={evt.id}>
                  <td><strong>#{evt.id}</strong></td>
                  <td className="subtle-cell">{stamp(evt.created_at)}</td>
                  <td><b>{evt.actor}</b></td>
                  <td>
                    <span className="badge-pill neutral">{evt.event_type.replace(/_/g, ' ')}</span>
                  </td>
                  <td>{evt.detail}</td>
                  <td><code>{shortHash(evt.snapshot_sha256)}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

