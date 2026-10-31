import React from 'react'
import {
  AlertCircle, AlertTriangle, CheckCircle2, ChevronRight,
  Info, RefreshCw, ShieldAlert, Sparkles,
} from 'lucide-react'

type Props = {
  activeScenario: 'A' | 'B' | 'C' | 'CUSTOM'
  onSelectScenario: (scenario: 'scenario_a' | 'scenario_b' | 'scenario_c') => void
  onOpenResetModal: () => void
  isSimulated: boolean
}

export default function DemoBanner({
  activeScenario,
  onSelectScenario,
  onOpenResetModal,
  isSimulated,
}: Props) {
  return (
    <div className="demo-mode-top-banner">
      <div className="banner-left">
        <span className="demo-mode-badge">
          <span className="pulse-dot" /> DEMO MODE
        </span>
        <span className="banner-title">
          Synthetic Merchant Operational Dataset · No Live Money Movement
        </span>
      </div>

      <div className="banner-scenarios">
        <span className="scenarios-title">AUDIT SCENARIOS:</span>

        <button
          className={`scenario-pill ${activeScenario === 'A' ? 'active' : ''}`}
          onClick={() => onSelectScenario('scenario_a')}
          title="Scenario A: Clean reconciliation with 100% match and zero variance"
        >
          <CheckCircle2 size={13} />
          <strong>Scenario A</strong>
          <span>Normal Payout</span>
        </button>

        <button
          className={`scenario-pill ${activeScenario === 'B' ? 'active' : ''}`}
          onClick={() => onSelectScenario('scenario_b')}
          title="Scenario B: ₹100 bank shortfall and fee variance discrepancy"
        >
          <AlertTriangle size={13} />
          <strong>Scenario B</strong>
          <span>Discrepancy</span>
        </button>

        <button
          className={`scenario-pill ${activeScenario === 'C' ? 'active' : ''}`}
          onClick={() => onSelectScenario('scenario_c')}
          title="Scenario C: Missing cutoff reference & unclassified fee adjustment"
        >
          <AlertCircle size={13} />
          <strong>Scenario C</strong>
          <span>Conflict / Missing</span>
        </button>
      </div>

      <div className="banner-right">
        <button
          className="reset-demo-button"
          onClick={onOpenResetModal}
          title="Reset to clean baseline dataset"
        >
          <RefreshCw size={12} /> Reset Demo Data
        </button>
      </div>
    </div>
  )
}

