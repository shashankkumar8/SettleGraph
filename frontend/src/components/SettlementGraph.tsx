import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity, AlertCircle, AlertTriangle, ArrowRight, CheckCircle2,
  Copy, Eye, Filter, Fingerprint, GitBranch, Layers, Maximize2,
  Network, RotateCcw, Search, ShieldAlert, Sparkles, X,
  ZoomIn, ZoomOut,
} from 'lucide-react'

type AnyObj = Record<string, any>

type Props = {
  graphData: AnyObj | null
  selectedNodeId: string
  onSelectNode: (nodeId: string) => void
  onCreateInvestigation: (nodeId: string, defaultNote?: string) => void
  onTraceNode: (nodeId: string) => void
  money: (paise?: number | null) => string
  loading?: boolean
}

const ENTITY_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  merchant: { label: 'Merchant', color: '#0f172a', bg: '#f1f5f9', border: '#cbd5e1' },
  settlement_batch: { label: 'Settlement Batch', color: '#007ea9', bg: '#e8f8fe', border: '#b8e9fb' },
  payment: { label: 'Payment', color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
  settlement_line: { label: 'Settlement Line', color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd' },
  bank_credit: { label: 'Bank Credit', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
  adjustment: { label: 'Adjustment / Fee', color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  order: { label: 'Order', color: '#6d28d9', bg: '#f5f3ff', border: '#ddd6fe' },
  evidence: { label: 'Dispute Evidence', color: '#0f766e', bg: '#f0fdfa', border: '#99f6e4' },
  exception: { label: 'Exception Flag', color: '#b91c1c', bg: '#fef2f2', border: '#fecaca' },
  investigation: { label: 'Investigation', color: '#a21caf', bg: '#fdf4ff', border: '#f5d0fe' },
  operator_decision: { label: 'Operator Decision', color: '#334155', bg: '#f8fafc', border: '#cbd5e1' },
}

export default function SettlementGraph({
  graphData,
  selectedNodeId,
  onSelectNode,
  onCreateInvestigation,
  onTraceNode,
  money,
  loading = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(0.85)
  const [pan, setPan] = useState({ x: 80, y: 40 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [searchQuery, setSearchQuery] = useState('')
  const [hoveredNode, setHoveredNode] = useState<AnyObj | null>(null)
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set(Object.keys(ENTITY_CONFIG)))
  const [highlightAnomaliesOnly, setHighlightAnomaliesOnly] = useState(false)
  const [copied, setCopied] = useState(false)

  const nodes: AnyObj[] = useMemo(() => graphData?.nodes || [], [graphData])
  const edges: AnyObj[] = useMemo(() => graphData?.edges || [], [graphData])

  // Multi-tier layered layout positioning
  const layout = useMemo(() => {
    const tierMap: Record<string, number> = {
      merchant: 0,
      settlement_batch: 1,
      payment: 2,
      settlement_line: 2.5,
      order: 3,
      bank_credit: 4,
      adjustment: 3.5,
      evidence: 4.5,
      exception: 3.8,
      investigation: 5,
      operator_decision: 5.5,
    }

    const tiers: Record<number, AnyObj[]> = {}
    nodes.forEach(node => {
      const t = tierMap[node.node_type] ?? 2
      if (!tiers[t]) tiers[t] = []
      tiers[t].push(node)
    })

    const positions: Record<string, { x: number; y: number; tier: number }> = {}
    const colSpacing = 320
    const rowSpacing = 85

    Object.keys(tiers)
      .map(Number)
      .sort((a, b) => a - b)
      .forEach((tierKey, colIndex) => {
        const tierNodes = tiers[tierKey]
        const totalHeight = (tierNodes.length - 1) * rowSpacing
        const startY = Math.max(60, 400 - totalHeight / 2)

        tierNodes.forEach((node, rowIndex) => {
          positions[node.id] = {
            x: 60 + colIndex * colSpacing,
            y: startY + rowIndex * rowSpacing,
            tier: tierKey,
          }
        })
      })

    return positions
  }, [nodes])

  // Filtered nodes based on active entity filters and search query
  const visibleNodes = useMemo(() => {
    return nodes.filter(node => {
      if (!activeFilters.has(node.node_type)) return false
      if (highlightAnomaliesOnly && !['exception', 'evidence', 'investigation'].includes(node.node_type)) {
        if (!node.id.includes('FAULT') && !node.id.includes('UNKNOWN') && node.details?.status !== 'PENDING') {
          return false
        }
      }
      return true
    })
  }, [nodes, activeFilters, highlightAnomaliesOnly])

  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map(n => n.id)), [visibleNodes])

  const visibleEdges = useMemo(() => {
    return edges.filter(e => visibleNodeIds.has(e.from) && visibleNodeIds.has(e.to))
  }, [edges, visibleNodeIds])

  // Connected nodes & edges for the currently selected node
  const connectedInfo = useMemo(() => {
    if (!selectedNodeId) return { nodeIds: new Set<string>(), edgeIds: new Set<string>() }
    const connectedNodes = new Set<string>([selectedNodeId])
    const connectedEdges = new Set<string>()

    edges.forEach(e => {
      if (e.from === selectedNodeId) {
        connectedNodes.add(e.to)
        connectedEdges.add(`${e.from}->${e.to}`)
      }
      if (e.to === selectedNodeId) {
        connectedNodes.add(e.from)
        connectedEdges.add(`${e.from}->${e.to}`)
      }
    })

    return { nodeIds: connectedNodes, edgeIds: connectedEdges }
  }, [selectedNodeId, edges])

  // Current selected node object
  const activeNode = useMemo(() => {
    return nodes.find(n => n.id === selectedNodeId) || nodes[0] || null
  }, [nodes, selectedNodeId])

  // Drag and pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.graph-node-card') || (e.target as HTMLElement).closest('.graph-controls')) return
    setIsDragging(true)
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92
    setZoom(z => Math.max(0.35, Math.min(2.2, z * zoomFactor)))
  }

  const resetView = () => {
    setZoom(0.85)
    setPan({ x: 80, y: 40 })
  }

  const toggleFilter = (type: string) => {
    setActiveFilters(prev => {
      const next = new Set(prev)
      if (next.has(type)) {
        if (next.size > 1) next.delete(type)
      } else {
        next.add(type)
      }
      return next
    })
  }

  const selectAllFilters = () => {
    setActiveFilters(new Set(Object.keys(ENTITY_CONFIG)))
  }

  const copyId = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const jumpToNode = (id: string) => {
    onSelectNode(id)
    const pos = layout[id]
    if (pos) {
      setPan({ x: 260 - pos.x * zoom, y: 240 - pos.y * zoom })
    }
  }

  // Filtered search suggestions
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return []
    return nodes.filter(n =>
      n.id.toLowerCase().includes(q) ||
      (n.label && n.label.toLowerCase().includes(q)) ||
      (n.details?.order_id && String(n.details.order_id).toLowerCase().includes(q)) ||
      (n.details?.utr_rrn && String(n.details.utr_rrn).toLowerCase().includes(q))
    ).slice(0, 8)
  }, [nodes, searchQuery])

  if (loading && !graphData) {
    return <div className="startup"><Activity className="spin" size={24} /><p>Synthesizing Settlement Graph...</p></div>
  }

  return (
    <div className="settlement-graph-workspace">
      {/* 1. Top Control Bar */}
      <div className="graph-toolbar">
        <div className="toolbar-left">
          <div className="search-wrap">
            <Search size={14} className="search-icon" />
            <input
              type="text"
              placeholder="Search Payment ID, Order, UTR, Batch, Node..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="clear-search" onClick={() => setSearchQuery('')}>
                <X size={12} />
              </button>
            )}

            {searchResults.length > 0 && (
              <div className="search-dropdown">
                {searchResults.map(result => (
                  <button
                    key={result.id}
                    className="search-result-item"
                    onClick={() => {
                      jumpToNode(result.id)
                      setSearchQuery('')
                    }}
                  >
                    <span className="res-type">{result.node_type}</span>
                    <strong className="res-id">{result.id}</strong>
                    {result.details?.amount_display && (
                      <span className="res-amt">{result.details.amount_display}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            className={`anomaly-toggle-btn ${highlightAnomaliesOnly ? 'active' : ''}`}
            onClick={() => setHighlightAnomaliesOnly(!highlightAnomaliesOnly)}
            title="Filter to show only exceptions, disputes and anomalies"
          >
            <ShieldAlert size={14} />
            {highlightAnomaliesOnly ? 'Showing Anomalies' : 'Highlight Exceptions'}
          </button>
        </div>

        {/* Entity Type Filter Badges */}
        <div className="toolbar-center">
          <button className="filter-pill all-pill" onClick={selectAllFilters}>
            All ({nodes.length})
          </button>
          {Object.entries(ENTITY_CONFIG).map(([key, cfg]) => {
            const count = nodes.filter(n => n.node_type === key).length
            if (count === 0) return null
            const isActive = activeFilters.has(key)
            return (
              <button
                key={key}
                className={`filter-pill ${isActive ? 'active' : 'inactive'}`}
                style={{
                  borderColor: isActive ? cfg.border : '#e2e8f0',
                  background: isActive ? cfg.bg : '#ffffff',
                  color: isActive ? cfg.color : '#94a3b8',
                }}
                onClick={() => toggleFilter(key)}
              >
                {cfg.label} <small>({count})</small>
              </button>
            )
          })}
        </div>

        {/* Zoom & Canvas Controls */}
        <div className="toolbar-right">
          <button className="icon-btn" onClick={() => setZoom(z => Math.min(2.2, z * 1.15))} title="Zoom In">
            <ZoomIn size={15} />
          </button>
          <button className="icon-btn" onClick={() => setZoom(z => Math.max(0.35, z * 0.85))} title="Zoom Out">
            <ZoomOut size={15} />
          </button>
          <button className="icon-btn" onClick={resetView} title="Reset View">
            <RotateCcw size={15} />
          </button>
          <span className="zoom-label">{Math.round(zoom * 100)}%</span>
        </div>
      </div>

      {/* 2. Interactive SVG Graph Canvas & Slide-Over Panel */}
      <div
        className="graph-canvas-wrapper"
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        <svg className="graph-svg" width="100%" height="100%">
          <defs>
            <marker
              id="arrow-regular"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#94a3b8" />
            </marker>
            <marker
              id="arrow-highlight"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#00baf2" />
            </marker>
            <marker
              id="arrow-anomaly"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#ef4444" />
            </marker>
          </defs>

          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {/* Draw Edges */}
            {visibleEdges.map(edge => {
              const fromPos = layout[edge.from]
              const toPos = layout[edge.to]
              if (!fromPos || !toPos) return null

              const edgeKey = `${edge.from}->${edge.to}`
              const isSelectedEdge = connectedInfo.edgeIds.has(edgeKey)
              const isDimmed = selectedNodeId && !isSelectedEdge
              const isAnomaly = edge.relation?.includes('EXCEPTION') || edge.relation?.includes('CONFLICT')

              // Bezier control points for smooth curving
              const dx = toPos.x - fromPos.x
              const c1x = fromPos.x + dx * 0.45
              const c1y = fromPos.y
              const c2x = fromPos.x + dx * 0.55
              const c2y = toPos.y

              const pathData = `M ${fromPos.x + 90} ${fromPos.y + 20} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${toPos.x - 10} ${toPos.y + 20}`
              const midX = (fromPos.x + 90 + toPos.x - 10) / 2
              const midY = (fromPos.y + toPos.y + 40) / 2

              return (
                <g key={edgeKey} opacity={isDimmed ? 0.2 : 1}>
                  <path
                    d={pathData}
                    fill="none"
                    stroke={isAnomaly ? '#ef4444' : isSelectedEdge ? '#00baf2' : '#cbd5e1'}
                    strokeWidth={isSelectedEdge ? 2.5 : isAnomaly ? 2 : 1.5}
                    strokeDasharray={isAnomaly ? '4 3' : 'none'}
                    markerEnd={isAnomaly ? 'url(#arrow-anomaly)' : isSelectedEdge ? 'url(#arrow-highlight)' : 'url(#arrow-regular)'}
                  />
                  {isSelectedEdge && edge.relation && (
                    <text
                      x={midX}
                      y={midY - 8}
                      textAnchor="middle"
                      className="edge-label-text"
                    >
                      {edge.relation.replace(/_/g, ' ')}
                    </text>
                  )}
                </g>
              )
            })}

            {/* Draw Nodes */}
            {visibleNodes.map(node => {
              const pos = layout[node.id]
              if (!pos) return null

              const isSelected = selectedNodeId === node.id
              const isConnected = connectedInfo.nodeIds.has(node.id)
              const isDimmed = selectedNodeId && !isConnected && !isSelected
              const cfg = ENTITY_CONFIG[node.node_type] || ENTITY_CONFIG.payment
              const isAnomaly = node.node_type === 'exception'

              return (
                <g
                  key={node.id}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  opacity={isDimmed ? 0.22 : 1}
                  className="graph-node-group"
                  onClick={e => {
                    e.stopPropagation()
                    onSelectNode(node.id)
                  }}
                  onMouseEnter={() => setHoveredNode(node)}
                  onMouseLeave={() => setHoveredNode(null)}
                >
                  {/* Selection glow */}
                  {isSelected && (
                    <rect
                      x="-6"
                      y="-6"
                      width="212"
                      height="58"
                      rx="10"
                      fill="none"
                      stroke="#00baf2"
                      strokeWidth="3"
                      strokeOpacity="0.8"
                    />
                  )}

                  {/* Node Capsule Background */}
                  <rect
                    x="0"
                    y="0"
                    width="200"
                    height="46"
                    rx="8"
                    fill="#ffffff"
                    stroke={isSelected ? '#00baf2' : isAnomaly ? '#ef4444' : cfg.border}
                    strokeWidth={isSelected || isAnomaly ? 2 : 1}
                    className="node-rect"
                  />

                  {/* Left Color Accent Bar */}
                  <rect
                    x="0"
                    y="0"
                    width="6"
                    height="46"
                    rx="3"
                    fill={cfg.color}
                  />

                  {/* Entity Type Label */}
                  <text x="14" y="15" className="node-type-label" fill={cfg.color}>
                    {cfg.label.toUpperCase()}
                  </text>

                  {/* Node Main ID */}
                  <text x="14" y="32" className="node-id-label">
                    {node.label || node.id}
                  </text>

                  {/* Amount Badge */}
                  {node.details?.amount_display && (
                    <text x="190" y="32" textAnchor="end" className="node-amount-label">
                      {node.details.amount_display}
                    </text>
                  )}
                </g>
              )
            })}
          </g>
        </svg>

        {/* Hover Tooltip */}
        {hoveredNode && (
          <div
            className="node-hover-tooltip"
            style={{
              left: `${pan.x + (layout[hoveredNode.id]?.x || 0) * zoom}px`,
              top: `${pan.y + (layout[hoveredNode.id]?.y || 0) * zoom - 60}px`,
            }}
          >
            <span className="tooltip-type">{hoveredNode.node_type}</span>
            <strong>{hoveredNode.label || hoveredNode.id}</strong>
            {hoveredNode.details?.amount_display && (
              <span>Amount: {hoveredNode.details.amount_display}</span>
            )}
            {hoveredNode.details?.source_row_id && (
              <small>Source: {hoveredNode.details.source_row_id}</small>
            )}
          </div>
        )}
      </div>

      {/* 3. Slide-Over Detail Drawer for Selected Node */}
      {activeNode && (
        <aside className="node-detail-drawer">
          <div className="drawer-header">
            <div className="drawer-type-badge" style={{ background: ENTITY_CONFIG[activeNode.node_type]?.bg, color: ENTITY_CONFIG[activeNode.node_type]?.color }}>
              {ENTITY_CONFIG[activeNode.node_type]?.label || activeNode.node_type}
            </div>
            <button className="icon-btn close-drawer" onClick={() => onSelectNode('')} aria-label="Close detail panel">
              <X size={15} />
            </button>
          </div>

          <div className="drawer-body">
            <div className="drawer-title-row">
              <h3>{activeNode.label || activeNode.id}</h3>
              <button
                className="copy-btn"
                onClick={() => copyId(activeNode.id)}
                title="Copy Node ID"
              >
                <Copy size={13} />
                {copied ? 'Copied' : 'Copy ID'}
              </button>
            </div>

            {/* Quick Actions on this node */}
            <div className="drawer-actions">
              <button
                className="primary-button wide"
                onClick={() => onCreateInvestigation(activeNode.id, `Investigate node ${activeNode.id} (${activeNode.node_type})`)}
              >
                <ShieldAlert size={14} /> Open Investigation
              </button>

              <button
                className="secondary-button wide"
                onClick={() => onTraceNode(activeNode.id)}
              >
                <GitBranch size={14} /> Trace Path to Bank
              </button>
            </div>

            {/* Metadata Table */}
            <div className="drawer-section">
              <h4>Entity Metadata</h4>
              <div className="metadata-table">
                <div className="meta-row">
                  <span>Node ID</span>
                  <code>{activeNode.id}</code>
                </div>
                <div className="meta-row">
                  <span>Entity Type</span>
                  <b>{activeNode.node_type}</b>
                </div>
                {Object.entries(activeNode.details || {}).map(([key, val]) => (
                  <div className="meta-row" key={key}>
                    <span>{key.replace(/_/g, ' ')}</span>
                    <b>{val == null ? '—' : String(val)}</b>
                  </div>
                ))}
              </div>
            </div>

            {/* Direct Connections List */}
            <div className="drawer-section">
              <h4>Connected Relationships ({connectedInfo.nodeIds.size - 1})</h4>
              <div className="connected-nodes-list">
                {edges
                  .filter(e => e.from === activeNode.id || e.to === activeNode.id)
                  .map(edge => {
                    const isOutgoing = edge.from === activeNode.id
                    const targetId = isOutgoing ? edge.to : edge.from
                    const targetNode = nodes.find(n => n.id === targetId)
                    return (
                      <div
                        className="connected-node-card"
                        key={`${edge.from}-${edge.to}`}
                        onClick={() => jumpToNode(targetId)}
                      >
                        <div className="conn-edge-relation">
                          {isOutgoing ? '↳ OUT: ' : '↵ IN: '}
                          {edge.relation?.replace(/_/g, ' ')}
                        </div>
                        <div className="conn-target-id">
                          <strong>{targetNode?.label || targetId}</strong>
                          <span className="conn-target-type">{targetNode?.node_type}</span>
                        </div>
                        {edge.match_rule && <small className="conn-match-rule">{edge.match_rule}</small>}
                      </div>
                    )
                  })}
              </div>
            </div>
          </div>
        </aside>
      )}
    </div>
  )
}

