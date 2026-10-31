import React, { useState } from 'react'
import {
  Activity, AlertCircle, AlertTriangle, ArrowRight, ArrowUpRight,
  Banknote, CheckCircle2, ChevronRight, Clock3, CreditCard,
  Download, FileSpreadsheet, Landmark, PieChart, RefreshCw,
  ShieldAlert, TrendingUp, Wallet, Workflow, Zap,
} from 'lucide-react'

type AnyObj = Record<string, any>

type Props = {
  stats: AnyObj | null
  recon: AnyObj | null
  money: (paise?: number | null) => string
  onNavigateTab: (tabName: any) => void
  onSelectNode: (nodeId: string) => void
  onTriggerScenario: (scenario: any) => void
  loading?: boolean
}

export default function CommandCentre({
  stats,
  recon,
  money,
  onNavigateTab,
  onSelectNode,
  onTriggerScenario,
  loading = false,
}: Props) {
  const [hoveredPoint, setHoveredPoint] = useState<AnyObj | null>(null)

  if (loading || !stats) {
    return (
      <div className="skeleton-grid">
        <div className="skeleton-card" />
        <div className="skeleton-card" />
        <div className="skeleton-card" />
        <div className="skeleton-card" />
      </div>
    )
  }

  const trend = stats.settlement_trend || []
  const maxVolume = Math.max(...trend.map((t: AnyObj) => Number(t.volume_paise || 0)), 1)
  const chartHeight = 140
  const chartWidth = 560

  return (
    <div className="command-centre-layout">
      {/* 1. Header Banner & Scenario Quick Controls */}
      <section className="overview-hero">
        <div className="hero-text">
          <div className="hero-eyebrow">
            <span className="live-dot" />
            MERCHANT SETTLEMENT INTELLIGENCE
          </div>
          <h2>Merchant Command Centre</h2>
          <p>
            Real-time reconciliation proof, connected evidence graph, and exception intelligence for Kirana Merchant Store #001.
          </p>
        </div>
        <div className="hero-quick-scenarios">
          <span className="scenario-label">PRESET AUDIT SCENARIOS:</span>
          <div className="scenario-pill-group">
            <button
              className="scenario-btn baseline"
              title="Activate baseline clean reconciliation"
              onClick={() => onTriggerScenario('scenario_a')}
            >
              <CheckCircle2 size={13} />
              Scenario A (Clean)
            </button>
            <button
              className="scenario-btn variance"
              title="Inject -₹100 bank shortfall discrepancy"
              onClick={() => onTriggerScenario('scenario_b')}
            >
              <AlertTriangle size={13} />
              Scenario B (₹100 Shortfall)
            </button>
            <button
              className="scenario-btn conflict"
              title="Inject unassigned cutoff & unknown fee"
              onClick={() => onTriggerScenario('scenario_c')}
            >
              <AlertCircle size={13} />
              Scenario C (Conflicting Evidence)
            </button>
          </div>
        </div>
      </section>

      {/* 2. Top 6 KPI Cards */}
      <section className="kpi-grid-six">
        <div className="kpi-card">
          <div className="kpi-header">
            <span>Total Payment Volume</span>
            <div className="kpi-icon blue"><Wallet size={16} /></div>
          </div>
          <div className="kpi-value">{stats.total_payment_volume_display}</div>
          <div className="kpi-footer">
            <span className="badge-neutral">{stats.transaction_count} source records</span>
            <span className="kpi-sub">Across all payment channels</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span>Expected Settlement</span>
            <div className="kpi-icon indigo"><Banknote size={16} /></div>
          </div>
          <div className="kpi-value">{stats.expected_settlement_display}</div>
          <div className="kpi-footer">
            <span className="badge-neutral">{stats.matched_transaction_count} assigned</span>
            <span className="kpi-sub">Batch: {stats.target_batch_id}</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span>Actual Bank Credit</span>
            <div className="kpi-icon emerald"><Landmark size={16} /></div>
          </div>
          <div className="kpi-value">{stats.actual_settlement_display}</div>
          <div className="kpi-footer">
            <span className="badge-good">Authoritative UTR</span>
            <span className="kpi-sub">Exact statement match</span>
          </div>
        </div>

        <div className={`kpi-card ${stats.outstanding_residual_paise !== 0 ? 'kpi-danger' : 'kpi-success'}`}>
          <div className="kpi-header">
            <span>Outstanding Variance</span>
            <div className={`kpi-icon ${stats.outstanding_residual_paise !== 0 ? 'danger' : 'emerald'}`}>
              <Activity size={16} />
            </div>
          </div>
          <div className="kpi-value">{stats.outstanding_residual_display}</div>
          <div className="kpi-footer">
            <span className={stats.outstanding_residual_paise !== 0 ? 'badge-bad' : 'badge-good'}>
              {stats.status.replace(/_/g, ' ')}
            </span>
            <span className="kpi-sub">{stats.outstanding_residual_paise === 0 ? 'Zero residual gap' : 'Requires audit'}</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span>Reconciliation Rate</span>
            <div className="kpi-icon cyan"><TrendingUp size={16} /></div>
          </div>
          <div className="kpi-value">{stats.reconciliation_rate_pct}%</div>
          <div className="rate-bar-track">
            <div
              className="rate-bar-fill"
              style={{ width: `${Math.min(stats.reconciliation_rate_pct, 100)}%` }}
            />
          </div>
          <div className="kpi-footer">
            <span className="kpi-sub">{stats.unassigned_transaction_count} unassigned rows</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span>Pending Exceptions</span>
            <div className="kpi-icon amber"><ShieldAlert size={16} /></div>
          </div>
          <div className="kpi-value">{stats.open_exceptions_count}</div>
          <div className="kpi-footer">
            <span className="badge-warn">{stats.pending_investigations_count} open cases</span>
            <button className="kpi-link-btn" onClick={() => onNavigateTab('audit')}>
              Review <ArrowRight size={12} />
            </button>
          </div>
        </div>
      </section>

      {/* 3. Main Analytics Row: Interactive Financial Chart & Payment Channels */}
      <section className="analytics-two-col">
        {/* Trend Chart */}
        <div className="panel chart-panel">
          <div className="panel-header">
            <div className="panel-header-icon"><TrendingUp size={18} /></div>
            <div className="panel-header-text">
              <h3>7-Day Settlement & Payout Trend</h3>
              <p>Daily gross captured volume vs net expected payout vs confirmed bank credits</p>
            </div>
            <div className="chart-legend">
              <span className="legend-item"><span className="legend-dot vol" /> Gross Captured</span>
              <span className="legend-item"><span className="legend-dot exp" /> Expected Net</span>
              <span className="legend-item"><span className="legend-dot act" /> Bank Credit</span>
            </div>
          </div>

          <div className="chart-svg-container">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight + 40}`}
              className="trend-chart-svg"
              preserveAspectRatio="none"
            >
              {/* Grid Lines */}
              {[0.25, 0.5, 0.75, 1].map((pct, i) => (
                <line
                  key={i}
                  x1="30"
                  y1={chartHeight * (1 - pct) + 15}
                  x2={chartWidth - 20}
                  y2={chartHeight * (1 - pct) + 15}
                  stroke="#e2e8f0"
                  strokeDasharray="3 3"
                />
              ))}

              {/* Area fill for Gross Volume */}
              {trend.length > 1 && (
                <polygon
                  points={`
                    30,${chartHeight + 15}
                    ${trend.map((pt: AnyObj, i: number) => {
                      const x = 30 + (i / (trend.length - 1)) * (chartWidth - 50)
                      const y = (chartHeight + 15) - (Number(pt.volume_paise || 0) / maxVolume) * chartHeight
                      return `${x},${y}`
                    }).join(' ')}
                    ${chartWidth - 20},${chartHeight + 15}
                  `}
                  fill="rgba(0, 186, 242, 0.08)"
                />
              )}

              {/* Line for Gross Volume */}
              {trend.length > 1 && (
                <polyline
                  points={trend.map((pt: AnyObj, i: number) => {
                    const x = 30 + (i / (trend.length - 1)) * (chartWidth - 50)
                    const y = (chartHeight + 15) - (Number(pt.volume_paise || 0) / maxVolume) * chartHeight
                    return `${x},${y}`
                  }).join(' ')}
                  fill="none"
                  stroke="#00baf2"
                  strokeWidth="2.5"
                />
              )}

              {/* Line for Bank Credit */}
              {trend.length > 1 && (
                <polyline
                  points={trend.map((pt: AnyObj, i: number) => {
                    const x = 30 + (i / (trend.length - 1)) * (chartWidth - 50)
                    const y = (chartHeight + 15) - (Number(pt.actual_paise || 0) / maxVolume) * chartHeight
                    return `${x},${y}`
                  }).join(' ')}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2"
                  strokeDasharray="4 2"
                />
              )}

              {/* Data points & interaction hit areas */}
              {trend.map((pt: AnyObj, i: number) => {
                const x = 30 + (i / (trend.length - 1)) * (chartWidth - 50)
                const y = (chartHeight + 15) - (Number(pt.volume_paise || 0) / maxVolume) * chartHeight
                const isHovered = hoveredPoint?.date === pt.date
                return (
                  <g key={pt.date} onMouseEnter={() => setHoveredPoint(pt)} onMouseLeave={() => setHoveredPoint(null)}>
                    <circle
                      cx={x}
                      cy={y}
                      r={isHovered ? 6 : 4}
                      fill="#00baf2"
                      stroke="#ffffff"
                      strokeWidth={2}
                      className="chart-dot"
                    />
                    <text
                      x={x}
                      y={chartHeight + 35}
                      textAnchor="middle"
                      fontSize="10"
                      fill="#64748b"
                      fontFamily="Inter, sans-serif"
                    >
                      {pt.date.slice(5)}
                    </text>
                  </g>
                )
              })}
            </svg>

            {hoveredPoint && (
              <div className="chart-tooltip-floating">
                <strong>{hoveredPoint.date}</strong>
                <div>Volume: {money(hoveredPoint.volume_paise)}</div>
                <div>Expected: {money(hoveredPoint.expected_paise)}</div>
                <div>Bank Credit: {money(hoveredPoint.actual_paise)}</div>
                {hoveredPoint.residual_paise !== 0 && (
                  <span className="tooltip-variance">Variance: {money(hoveredPoint.residual_paise)}</span>
                )}
              </div>
            )}
          </div>
          <div className="chart-footer-note">
            <span className="live-badge">Deterministic Calculation</span>
            <span>Amounts converted to integer paise. No floating-point variance.</span>
          </div>
        </div>

        {/* Payment Channels Breakdown */}
        <div className="panel channel-panel">
          <div className="panel-header">
            <div className="panel-header-icon"><PieChart size={18} /></div>
            <div className="panel-header-text">
              <h3>Payment Instrument Share</h3>
              <p>Breakdown across UPI, RuPay Cards, and Wallets</p>
            </div>
          </div>

          <div className="channel-list">
            {(stats.channel_breakdown || []).map((ch: AnyObj) => (
              <div className="channel-item" key={ch.channel}>
                <div className="channel-top">
                  <div className="channel-name">
                    <CreditCard size={14} className="channel-icon" />
                    <strong>{ch.channel.replace(/_/g, ' ')}</strong>
                    <span className="count-sub">({ch.count} txns)</span>
                  </div>
                  <div className="channel-amounts">
                    <strong>{ch.volume_display}</strong>
                    <span className="pct-badge">{ch.percentage_pct}%</span>
                  </div>
                </div>
                <div className="channel-progress-track">
                  <div
                    className="channel-progress-fill"
                    style={{ width: `${ch.percentage_pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="channel-quick-stat">
            <div className="stat-box">
              <span className="stat-label">Primary Route</span>
              <strong>UPI Direct / QR</strong>
              <small>91.5% Settlement Volume</small>
            </div>
            <div className="stat-box">
              <span className="stat-label">Avg Transaction</span>
              <strong>₹370.62</strong>
              <small>Across 143 total payments</small>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Lower Intelligence Row: Exceptions Distribution & Quick Actions */}
      <section className="analytics-two-col lower-row">
        {/* Exception Intelligence */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-header-icon"><AlertTriangle size={18} /></div>
            <div className="panel-header-text">
              <h3>Exception Intelligence & Ageing</h3>
              <p>Root-cause classification of settlement variances and disputes</p>
            </div>
          </div>

          <div className="exception-list-container">
            {(stats.exception_distribution || []).length > 0 ? (
              (stats.exception_distribution || []).map((ex: AnyObj, i: number) => (
                <div className="exception-intel-row" key={i}>
                  <div className={`intel-severity ${ex.severity.toLowerCase()}`}>
                    {ex.severity === 'CRITICAL' ? <AlertCircle size={15} /> : <AlertTriangle size={15} />}
                  </div>
                  <div className="intel-content">
                    <strong>{ex.category}</strong>
                    <span>{ex.count} incident(s) flagged · Total impact: <b>{ex.amount_display}</b></span>
                  </div>
                  <button
                    className="secondary-button compact"
                    onClick={() => onNavigateTab('evidence')}
                  >
                    Trace <ArrowUpRight size={12} />
                  </button>
                </div>
              ))
            ) : (
              <div className="empty-exceptions">
                <CheckCircle2 size={24} className="text-emerald-500" />
                <p>No active settlement exceptions. All batch references reconcile.</p>
              </div>
            )}
          </div>

          <div className="ageing-header">
            <span>UNRESOLVED EXCEPTION AGEING</span>
          </div>
          <div className="ageing-grid">
            {(stats.ageing_analysis || []).map((a: AnyObj, i: number) => (
              <div className="ageing-card" key={i}>
                <span className="ageing-bracket">{a.bracket}</span>
                <strong className="ageing-count">{a.count} cases</strong>
                <small className="ageing-amount">{a.amount_display}</small>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Operations & Workflows */}
        <div className="panel quick-actions-panel">
          <div className="panel-header">
            <div className="panel-header-icon"><Zap size={18} /></div>
            <div className="panel-header-text">
              <h3>Merchant Quick Actions</h3>
              <p>One-click audit actions, reconciliation runs, and evidence investigation</p>
            </div>
          </div>

          <div className="quick-actions-grid">
            <button className="quick-action-tile" onClick={() => onNavigateTab('reconcile')}>
              <div className="tile-icon blue"><FileSpreadsheet size={18} /></div>
              <div className="tile-body">
                <strong>Reconciliation Studio</strong>
                <span>Import CSVs, column mapping, and transaction validation</span>
              </div>
              <ChevronRight size={16} className="tile-arrow" />
            </button>

            <button className="quick-action-tile" onClick={() => onNavigateTab('evidence')}>
              <div className="tile-icon indigo"><Workflow size={18} /></div>
              <div className="tile-body">
                <strong>Interactive Settlement Graph</strong>
                <span>Trace relationships from merchant down to bank credit</span>
              </div>
              <ChevronRight size={16} className="tile-arrow" />
            </button>

            <button className="quick-action-tile" onClick={() => onNavigateTab('audit')}>
              <div className="tile-icon purple"><Clock3 size={18} /></div>
              <div className="tile-body">
                <strong>Investigation Workspace</strong>
                <span>Review discrepancy notes, approve resolution & audit log</span>
              </div>
              <ChevronRight size={16} className="tile-arrow" />
            </button>

            <button className="quick-action-tile" onClick={() => onNavigateTab('operations')}>
              <div className="tile-icon emerald"><CreditCard size={18} /></div>
              <div className="tile-body">
                <strong>Counter Operations</strong>
                <span>Duplicate debit shield & POS sync verification</span>
              </div>
              <ChevronRight size={16} className="tile-arrow" />
            </button>

            <button className="quick-action-tile" onClick={() => onNavigateTab('vendor')}>
              <div className="tile-icon amber"><Wallet size={18} /></div>
              <div className="tile-body">
                <strong>Vendor & Exceptions Desk</strong>
                <span>MSMED statutory terms, Kirana breakdown, and RBI TAT</span>
              </div>
              <ChevronRight size={16} className="tile-arrow" />
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
