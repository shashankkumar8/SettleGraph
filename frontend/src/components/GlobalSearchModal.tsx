import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity, ArrowRight, Banknote, CreditCard, FileSearch,
  FileText, Landmark, Search, ShieldAlert, Wallet, X,
} from 'lucide-react'

type AnyObj = Record<string, any>

type Props = {
  isOpen: boolean
  onClose: () => void
  transactions: AnyObj[]
  adjustments: AnyObj[]
  investigations: AnyObj[]
  onSelectNode: (nodeId: string) => void
  onNavigateTab: (tab: any) => void
  money: (paise?: number | null) => string
}

export default function GlobalSearchModal({
  isOpen,
  onClose,
  transactions,
  adjustments,
  investigations,
  onSelectNode,
  onNavigateTab,
  money,
}: Props) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      setQuery('')
    }
  }, [isOpen])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        if (isOpen) onClose()
        else {
          // Open handled by parent
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []

    const matches: AnyObj[] = []

    // 1. Transactions
    transactions.forEach(t => {
      if (
        t.pg_txn_id?.toLowerCase().includes(q) ||
        t.order_id?.toLowerCase().includes(q) ||
        t.utr_rrn?.toLowerCase().includes(q)
      ) {
        matches.push({
          type: 'PAYMENT',
          id: t.pg_txn_id,
          label: t.pg_txn_id,
          sub: `Order: ${t.order_id || '—'} · UTR: ${t.utr_rrn || '—'}`,
          amount: t.gross_display || money(t.gross_paise),
          targetTab: 'evidence',
          nodeId: t.pg_txn_id,
        })
      }
    })

    // 2. Adjustments
    adjustments.forEach(a => {
      if (
        a.adjustment_id?.toLowerCase().includes(q) ||
        a.type?.toLowerCase().includes(q) ||
        a.reference_id?.toLowerCase().includes(q)
      ) {
        matches.push({
          type: 'ADJUSTMENT',
          id: a.adjustment_id,
          label: a.adjustment_id,
          sub: `${a.type} · ${a.description || ''}`,
          amount: a.amount_display || money(a.amount_paise),
          targetTab: 'evidence',
          nodeId: a.adjustment_id,
        })
      }
    })

    // 3. Investigations
    investigations.forEach(i => {
      const invId = `INV-${String(i.id).padStart(4, '0')}`
      if (
        invId.toLowerCase().includes(q) ||
        i.note?.toLowerCase().includes(q) ||
        i.source_node_id?.toLowerCase().includes(q)
      ) {
        matches.push({
          type: 'INVESTIGATION',
          id: invId,
          label: invId,
          sub: i.note,
          amount: money(i.residual_paise),
          targetTab: 'audit',
          nodeId: i.source_node_id,
        })
      }
    })

    return matches.slice(0, 10)
  }, [query, transactions, adjustments, investigations, money])

  if (!isOpen) return null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="global-search-modal" onClick={e => e.stopPropagation()}>
        <div className="search-modal-header">
          <Search size={18} className="search-header-icon" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search all Payments, Orders, UTRs, Fee Adjustments, Investigations..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <button className="modal-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="search-modal-body">
          {query.trim() === '' ? (
            <div className="search-suggestions">
              <span className="suggestion-label">QUICK FILTERS:</span>
              <div className="suggestion-chips">
                <button onClick={() => setQuery('PTM-TXN')}>Payments (PTM-TXN)</button>
                <button onClick={() => setQuery('ORD-')}>Orders (ORD-)</button>
                <button onClick={() => setQuery('ADJ-')}>Fees & Adjustments (ADJ-)</button>
                <button onClick={() => setQuery('INV-')}>Investigations (INV-)</button>
              </div>
            </div>
          ) : results.length > 0 ? (
            <div className="search-modal-results">
              {results.map(item => (
                <div
                  key={`${item.type}-${item.id}`}
                  className="search-item-card"
                  onClick={() => {
                    if (item.nodeId) onSelectNode(item.nodeId)
                    if (item.targetTab) onNavigateTab(item.targetTab)
                    onClose()
                  }}
                >
                  <div className={`item-type-badge ${item.type.toLowerCase()}`}>
                    {item.type}
                  </div>
                  <div className="item-text-col">
                    <strong>{item.label}</strong>
                    <span>{item.sub}</span>
                  </div>
                  {item.amount && <strong className="item-amount">{item.amount}</strong>}
                  <ArrowRight size={14} className="item-arrow" />
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-search-state">
              <FileSearch size={24} className="text-slate-400" />
              <p>No records found matching "{query}"</p>
            </div>
          )}
        </div>

        <div className="search-modal-footer">
          <span>Press <code>ESC</code> to close</span>
          <span>Click any item to view in Settlement Graph or Investigation Register</span>
        </div>
      </div>
    </div>
  )
}
