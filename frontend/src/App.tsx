import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import VendorTab from './VendorTab'
import CommandCentre from './components/CommandCentre'
import SettlementGraph from './components/SettlementGraph'
import ReconciliationStudio from './components/ReconciliationStudio'
import InvestigationWorkspace from './components/InvestigationWorkspace'
import GlobalSearchModal from './components/GlobalSearchModal'
import ConfirmationModal from './components/ConfirmationModal'
import DemoBanner from './components/DemoBanner'
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowRight, Banknote,
  CheckCircle2, ChevronRight, CircleHelp, Clock3, Download, FileSearch,
  FileText, Fingerprint, GitBranch, Landmark, LoaderCircle, Network, RefreshCw,
  Search, ShieldAlert, ShieldCheck, Wallet, Workflow, XCircle, Bot, Mic, MessageSquare, Volume2,
  ClipboardList, CreditCard, Check, Radio, StopCircle, LayoutDashboard,
  FileSpreadsheet, HelpCircle,
} from 'lucide-react'

const API = (import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? 'https://settlegraph-api-shashank.onrender.com/api' : '/api')).replace(/\/+$/, '')

export type Tab = 'dashboard' | 'reconcile' | 'evidence' | 'audit' | 'operations' | 'safety' | 'vendor' | 'agent'
type AnyObj = Record<string, any>

export type SimOptions = {
  bank_credit_delta_paise: number
  adjustment_delta_paise: number
  inject_unknown_adjustment: boolean
  unassign_late_transaction: boolean
}

const defaultOptions: SimOptions = {
  bank_credit_delta_paise: 0,
  adjustment_delta_paise: 0,
  inject_unknown_adjustment: false,
  unassign_late_transaction: false,
}

export function money(paise: number | undefined | null): string {
  if (paise == null) return '—'
  if (!Number.isSafeInteger(paise)) return 'Amount exceeds safe display range'
  const value = BigInt(paise)
  const sign = value < 0n ? '−' : ''
  const abs = value < 0n ? -value : value
  const rupees = (abs / 100n).toLocaleString('en-IN')
  const cents = String(abs % 100n).padStart(2, '0')
  return `${sign}₹${rupees}.${cents}`
}

export function parseInrToPaise(raw: string): number {
  const value = raw.trim().replace(/,/g, '')
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) {
    throw new Error('Enter a non-negative amount with at most two decimal places.')
  }
  const [rupees, fraction = ''] = value.split('.')
  const paise = BigInt(rupees) * 100n + BigInt((fraction + '00').slice(0, 2))
  if (paise > 9223372036854775807n) throw new Error('Amount exceeds the signed 64-bit paise range.')
  if (paise > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Amount exceeds safe integer range.')
  return Number(paise)
}

export function stamp(value?: string) {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

export function shortHash(hash?: string) {
  if (!hash) return 'Not available'
  return `${hash.slice(0, 16)}…${hash.slice(-8)}`
}

export function statusClass(status?: string) {
  if (status === 'RECONCILED' || status === 'READY_FOR_HUMAN_REVIEW' || status === 'RESOLVED') return 'status-good'
  if (status === 'NEEDS_REVIEW' || status === 'NEEDS_MERCHANT_PROOF' || status === 'PENDING_HUMAN_APPROVAL_REFUND' || status === 'OPEN') return 'status-warn'
  if (status === 'UNEXPLAINED_VARIANCE' || status === 'INCOMPLETE_OR_UNMATCHED' || status === 'HALTED_EVIDENCE_CONFLICT' || status === 'REJECTED') return 'status-bad'
  return 'status-neutral'
}

export default function App() {
  // Tab routing with URL hash persistence
  const initialTab = useMemo<Tab>(() => {
    const hash = window.location.hash.replace('#', '') as Tab
    const validTabs: Tab[] = ['dashboard', 'reconcile', 'evidence', 'audit', 'operations', 'safety', 'vendor', 'agent']
    return validTabs.includes(hash) ? hash : 'dashboard'
  }, [])

  const [tab, setTabState] = useState<Tab>(initialTab)

  const setTab = useCallback((nextTab: Tab) => {
    setTabState(nextTab)
    window.location.hash = nextTab
  }, [])

  // Core data states
  const [health, setHealth] = useState<AnyObj | null>(null)
  const [dashboardStats, setDashboardStats] = useState<AnyObj | null>(null)
  const [integrationStatus, setIntegrationStatus] = useState<AnyObj | null>(null)
  const [sarvamTestBusy, setSarvamTestBusy] = useState(false)
  const [recon, setRecon] = useState<AnyObj | null>(null)
  const [transactions, setTransactions] = useState<AnyObj[]>([])
  const [adjustments, setAdjustments] = useState<AnyObj[]>([])
  const [graphOverview, setGraphOverview] = useState<AnyObj | null>(null)
  const [selectedNode, setSelectedNode] = useState('MERCHANT:PAYTM_STORE_001')
  const [trace, setTrace] = useState<AnyObj | null>(null)
  const [investigations, setInvestigations] = useState<AnyObj[]>([])
  const [audit, setAudit] = useState<AnyObj[]>([])
  const [options, setOptions] = useState<SimOptions>(defaultOptions)
  const [activeScenario, setActiveScenario] = useState<'A' | 'B' | 'C' | 'CUSTOM'>('A')

  // UI state
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [importing, setImporting] = useState(false)
  const [targetCaptureDate, setTargetCaptureDate] = useState('2026-10-26')
  const [targetBatchId, setTargetBatchId] = useState('BATCH-2026-10-27')
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isResetModalOpen, setIsResetModalOpen] = useState(false)

  // Staged import states
  const [rawPreview, setRawPreview] = useState<AnyObj | null>(null)
  const [rawPreviewing, setRawPreviewing] = useState(false)
  const [rawPreviewFile, setRawPreviewFile] = useState<File | null>(null)
  const [rawCaptureDate, setRawCaptureDate] = useState('2026-10-26')
  const [rawBatchId, setRawBatchId] = useState('BATCH-2026-10-27')
  const [rawPayoutUtr, setRawPayoutUtr] = useState('')
  const [rawPayoutDate, setRawPayoutDate] = useState('2026-10-27')
  const [rawMappingAcknowledged, setRawMappingAcknowledged] = useState(false)
  const [rawStaging, setRawStaging] = useState(false)
  const [rawStaged, setRawStaged] = useState<AnyObj[]>([])

  // Operations & Approvals
  const [operations, setOperations] = useState<AnyObj | null>(null)
  const [opsBusy, setOpsBusy] = useState(false)
  const [duplicateResult, setDuplicateResult] = useState<AnyObj | null>(null)
  const [approvals, setApprovals] = useState<AnyObj[]>([])
  const [posOrders, setPosOrders] = useState<AnyObj[]>([])

  // Safety & Disputes
  const [caseId, setCaseId] = useState('')
  const [disputeCases, setDisputeCases] = useState<AnyObj[]>([])
  const [faults, setFaults] = useState({ corrupt_otp: false, inject_amount_mismatch: false, inject_courier_conflict: false, force_duplicate_debit: false })
  const [disputeEval, setDisputeEval] = useState<AnyObj | null>(null)
  const [utr, setUtr] = useState('629810445566')
  const [utrAmount, setUtrAmount] = useState('4500.00')
  const [utrResult, setUtrResult] = useState<AnyObj | null>(null)

  // AI Teammate & Voice
  const [agentPrompt, setAgentPrompt] = useState('My payout looks short. Explain the loaded settlement.')
  const [agentChat, setAgentChat] = useState<AnyObj | null>(null)
  const [chatting, setChatting] = useState(false)
  const [agentRun, setAgentRun] = useState<AnyObj | null>(null)
  const [agentRunning, setAgentRunning] = useState(false)
  const [voiceBusy, setVoiceBusy] = useState(false)
  const [voiceTranscript, setVoiceTranscript] = useState('')
  const [voiceLanguageCode, setVoiceLanguageCode] = useState('')
  const [spokenReference, setSpokenReference] = useState('')
  const [bindingResult, setBindingResult] = useState<AnyObj | null>(null)
  const [voiceAudioUrl, setVoiceAudioUrl] = useState('')
  const [voiceMode, setVoiceMode] = useState('')
  const [recording, setRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const recordingStartedAtRef = useRef(0)
  const recordingTickRef = useRef<number | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaChunksRef = useRef<BlobPart[]>([])
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const retryTimerRef = useRef<number | null>(null)
  const retryCountRef = useRef(0)

  const request = useCallback(async (path: string, init?: RequestInit) => {
    const res = await fetch(`${API}${path}`, init)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.detail || `Request failed (${res.status})`)
    }
    return res.json()
  }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [
        h, stats, r, t, a, g, i, au, source, ops, approvalRows, orderRows, stagedRows, disputeSource, integrations
      ] = await Promise.all([
        request('/health'),
        request('/dashboard/stats'),
        request('/demo/reconcile'),
        request('/demo/transactions'),
        request('/demo/adjustments'),
        request('/graph/overview'),
        request('/investigations'),
        request('/audit'),
        request('/import/status'),
        request('/operations/demo'),
        request('/approvals'),
        request('/operations/pos-orders'),
        request('/import/staged-paytm-exports'),
        request('/disputes'),
        request('/integrations/status'),
      ])
      setHealth(h)
      setDashboardStats(stats)
      setRecon(r)
      setTransactions(t)
      setAdjustments(a)
      setGraphOverview(g)
      setInvestigations(i)
      setAudit(au)
      setOperations(ops)
      setApprovals(approvalRows)
      setPosOrders(orderRows)
      setRawStaged(stagedRows)
      setIntegrationStatus(integrations)
      setDisputeCases(disputeSource.cases || [])
      setCaseId((current: string) => disputeSource.cases?.some((row: AnyObj) => row.case_id === current) ? current : (disputeSource.cases?.[0]?.case_id || ''))
      setTargetCaptureDate(source.capture_date)
      setTargetBatchId(source.batch_id)

      if (r.residual_paise === 0) {
        setActiveScenario('A')
      } else {
        setActiveScenario('B')
      }
      retryCountRef.current = 0
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'Could not connect to the backend API'
      setError(errMsg)
      if (retryCountRef.current < 4) {
        retryCountRef.current += 1
        retryTimerRef.current = window.setTimeout(() => {
          void loadAll()
        }, 2500)
      }
    } finally {
      setLoading(false)
    }
  }, [request])

  useEffect(() => { void loadAll() }, [loadAll])

  useEffect(() => () => {
    if (voiceAudioUrl) URL.revokeObjectURL(voiceAudioUrl)
  }, [voiceAudioUrl])

  useEffect(() => () => {
    if (recordingTickRef.current !== null) window.clearInterval(recordingTickRef.current)
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop()
    mediaStreamRef.current?.getTracks().forEach(track => track.stop())
  }, [])

  // Graph query string
  const graphQuery = useMemo(() => new URLSearchParams({
    bank_credit_delta_paise: String(options.bank_credit_delta_paise),
    adjustment_delta_paise: String(options.adjustment_delta_paise),
    inject_unknown_adjustment: String(options.inject_unknown_adjustment),
    unassign_late_transaction: String(options.unassign_late_transaction),
  }).toString(), [options])

  // Trace selected node
  useEffect(() => {
    if (!selectedNode) return
    request(`/graph/trace/${encodeURIComponent(selectedNode)}?${graphQuery}`)
      .then(setTrace).catch(() => setTrace(null))
  }, [selectedNode, request, graphQuery])

  // Trigger Scenario switcher
  const triggerScenario = async (scenarioKey: 'scenario_a' | 'scenario_b' | 'scenario_c') => {
    setRunning(true)
    setError('')
    try {
      const res = await request(`/demo/scenario/${scenarioKey}`, { method: 'POST' })
      setRecon(res.reconciliation)
      setOptions(res.options)
      setActiveScenario(res.scenario)
      const q = new URLSearchParams({
        bank_credit_delta_paise: String(res.options.bank_credit_delta_paise),
        adjustment_delta_paise: String(res.options.adjustment_delta_paise),
        inject_unknown_adjustment: String(res.options.inject_unknown_adjustment),
        unassign_late_transaction: String(res.options.unassign_late_transaction),
      }).toString()
      const [newGraph, newStats, newAudit] = await Promise.all([
        request(`/graph/overview?${q}`),
        request(`/dashboard/stats?${q}`),
        request('/audit'),
      ])
      setGraphOverview(newGraph)
      setDashboardStats(newStats)
      setAudit(newAudit)
      setToast(`Scenario ${res.scenario} activated: ${res.name}. ${res.description}`)
      setTimeout(() => setToast(''), 5500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not activate scenario')
    } finally {
      setRunning(false)
    }
  }

  // Restore Built-in baseline demo data
  const restoreBuiltInDemo = async () => {
    setImporting(true)
    setError('')
    try {
      const body = await request('/demo/reset', { method: 'POST' })
      setRecon(body.reconciliation)
      setOptions({ ...defaultOptions })
      setActiveScenario('A')
      const [h, t, a, g, i, au, ops, stats] = await Promise.all([
        request('/health'),
        request('/demo/transactions'),
        request('/demo/adjustments'),
        request('/graph/overview'),
        request('/investigations'),
        request('/audit'),
        request('/operations/demo'),
        request('/dashboard/stats'),
      ])
      setHealth(h)
      setTransactions(t)
      setAdjustments(a)
      setGraphOverview(g)
      setInvestigations(i)
      setAudit(au)
      setOperations(ops)
      setDashboardStats(stats)
      setToast('Restored baseline synthetic source reports and reset reconciliation.')
      setTimeout(() => setToast(''), 4500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not restore demo data')
    } finally {
      setImporting(false)
      setIsResetModalOpen(false)
    }
  }

  // Upload canonical ZIP bundle
  const uploadBundle = async (file?: File) => {
    if (!file) return
    setImporting(true)
    setError('')
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('target_capture_date', targetCaptureDate)
      form.append('target_batch_id', targetBatchId)
      const res = await fetch(`${API}/import-zip`, { method: 'POST', body: form })
      const body = await res.json()
      if (!res.ok) throw new Error(body.detail || `Import failed (${res.status})`)
      setRecon(body.reconciliation)
      setOptions({ ...defaultOptions })
      const [h, t, a, g, au, ops, stats] = await Promise.all([
        request('/health'),
        request('/demo/transactions'),
        request('/demo/adjustments'),
        request('/graph/overview'),
        request('/audit'),
        request('/operations/demo'),
        request('/dashboard/stats'),
      ])
      setHealth(h)
      setTransactions(t)
      setAdjustments(a)
      setGraphOverview(g)
      setAudit(au)
      setOperations(ops)
      setDashboardStats(stats)
      setToast(`Successfully loaded ${Object.values(body.counts as Record<string, number>).reduce((x, y) => x + y, 0)} source records from ${file.name}.`)
      setTimeout(() => setToast(''), 5000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not import report bundle')
    } finally {
      setImporting(false)
    }
  }

  // Preview raw Paytm-style CSV
  const previewPaytmCsv = async (file?: File) => {
    if (!file) return
    setRawPreviewing(true)
    setError('')
    setRawPreview(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`${API}/import/paytm-csv/preview`, { method: 'POST', body: form })
      const body = await res.json()
      if (!res.ok) throw new Error(body.detail || `Preview failed (${res.status})`)
      setRawPreview(body)
      setRawPreviewFile(file)
      setRawCaptureDate(targetCaptureDate)
      setRawBatchId(targetBatchId)
      setRawPayoutDate(targetCaptureDate === '2026-10-26' ? '2026-10-27' : targetCaptureDate)
      setRawMappingAcknowledged(false)
      setAudit(await request('/audit'))
      setToast(`Parsed ${body.row_count} rows from raw CSV. Verify column mappings below.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not preview CSV')
    } finally {
      setRawPreviewing(false)
    }
  }

  // Stage raw Paytm export
  const stagePaytmCsv = async () => {
    if (!rawPreviewFile || !rawMappingAcknowledged || !rawBatchId.trim() || !rawPayoutUtr.trim()) return
    setRawStaging(true)
    setError('')
    try {
      const form = new FormData()
      form.append('file', rawPreviewFile)
      form.append('target_capture_date', rawCaptureDate)
      form.append('target_batch_id', rawBatchId.trim())
      form.append('payout_utr', rawPayoutUtr.trim())
      form.append('payout_date', rawPayoutDate)
      form.append('mapping_acknowledged', 'true')
      const res = await fetch(`${API}/import/paytm-csv/stage`, { method: 'POST', body: form })
      const body = await res.json()
      if (!res.ok) throw new Error(body.detail || `Could not stage CSV (${res.status})`)
      setToast(`${body.stage_id} stored as mapped source staging record. Active ledger remains explicit.`)
      setRawStaged(await request('/import/staged-paytm-exports'))
      setAudit(await request('/audit'))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not stage Paytm-style CSV')
    } finally {
      setRawStaging(false)
    }
  }

  // Investigation lifecycle actions
  const createInvestigation = async (noteText: string, sourceNode?: string) => {
    setError('')
    try {
      const result = await request('/investigations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          note: noteText,
          source_node_id: sourceNode || selectedNode || null,
          options,
        }),
      })
      setToast(`Investigation #${result.investigation.id} saved to SQLite audit trail.`)
      const [invList, auList, g, stats] = await Promise.all([
        request('/investigations'),
        request('/audit'),
        request(`/graph/overview?${graphQuery}`),
        request(`/dashboard/stats?${graphQuery}`),
      ])
      setInvestigations(invList)
      setAudit(auList)
      setGraphOverview(g)
      setDashboardStats(stats)
      setTab('audit')
      setTimeout(() => setToast(''), 4500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create investigation')
    }
  }

  const addInvestigationNote = async (invId: number, noteText: string) => {
    try {
      await request(`/investigations/${invId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: noteText, author: 'DEMO_OPERATOR' }),
      })
      const [invList, auList] = await Promise.all([request('/investigations'), request('/audit')])
      setInvestigations(invList)
      setAudit(auList)
      setToast(`Note added to Investigation INV-${String(invId).padStart(4, '0')}.`)
      setTimeout(() => setToast(''), 3500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add note')
    }
  }

  const decideInvestigation = async (invId: number, decision: 'APPROVE' | 'REJECT', decisionNote: string) => {
    try {
      const res = await request(`/investigations/${invId}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, decided_by: 'DEMO_OPERATOR', note: decisionNote }),
      })
      const [invList, auList, g, stats] = await Promise.all([
        request('/investigations'),
        request('/audit'),
        request(`/graph/overview?${graphQuery}`),
        request(`/dashboard/stats?${graphQuery}`),
      ])
      setInvestigations(invList)
      setAudit(auList)
      setGraphOverview(g)
      setDashboardStats(stats)
      setToast(res.message || `Decision recorded for Investigation INV-${String(invId).padStart(4, '0')}.`)
      setTimeout(() => setToast(''), 4000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not record decision')
    }
  }

  const reopenInvestigation = async (invId: number, noteText: string) => {
    try {
      const res = await request(`/investigations/${invId}/reopen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reopened_by: 'DEMO_OPERATOR', note: noteText }),
      })
      const [invList, auList, stats] = await Promise.all([
        request('/investigations'),
        request('/audit'),
        request(`/dashboard/stats?${graphQuery}`),
      ])
      setInvestigations(invList)
      setAudit(auList)
      setDashboardStats(stats)
      setToast(res.message || `Investigation INV-${String(invId).padStart(4, '0')} reopened.`)
      setTimeout(() => setToast(''), 4000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reopen investigation')
    }
  }

  // Compile 4-exhibit PDF
  const compileEvidencePacket = async () => {
    setError('')
    try {
      const res = await fetch(`${API}/evidence-packet/compile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          case_id: caseId || null,
          voice_transcript: voiceTranscript.trim() || null,
          voice_language_code: voiceLanguageCode || null,
          options,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.detail || `PDF compilation failed (${res.status})`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'SettleGraph_Four_Exhibit_Evidence_Packet.pdf'
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      setAudit(await request('/audit'))
      setToast('Four-exhibit review packet compiled locally. No external submission.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not compile evidence packet')
    }
  }

  // AI & Sarvam interactions
  const sendAgentChat = async () => {
    if (!agentPrompt.trim()) return
    setChatting(true)
    setError('')
    setAgentChat(null)
    try {
      const result = await request('/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: agentPrompt }),
      })
      setAgentChat(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Merchant teammate request failed')
    } finally {
      setChatting(false)
    }
  }

  const runInvestigationAgent = async () => {
    setAgentRunning(true)
    setError('')
    setAgentRun(null)
    try {
      const result = await request('/agent/investigate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ options }),
      })
      setAgentRun(result)
      const [invList, auList, g, stats] = await Promise.all([
        request('/investigations'),
        request('/audit'),
        request(`/graph/overview?${graphQuery}`),
        request(`/dashboard/stats?${graphQuery}`),
      ])
      setInvestigations(invList)
      setAudit(auList)
      setGraphOverview(g)
      setDashboardStats(stats)
      setToast('Investigation agent completed deterministic tool orchestration.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Agent orchestration failed')
    } finally {
      setAgentRunning(false)
    }
  }

  const transcribeMerchantVoice = async (file?: File) => {
    if (!file) return
    if (!health?.sarvam_configured) {
      setError('Sarvam ASR is not configured in backend/.env. Using typed query fallback.')
      return
    }
    setVoiceBusy(true)
    setError('')
    setVoiceTranscript('')
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`${API}/voice/transcribe`, { method: 'POST', body: form })
      const body = await res.json()
      if (!res.ok) throw new Error(body.detail || `Voice transcription failed (${res.status})`)
      setVoiceMode(body.mode || 'LIVE_SAARAS_ASR')
      if (!body.transcript) throw new Error(body.note || 'No transcript was returned. Type the request instead.')
      setVoiceTranscript(body.transcript || '')
      setVoiceLanguageCode(body.language_code || '')
      setAgentPrompt(body.transcript || '')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Voice transcription is unavailable')
    } finally {
      setVoiceBusy(false)
    }
  }

  const startMicrophoneRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Live microphone recording is not supported by this browser. Use the audio file upload or typed query.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream
      mediaChunksRef.current = []
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'].find(type => MediaRecorder.isTypeSupported(type))
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      recorder.ondataavailable = event => { if (event.data.size > 0) mediaChunksRef.current.push(event.data) }
      recorder.onerror = () => setError('Microphone recording error. Check browser microphone permissions.')
      recorder.onstop = () => {
        const blob = new Blob(mediaChunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        const extension = (recorder.mimeType || '').includes('ogg') ? 'ogg' : 'webm'
        const audioFile = new File([blob], `merchant-voice-${Date.now()}.${extension}`, { type: blob.type || 'audio/webm' })
        if (recordingTickRef.current !== null) window.clearInterval(recordingTickRef.current)
        recordingTickRef.current = null
        mediaStreamRef.current?.getTracks().forEach(track => track.stop())
        mediaStreamRef.current = null
        mediaRecorderRef.current = null
        setRecording(false)
        if (audioFile.size > 0) void transcribeMerchantVoice(audioFile)
      }
      recorder.start(250)
      recordingStartedAtRef.current = Date.now()
      setRecordingSeconds(0)
      setRecording(true)
      setError('')
      recordingTickRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - recordingStartedAtRef.current) / 1000)
        setRecordingSeconds(elapsed)
        if (elapsed >= 28 && recorder.state !== 'inactive') recorder.stop()
      }, 250)
    } catch (e) {
      setError(e instanceof Error ? `Microphone permission denied: ${e.message}` : 'Microphone permission unavailable.')
    }
  }

  const stopMicrophoneRecording = () => {
    if (recordingTickRef.current !== null) window.clearInterval(recordingTickRef.current)
    recordingTickRef.current = null
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop()
  }

  const bindSpokenReference = async () => {
    if (!spokenReference.trim()) return
    setError('')
    setBindingResult(null)
    try {
      const result = await request('/voice/bind-reference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spoken_reference: spokenReference, max_distance: 2 }),
      })
      setBindingResult(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reference candidate matching failed')
    }
  }

  const speakMerchantText = async () => {
    const textToSpeak = String(agentChat?.assistant_message || agentChat?.message || '')
    if (!textToSpeak) return
    setVoiceBusy(true)
    setError('')
    try {
      const res = await fetch(`${API}/voice/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToSpeak, language_code: 'hi-IN' }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.detail || `Speech synthesis failed (${res.status})`)
      }
      const blob = await res.blob()
      if (voiceAudioUrl) URL.revokeObjectURL(voiceAudioUrl)
      setVoiceAudioUrl(URL.createObjectURL(blob))
    } catch (e) {
      if ('speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined') {
        window.speechSynthesis.cancel()
        const utterance = new SpeechSynthesisUtterance(textToSpeak)
        utterance.lang = 'hi-IN'
        window.speechSynthesis.speak(utterance)
        setToast('Sarvam TTS unavailable. Used browser speech synthesis locally.')
      } else {
        setError(e instanceof Error ? `${e.message}. Browser speech synthesis is unavailable.` : 'Speech synthesis is unavailable')
      }
    } finally {
      setVoiceBusy(false)
    }
  }

  const runDuplicateDebitCheck = async () => {
    setOpsBusy(true)
    setError('')
    try {
      const result = await request('/operations/duplicate-debits/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      setDuplicateResult(result)
      setApprovals(await request('/approvals'))
      setAudit(await request('/audit'))
      setToast(result.detected ? `${result.candidate_count} source duplicate candidate(s) staged for human review.` : 'No qualifying duplicate found.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not run duplicate check')
    } finally {
      setOpsBusy(false)
    }
  }

  const decideApproval = async (approvalId: string, decision: 'APPROVE' | 'REJECT') => {
    setOpsBusy(true)
    setError('')
    try {
      const result = await request(`/approvals/${encodeURIComponent(approvalId)}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          decided_by: 'DEMO_OPERATOR',
          note: decision === 'APPROVE' ? 'Reviewed for manual handoff; no automated refund.' : 'Rejected during local demo review.',
        }),
      })
      setApprovals(await request('/approvals'))
      setAudit(await request('/audit'))
      setToast(result.message)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not record approval decision')
    } finally {
      setOpsBusy(false)
    }
  }

  const syncMockPosOrder = async (orderId: string) => {
    setOpsBusy(true)
    setError('')
    try {
      const result = await request(`/operations/orders/${encodeURIComponent(orderId)}/sync`, {
        method: 'POST',
        headers: { 'Idempotency-Key': `SETTLEGRAPH-DEMO-${orderId}` },
      })
      setPosOrders(await request('/operations/pos-orders'))
      setAudit(await request('/audit'))
      setToast(result.message)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sync mock order')
    } finally {
      setOpsBusy(false)
    }
  }

  const runDispute = async () => {
    if (!caseId) {
      setError('No dispute case is loaded.')
      return
    }
    try {
      const result = await request(`/disputes/${caseId}/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(faults),
      })
      setDisputeEval(result)
      setAudit(await request('/audit'))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not evaluate dispute')
    }
  }

  const verifyUtr = async () => {
    setUtrResult(null)
    try {
      const parsed = parseInrToPaise(utrAmount)
      const result = await request('/verify-demo-utr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ utr_rrn: utr.trim(), claimed_amount_paise: parsed }),
      })
      setUtrResult(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'UTR check failed')
    }
  }

  const testSarvamConnection = async () => {
    setSarvamTestBusy(true)
    setError('')
    try {
      const result = await request('/integrations/sarvam/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test_chat: true, test_tts: true }),
      })
      setIntegrationStatus(await request('/integrations/status'))
      const parts = Object.entries(result.tests || {}).map(([name, value]: [string, any]) => `${name.toUpperCase()}: ${value.ok ? 'PASS' : 'FAIL'}`)
      setToast(`Sarvam live check finished: ${parts.join(' · ')}.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sarvam connection test failed')
    } finally {
      setSarvamTestBusy(false)
    }
  }

  if (loading && !health) {
    return (
      <div className="startup">
        <LoaderCircle className="spin" size={32} />
        <p>Initializing SettleGraph Merchant Workspace v0.6...</p>
        {retryCountRef.current > 0 && (
          <small style={{ marginTop: '8px', color: '#64748b' }}>
            Connecting to cloud API (attempt {retryCountRef.current}/4, waking up free instance)...
          </small>
        )}
      </div>
    )
  }

  if (!health?.ok) {
    return (
      <div className="startup startup-error">
        <div className="startup-error-icon"><AlertTriangle size={28} /></div>
        <h1>Workbench could not reach the API</h1>
        <p>{error || 'The API health check did not succeed. Check the backend deployment and retry.'}</p>
        <code>API endpoint: {API}</code>
        <button className="primary-button" onClick={() => { retryCountRef.current = 0; void loadAll(); }}>
          <RefreshCw size={15} /> Retry connection
        </button>
        <small>Render free tier web services spin down after inactivity and take ~30–45s to wake up on the first request. The system will auto-retry, or click Retry connection once the service has spun up.</small>
      </div>
    )
  }

  return (
    <div className="app-shell">
      {/* 1. Global Navigation Sidebar */}
      <aside className="sidebar">
        <div className="brand" onClick={() => setTab('dashboard')}>
          <div className="brand-mark">
            <img src="/settlegraph-mark.svg" alt="" width="38" height="38" />
          </div>
          <div>
            <strong>SettleGraph</strong>
            <span>SETTLEMENT INTELLIGENCE v0.6</span>
          </div>
        </div>

        <div className="side-label">WORKSPACE MODULES</div>
        <nav className="nav-list">
          <NavItem
            active={tab === 'dashboard'}
            icon={<LayoutDashboard size={17} />}
            label="Command Centre"
            onClick={() => setTab('dashboard')}
          />
          <NavItem
            active={tab === 'reconcile'}
            icon={<FileSpreadsheet size={17} />}
            label="Reconciliation Studio"
            onClick={() => setTab('reconcile')}
          />
          <NavItem
            active={tab === 'evidence'}
            icon={<Network size={17} />}
            label="Settlement Graph"
            onClick={() => setTab('evidence')}
          />
          <NavItem
            active={tab === 'audit'}
            icon={<FileText size={17} />}
            label="Investigations & Decisions"
            onClick={() => setTab('audit')}
          />
          <NavItem
            active={tab === 'operations'}
            icon={<ClipboardList size={17} />}
            label="Counter Operations"
            onClick={() => setTab('operations')}
          />
          <NavItem
            active={tab === 'safety'}
            icon={<ShieldCheck size={17} />}
            label="Policy & Safety Lab"
            onClick={() => setTab('safety')}
          />
          <NavItem
            active={tab === 'vendor'}
            icon={<Wallet size={17} />}
            label="Vendor & Exceptions Desk"
            onClick={() => setTab('vendor')}
          />
          <NavItem
            active={tab === 'agent'}
            icon={<Bot size={17} />}
            label="Merchant AI Teammate"
            onClick={() => setTab('agent')}
          />
        </nav>

        <div className="sidebar-spacer" />

        <div className="sidebar-system">
          <div className="system-dot" />
          <div>
            <strong>Local Engine Active</strong>
            <span>API Connected · SQLite Persistent</span>
          </div>
        </div>

        <p className="sidebar-foot">
          Independent Merchant Operations Platform<br />
          SettleGraph v0.6 Release
        </p>
      </aside>

      {/* 2. Main Work Area */}
      <main className="main-area">
        {/* Top Demo Banner with Scenario Switchers */}
        <DemoBanner
          activeScenario={activeScenario}
          onSelectScenario={triggerScenario}
          onOpenResetModal={() => setIsResetModalOpen(true)}
          isSimulated={health?.demo_mode ?? true}
        />

        {/* Global Topbar */}
        <header className="topbar">
          <div>
            <div className="breadcrumb">
              <span>WORKSPACE</span>
              <ChevronRight size={12} />
              <span>{tab.toUpperCase()}</span>
            </div>
            <h1>
              {tab === 'dashboard' && 'Merchant Command Centre'}
              {tab === 'reconcile' && 'Reconciliation Studio'}
              {tab === 'evidence' && 'Interactive Settlement Graph'}
              {tab === 'audit' && 'Investigation Workspace & Decisions'}
              {tab === 'operations' && 'Counter Operations & POS Sync'}
              {tab === 'safety' && 'Dispute Policy & Merkle Safety Lab'}
              {tab === 'vendor' && 'Vendor Receivables & Exceptions Desk'}
              {tab === 'agent' && 'Merchant AI Teammate & Voice'}
            </h1>
          </div>

          <div className="top-actions">
            {/* Global Quick Search Button */}
            <button
              className="global-search-btn"
              onClick={() => setIsSearchOpen(true)}
              title="Global Quick Search (Ctrl+K)"
            >
              <Search size={14} />
              <span>Search (Ctrl+K)</span>
            </button>

            <span className="synthetic-pill">
              <span /> {health?.mode === 'BUILT_IN_SYNTHETIC_FIXTURE' ? 'DEMO DATASET' : 'IMPORTED LEDGER'}
            </span>

            <button
              className="icon-button"
              aria-label="Refresh workspace data"
              title="Refresh all data"
              onClick={() => void loadAll()}
            >
              <RefreshCw size={15} />
            </button>
          </div>
        </header>

        {/* Alert Notifications */}
        {error && (
          <div className="alert alert-error">
            <AlertTriangle size={17} />
            <span>{error}</span>
            <button onClick={() => setError('')}><XCircle size={16} /></button>
          </div>
        )}
        {toast && (
          <div className="alert alert-success">
            <CheckCircle2 size={17} />
            <span>{toast}</span>
            <button onClick={() => setToast('')}><XCircle size={16} /></button>
          </div>
        )}

        {/* TAB 1: Command Centre */}
        {tab === 'dashboard' && (
          <CommandCentre
            stats={dashboardStats}
            recon={recon}
            money={money}
            onNavigateTab={setTab}
            onSelectNode={id => {
              setSelectedNode(id)
              setTab('evidence')
            }}
            onTriggerScenario={triggerScenario}
            loading={loading}
          />
        )}

        {/* TAB 2: Reconciliation Studio */}
        {tab === 'reconcile' && (
          <ReconciliationStudio
            recon={recon}
            transactions={transactions}
            adjustments={adjustments}
            rawPreview={rawPreview}
            rawStaged={rawStaged}
            money={money}
            onUploadZip={uploadBundle}
            onPreviewPaytmCsv={previewPaytmCsv}
            onStagePaytmCsv={stagePaytmCsv}
            onRestoreDemo={restoreBuiltInDemo}
            onTraceNode={id => {
              setSelectedNode(id)
              setTab('evidence')
            }}
            onOpenInvestigation={(nodeId, noteText) => void createInvestigation(noteText || `Investigation on ${nodeId}`, nodeId)}
            targetCaptureDate={targetCaptureDate}
            setTargetCaptureDate={setTargetCaptureDate}
            targetBatchId={targetBatchId}
            setTargetBatchId={setTargetBatchId}
            rawCaptureDate={rawCaptureDate}
            setRawCaptureDate={setRawCaptureDate}
            rawBatchId={rawBatchId}
            setRawBatchId={setRawBatchId}
            rawPayoutUtr={rawPayoutUtr}
            setRawPayoutUtr={setRawPayoutUtr}
            rawPayoutDate={rawPayoutDate}
            setRawPayoutDate={setRawPayoutDate}
            rawMappingAcknowledged={rawMappingAcknowledged}
            setRawMappingAcknowledged={setRawMappingAcknowledged}
            importing={importing}
            rawPreviewing={rawPreviewing}
            rawStaging={rawStaging}
          />
        )}

        {/* TAB 3: Interactive Settlement Graph */}
        {tab === 'evidence' && (
          <SettlementGraph
            graphData={graphOverview}
            selectedNodeId={selectedNode}
            onSelectNode={setSelectedNode}
            onCreateInvestigation={(nodeId, noteText) => void createInvestigation(noteText || `Investigate ${nodeId}`, nodeId)}
            onTraceNode={id => {
              setSelectedNode(id)
              request(`/graph/trace/${encodeURIComponent(id)}?${graphQuery}`).then(setTrace)
            }}
            money={money}
            loading={loading}
          />
        )}

        {/* TAB 4: Investigation Workspace & Audit Trail */}
        {tab === 'audit' && (
          <InvestigationWorkspace
            investigations={investigations}
            auditEvents={audit}
            money={money}
            stamp={stamp}
            shortHash={shortHash}
            onCreateInvestigation={createInvestigation}
            onAddNote={addInvestigationNote}
            onDecideInvestigation={decideInvestigation}
            onReopenInvestigation={reopenInvestigation}
            onCompileEvidencePdf={compileEvidencePacket}
            onTraceNode={id => {
              setSelectedNode(id)
              setTab('evidence')
            }}
            loading={loading}
          />
        )}

        {/* TAB 5: Counter Operations */}
        {tab === 'operations' && (
          <div className="counter-operations-tab">
            <section className="intro-row">
              <div>
                <h2>Counter & Merchant POS Operations</h2>
                <p>
                  Duplicate debit verification and local mock POS order recovery. Staged records require operator confirmation; no live money movement is executed.
                </p>
              </div>
              <span className="status-pill status-warn">LOCAL APPROVALS · NO EXTERNAL REFUNDS</span>
            </section>

            <section className="ops-grid">
              <div className="panel ops-card">
                <PanelHeader
                  icon={<CreditCard size={18} />}
                  title="Duplicate Debit Shield"
                  subtitle="Scans active payments for identical order + exact paise amount within 120s"
                />
                <div className="ops-case-summary">
                  <span className="eyebrow">ACTIVE SOURCE ANALYSIS</span>
                  <strong>{operations?.duplicate_candidates?.length || 0} candidate pair(s) detected</strong>
                  <p>
                    Every candidate is staged for human review. Does not call external refund endpoints.
                  </p>
                  {(operations?.duplicate_candidates || []).map((item: AnyObj, idx: number) => (
                    <div className="cutoff-event" key={idx}>
                      <strong>{item.order_id}</strong>
                      <span>{money(item.amount_paise)} · {item.window_seconds}s apart</span>
                      <small>{item.payment_references?.map((ref: AnyObj) => ref.transaction_id).join(' / ')} · Payer: {item.payer_identity_check || 'NOT_AVAILABLE'}</small>
                    </div>
                  ))}
                </div>
                <button
                  className="primary-button wide"
                  disabled={opsBusy || !operations?.duplicate_candidates?.length}
                  onClick={() => void runDuplicateDebitCheck()}
                >
                  {opsBusy ? <LoaderCircle size={15} className="spin" /> : <ShieldCheck size={15} />}
                  Check & Stage All Duplicate Candidates
                </button>
                {duplicateResult && (
                  <div className="ops-result">
                    <span className={`status-pill ${duplicateResult.detected ? 'status-warn' : 'status-neutral'}`}>
                      {duplicateResult.decision_state}
                    </span>
                    <p>{duplicateResult.reason}</p>
                    <small>Refund API Called: {String(duplicateResult.refund_api_called)}</small>
                  </div>
                )}
              </div>

              <div className="panel ops-card">
                <PanelHeader
                  icon={<Workflow size={18} />}
                  title="Paid but POS Still Pending"
                  subtitle="Idempotent local sync from verified payment proof"
                />
                {posOrders.map((order: AnyObj) => (
                  <div className="pos-order-card" key={order.order_id}>
                    <div>
                      <span className="eyebrow">MOCK POS ORDER</span>
                      <strong>{order.order_id}</strong>
                    </div>
                    <div className="pos-facts">
                      <Fact label="Payment Status" value={order.payment_status} />
                      <Fact label="POS Status" value={order.order_status} />
                      <Fact label="Amount" value={money(order.amount_paise)} />
                      <Fact label="UTR" value={order.payment_utr} />
                    </div>
                    <button
                      className="primary-button wide"
                      disabled={opsBusy || order.order_status === 'PAID'}
                      onClick={() => void syncMockPosOrder(order.order_id)}
                    >
                      {opsBusy ? <LoaderCircle size={15} className="spin" /> : <RefreshCw size={15} />}
                      {order.order_status === 'PAID' ? 'Mock Order is PAID' : 'Run Idempotent Mock Sync'}
                    </button>
                    {order.synced_at && (
                      <small className="muted">Synced locally at {stamp(order.synced_at)} · External POS Called: False</small>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section className="panel approvals-panel">
              <PanelHeader
                icon={<ClipboardList size={18} />}
                title="Human Approval Queue"
                subtitle={`${approvals.length} locally persisted proposal(s) awaiting operator decision`}
                right={
                  <button className="secondary-button" onClick={() => void request('/approvals').then(setApprovals)}>
                    Refresh Queue
                  </button>
                }
              />
              {approvals.length === 0 ? (
                <div className="empty-state">
                  No pending approvals. Run the duplicate-debit check above to generate a synthetic proposal.
                </div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Approval ID</th>
                        <th>Case / Action</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Evidence SHA-256</th>
                        <th>Decision Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {approvals.map((item: AnyObj) => (
                        <tr key={item.approval_id}>
                          <td><code>{item.approval_id}</code></td>
                          <td>
                            <strong>{item.case_id}</strong>
                            <small className="table-sub">{item.action_type}</small>
                          </td>
                          <td className="amount-cell">{money(item.amount_paise)}</td>
                          <td>
                            <span className={`status-pill ${item.status === 'PENDING_HUMAN_APPROVAL' ? 'status-warn' : item.status === 'REJECTED' ? 'status-bad' : 'status-good'}`}>
                              {item.status.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td><code>{shortHash(item.evidence_sha256)}</code></td>
                          <td>
                            {item.status === 'PENDING_HUMAN_APPROVAL' ? (
                              <div className="approval-actions">
                                <button className="approve-button" disabled={opsBusy} onClick={() => void decideApproval(item.approval_id, 'APPROVE')}>
                                  Approve Handoff
                                </button>
                                <button className="reject-button" disabled={opsBusy} onClick={() => void decideApproval(item.approval_id, 'REJECT')}>
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <small>{item.decided_by || '—'} · No external call</small>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}

        {/* TAB 6: Policy & Safety Lab */}
        {tab === 'safety' && (
          <div className="safety-lab-tab">
            <section className="intro-row">
              <div>
                <h2>Dispute Policy & 3-Way Merkle Verification</h2>
                <p>
                  Deterministic dispute policy evaluation. The platform verifies consistency across Nodal payments, POS invoices, and Courier delivery proofs without calling external dispute APIs.
                </p>
              </div>
              <span className="status-pill status-warn">EXTERNAL DISPUTE SUBMISSION: DISABLED</span>
            </section>

            <section className="content-grid safety-grid">
              <div className="panel">
                <PanelHeader
                  icon={<ShieldAlert size={18} />}
                  title="Controlled Dispute Fault Injection"
                  subtitle="Corrupt OTP, alter invoice amount, or simulate conflicting courier status"
                />
                <div className="field-label">SELECT EVIDENCE CASE</div>
                <select
                  className="select-control"
                  value={caseId}
                  disabled={disputeCases.length === 0}
                  onChange={e => {
                    setCaseId(e.target.value)
                    setDisputeEval(null)
                  }}
                >
                  {disputeCases.map((item: AnyObj) => (
                    <option key={item.case_id} value={item.case_id}>
                      {item.case_id} · Order: {item.order_id || 'missing'} · {money(item.disputed_paise)}
                    </option>
                  ))}
                </select>

                <div className="fault-list">
                  <FaultToggle
                    title="Corrupt Courier Delivery Proof"
                    description="Set delivery OTP verification state to false."
                    checked={faults.corrupt_otp}
                    onChange={v => setFaults({ ...faults, corrupt_otp: v })}
                  />
                  <FaultToggle
                    title="Inject ₹200 Invoice Mismatch"
                    description="Change invoice amount away from the captured payment amount."
                    checked={faults.inject_amount_mismatch}
                    onChange={v => setFaults({ ...faults, inject_amount_mismatch: v })}
                  />
                  <FaultToggle
                    title="Contradict Courier Delivery Status"
                    description="Set courier status to RETURN_TO_ORIGIN."
                    checked={faults.inject_courier_conflict}
                    onChange={v => setFaults({ ...faults, inject_courier_conflict: v })}
                  />
                  <FaultToggle
                    title="Simulate Duplicate Debit Event"
                    description="Stage dispute for human approval queue."
                    checked={faults.force_duplicate_debit}
                    onChange={v => setFaults({ ...faults, force_duplicate_debit: v })}
                  />
                </div>

                <button
                  className="primary-button wide"
                  disabled={!caseId}
                  onClick={() => void runDispute()}
                >
                  <ShieldCheck size={16} /> Evaluate Dispute Policy
                </button>
              </div>

              <div className="panel decision-panel">
                <PanelHeader
                  icon={<Workflow size={18} />}
                  title="Policy Outcome & Merkle Integrity"
                  subtitle="Verifiable Merkle leaf proofs across 3 independent evidence branches"
                />
                {!disputeEval ? (
                  <div className="empty-state large">
                    <ShieldCheck size={32} />
                    <strong>Ready to evaluate policy</strong>
                    <span>Toggle fault parameters and evaluate the deterministic outcome.</span>
                  </div>
                ) : (
                  <>
                    <div className={`decision-state ${statusClass(disputeEval.decision_state)}`}>
                      <div>
                        <span>DECISION STATE</span>
                        <strong>{disputeEval.decision_state.replace(/_/g, ' ')}</strong>
                      </div>
                      <ShieldCheck size={28} />
                    </div>
                    <p className="decision-reason">{disputeEval.reason_summary}</p>
                    <div className="decision-facts">
                      <Fact label="Case ID" value={disputeEval.case.case_id} />
                      <Fact label="Disputed Amount" value={money(disputeEval.case.disputed_paise)} />
                      <Fact label="External Submission" value="Disabled" />
                      <Fact label="Human Review Required" value="Yes" />
                    </div>
                    <div className="hash-block">
                      <span>3-Way Merkle Root (Nodal + POS + Courier)</span>
                      <code>{disputeEval.merkle_root_sha256}</code>
                    </div>
                    <div className="merkle-leaf-list">
                      {(disputeEval.dispute_merkle?.leaves || []).map((leaf: AnyObj) => (
                        <div className="merkle-leaf" key={leaf.kind}>
                          <span>{leaf.kind.replace(/_/g, ' ')}</span>
                          <code>{leaf.leaf_sha256}</code>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </section>

            <section className="panel">
              <PanelHeader
                icon={<Search size={18} />}
                title="Counter-Reference Demo Query"
                subtitle="Searches loaded local synthetic records; does not query live payment switches"
              />
              <div className="utr-form">
                <label>
                  <span>UTR / RRN</span>
                  <input value={utr} onChange={e => setUtr(e.target.value)} placeholder="Enter 12-digit UTR" />
                </label>
                <label>
                  <span>Claimed Amount (₹)</span>
                  <input inputMode="decimal" value={utrAmount} onChange={e => setUtrAmount(e.target.value)} placeholder="4500.00" />
                </label>
                <button className="primary-button" onClick={() => void verifyUtr()}>
                  <Search size={15} /> Check Loaded Fixture
                </button>
              </div>
              {utrResult && (
                <div className={`utr-result ${utrResult.verified ? 'good' : 'warn'}`}>
                  <strong>{utrResult.verdict.replace(/_/g, ' ')}</strong>
                  <p>{utrResult.message}</p>
                  <small>Live Paytm Checked: {String(utrResult.live_paytm_checked)}</small>
                </div>
              )}
            </section>
          </div>
        )}

        {/* TAB 7: Vendor & Exceptions Desk */}
        {tab === 'vendor' && <VendorTab request={request} money={money} />}

        {/* TAB 8: Merchant AI Teammate & Voice */}
        {tab === 'agent' && (
          <div className="merchant-ai-tab">
            <section className="intro-row">
              <div>
                <h2>Merchant AI Teammate & Voice Studio</h2>
                <p>
                  Read-only tool calling with optional Sarvam Chat and Saaras Voice. All financial arithmetic is computed deterministically by the backend.
                </p>
              </div>
              <span className={`status-pill ${health?.sarvam_configured ? 'status-good' : 'status-neutral'}`}>
                {health?.sarvam_configured ? 'SARVAM CONFIGURED' : 'OFFLINE DETERMINISTIC FALLBACK'}
              </span>
            </section>

            <section className="panel merchant-chat-panel">
              <PanelHeader
                icon={<Bot size={18} />}
                title="Ask Merchant AI Teammate"
                subtitle="Ask questions about settlement variances, batch UTRs, or unassigned transactions"
              />
              <div className="merchant-chat-compose">
                <textarea
                  value={agentPrompt}
                  onChange={e => setAgentPrompt(e.target.value)}
                  rows={2}
                  maxLength={2000}
                  placeholder="Ask about a payout discrepancy, UTR, order or investigation..."
                />
                <button
                  className="primary-button"
                  onClick={() => void sendAgentChat()}
                  disabled={chatting || !agentPrompt.trim()}
                >
                  {chatting ? <LoaderCircle size={15} className="spin" /> : <MessageSquare size={15} />}
                  {chatting ? 'Checking Records...' : 'Ask Teammate'}
                </button>
                <label className={`subtle-upload voice-upload ${voiceBusy || recording ? 'disabled' : ''}`}>
                  <input
                    type="file"
                    accept="audio/*"
                    disabled={voiceBusy || recording}
                    onChange={e => {
                      void transcribeMerchantVoice(e.target.files?.[0])
                      e.currentTarget.value = ''
                    }}
                  />
                  {voiceBusy ? <LoaderCircle size={14} className="spin" /> : <Mic size={14} />}
                  Upload Audio
                </label>
                <button
                  className={`secondary-button record-button ${recording ? 'recording' : ''}`}
                  disabled={voiceBusy}
                  onClick={() => (recording ? stopMicrophoneRecording() : void startMicrophoneRecording())}
                >
                  {recording ? <StopCircle size={14} /> : <Radio size={14} />}
                  {recording ? `Stop · ${recordingSeconds}s / 28s` : 'Record Live Mic'}
                </button>
              </div>

              {voiceTranscript && (
                <div className="voice-transcript">
                  <strong>{voiceMode || 'ASR'} Transcript · Review before using</strong>
                  <textarea
                    value={voiceTranscript}
                    onChange={e => setVoiceTranscript(e.target.value)}
                    rows={3}
                  />
                </div>
              )}

              <div className="reference-bind-row">
                <label>
                  <span>Spoken Reference Matching</span>
                  <input
                    value={spokenReference}
                    onChange={e => setSpokenReference(e.target.value)}
                    placeholder="Enter spoken reference to find close edit-distance matches"
                  />
                </label>
                <button className="secondary-button" onClick={() => void bindSpokenReference()} disabled={!spokenReference.trim()}>
                  Find Candidate (≤2 edits)
                </button>
                {bindingResult && (
                  <div className="binding-result">
                    <strong>{bindingResult.status}</strong>
                    <span>{bindingResult.candidate?.label || 'No safe candidate'}</span>
                  </div>
                )}
              </div>

              {agentChat && (
                <div className="merchant-chat-result">
                  <div className="agent-result-heading">
                    <span className="status-pill status-neutral">{agentChat.agent_mode || 'AGENT'}</span>
                    <span className="muted">External Actions: Disabled</span>
                  </div>
                  <p>{agentChat.assistant_message || agentChat.message}</p>
                  <div className="merchant-chat-actions">
                    <button className="secondary-button" onClick={() => void speakMerchantText()} disabled={voiceBusy}>
                      <Volume2 size={14} /> Read Response Aloud
                    </button>
                    {voiceAudioUrl && <audio controls src={voiceAudioUrl} />}
                  </div>
                </div>
              )}
            </section>

            <section className="panel agent-panel">
              <PanelHeader
                icon={<Workflow size={18} />}
                title="Investigation Agent Orchestration"
                subtitle="Deterministic tool loop calling reconciler, tracer, and exception logger"
              />
              <div className="agent-body">
                <div className="agent-description">
                  <strong>Run Deterministic Investigation Loop</strong>
                  <p>
                    Reconciles current scenario, selects an evidence path, opens an exception case if required, and records an audit event.
                  </p>
                  <button
                    className="primary-button"
                    onClick={() => void runInvestigationAgent()}
                    disabled={agentRunning}
                  >
                    {agentRunning ? <LoaderCircle size={15} className="spin" /> : <Workflow size={15} />}
                    {agentRunning ? 'Running Tools...' : 'Run Investigation Agent'}
                  </button>
                </div>
                {agentRun && (
                  <div className="agent-output">
                    <div className="agent-result-heading">
                      <span className={`status-pill ${statusClass(agentRun.status)}`}>
                        {agentRun.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="agent-summary">{agentRun.summary}</p>
                    <div className="tool-trace">
                      {agentRun.tool_calls.map((call: AnyObj, idx: number) => (
                        <div className="tool-call" key={idx}>
                          <div className="tool-step">{String(idx + 1).padStart(2, '0')}</div>
                          <div>
                            <strong>{call.tool}</strong>
                            <p>{call.status}</p>
                            <small>{JSON.stringify(call.output)}</small>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section className="panel">
              <PanelHeader
                icon={<Radio size={18} />}
                title="Sarvam Integration Readiness"
                subtitle="Configuration is not connection proof. Test consumes provider credits."
                right={
                  <button
                    className="primary-button"
                    onClick={() => void testSarvamConnection()}
                    disabled={sarvamTestBusy || !integrationStatus?.sarvam?.api_key_configured}
                  >
                    {sarvamTestBusy ? <LoaderCircle size={13} className="spin" /> : <Radio size={13} />}
                    {sarvamTestBusy ? 'Testing...' : 'Test Sarvam · Uses Credits'}
                  </button>
                }
              />
              {integrationStatus && (
                <div className="preview-stats">
                  <Fact label="Sarvam API Key" value={integrationStatus.sarvam?.api_key_configured ? 'Key Configured' : 'Not Configured'} />
                  <Fact label="Paytm Live" value="Not Connected" />
                  <Fact label="Bank Direct" value="Not Connected" />
                  <Fact label="External Actions" value="Disabled" />
                </div>
              )}
            </section>
          </div>
        )}

        {/* Global Footer */}
        <footer className="page-footer">
          <span><span className="footer-dot" /> Deterministic Integer-Paise Engine</span>
          <span>All figures shown are synthetic test data</span>
          <span>SettleGraph v0.6 · Evidence-Backed · Human-Controlled</span>
        </footer>
      </main>

      {/* Global Search Modal */}
      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        transactions={transactions}
        adjustments={adjustments}
        investigations={investigations}
        onSelectNode={setSelectedNode}
        onNavigateTab={setTab}
        money={money}
      />

      {/* Confirmation Modal for Reset Demo */}
      <ConfirmationModal
        isOpen={isResetModalOpen}
        title="Reset Demo Dataset?"
        message="This will restore the built-in synthetic merchant reports, reset injected variances, and return reconciliation to baseline Scenario A. Staged records and past investigations will be retained."
        confirmText="Reset to Baseline"
        variant="danger"
        onConfirm={() => void restoreBuiltInDemo()}
        onCancel={() => setIsResetModalOpen(false)}
      />
    </div>
  )
}

function NavItem({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean
  icon: ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}>
      {icon}
      <span>{label}</span>
      {active && <ChevronRight size={15} className="nav-chevron" />}
    </button>
  )
}

function PanelHeader({
  icon,
  title,
  subtitle,
  right,
}: {
  icon: ReactNode
  title: string
  subtitle: string
  right?: ReactNode
}) {
  return (
    <div className="panel-header">
      <div className="panel-header-icon">{icon}</div>
      <div className="panel-header-text">
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>
      {right && <div className="panel-header-right">{right}</div>}
    </div>
  )
}

function FaultToggle({
  title,
  description,
  checked,
  onChange,
}: {
  title: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="fault-toggle">
      <span>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
    </label>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="decision-fact">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}
