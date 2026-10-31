import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import VendorTab from './VendorTab'
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowRight, Banknote,
  CheckCircle2, ChevronRight, CircleHelp, Clock3, Download, FileSearch,
  FileText, Fingerprint, GitBranch, Landmark, LoaderCircle, Network, RefreshCw,
  Search, ShieldAlert, ShieldCheck, Wallet, Workflow, XCircle, Bot, Mic, MessageSquare, Volume2,
  ClipboardList, CreditCard, Check, Radio, StopCircle,
} from 'lucide-react'

const API = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '')
type Tab = 'reconcile' | 'evidence' | 'safety' | 'vendor' | 'operations' | 'audit'
type AnyObj = Record<string, any>
type SimOptions = {
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

function money(paise: number | undefined | null): string {
  if (paise == null) return '—'
  if (!Number.isSafeInteger(paise)) return 'Amount exceeds safe display range'
  const value = BigInt(paise)
  const sign = value < 0n ? '−' : ''
  const abs = value < 0n ? -value : value
  const rupees = (abs / 100n).toLocaleString('en-IN')
  const cents = String(abs % 100n).padStart(2, '0')
  return `${sign}₹${rupees}.${cents}`
}
function parseInrToPaise(raw: string): number {
  const value = raw.trim().replace(/,/g, '')
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) {
    throw new Error('Enter a non-negative amount with at most two decimal places.')
  }
  const [rupees, fraction = ''] = value.split('.')
  const paise = BigInt(rupees) * 100n + BigInt((fraction + '00').slice(0, 2))
  if (paise > 9223372036854775807n) throw new Error('Amount exceeds the signed 64-bit paise range.')
  if (paise > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Amount exceeds the browser safe-integer display limit. Use a smaller test amount or a string-safe import flow.')
  return Number(paise)
}
function stamp(value?: string) {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}
function shortHash(hash?: string) {
  if (!hash) return 'Not available'
  return `${hash.slice(0, 16)}…${hash.slice(-8)}`
}
async function readAudioDurationSeconds(file: File): Promise<number | null> {
  // Browser metadata check is best-effort; unknown metadata is still validated by
  // Sarvam's API. Object URLs are always revoked after the metadata attempt.
  return new Promise(resolve => {
    const objectUrl = URL.createObjectURL(file)
    const audio = new Audio()
    let settled = false
    const finish = (duration: number | null) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      audio.onloadedmetadata = null
      audio.ondurationchange = null
      audio.onerror = null
      audio.removeAttribute('src')
      URL.revokeObjectURL(objectUrl)
      resolve(duration)
    }
    const timeout = window.setTimeout(() => finish(null), 2500)
    audio.preload = 'metadata'
    const inspectDuration = () => {
      if (Number.isFinite(audio.duration)) finish(audio.duration)
    }
    audio.onloadedmetadata = inspectDuration
    audio.ondurationchange = inspectDuration
    audio.onerror = () => finish(null)
    audio.src = objectUrl
    audio.load()
  })
}
function statusClass(status?: string) {
  if (status === 'RECONCILED' || status === 'READY_FOR_HUMAN_REVIEW') return 'status-good'
  if (status === 'NEEDS_REVIEW' || status === 'NEEDS_MERCHANT_PROOF' || status === 'PENDING_HUMAN_APPROVAL_REFUND') return 'status-warn'
  if (status === 'UNEXPLAINED_VARIANCE' || status === 'INCOMPLETE_OR_UNMATCHED' || status === 'HALTED_EVIDENCE_CONFLICT') return 'status-bad'
  return 'status-neutral'
}

export default function App() {
  const [tab, setTab] = useState<Tab>('reconcile')
  const [health, setHealth] = useState<AnyObj | null>(null)
  const [recon, setRecon] = useState<AnyObj | null>(null)
  const [transactions, setTransactions] = useState<AnyObj[]>([])
  const [adjustments, setAdjustments] = useState<AnyObj[]>([])
  const [graphOverview, setGraphOverview] = useState<AnyObj | null>(null)
  const [selectedNode, setSelectedNode] = useState('ADJ-EDI-01')
  const [trace, setTrace] = useState<AnyObj | null>(null)
  const [investigations, setInvestigations] = useState<AnyObj[]>([])
  const [audit, setAudit] = useState<AnyObj[]>([])
  const [options, setOptions] = useState<SimOptions>(defaultOptions)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [importing, setImporting] = useState(false)
  const [targetCaptureDate, setTargetCaptureDate] = useState('2026-10-26')
  const [targetBatchId, setTargetBatchId] = useState('BATCH-2026-10-27')
  const [error, setError] = useState('')
  const [transactionSearch, setTransactionSearch] = useState('')
  const [caseId, setCaseId] = useState('')
  const [disputeCases, setDisputeCases] = useState<AnyObj[]>([])
  const [faults, setFaults] = useState({ corrupt_otp: false, inject_amount_mismatch: false, inject_courier_conflict: false, force_duplicate_debit: false })
  const [disputeEval, setDisputeEval] = useState<AnyObj | null>(null)
  const [agentRun, setAgentRun] = useState<AnyObj | null>(null)
  const [agentRunning, setAgentRunning] = useState(false)
  const [utr, setUtr] = useState('629810445566')
  const [utrAmount, setUtrAmount] = useState('4500.00')
  const [utrResult, setUtrResult] = useState<AnyObj | null>(null)
  const [note, setNote] = useState('Investigate payout variance and retain source-linked evidence.')
  const [toast, setToast] = useState('')
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
  const [agentPrompt, setAgentPrompt] = useState('My payout looks short. Explain the loaded settlement.')
  const [agentChat, setAgentChat] = useState<AnyObj | null>(null)
  const [chatting, setChatting] = useState(false)
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
  const [operations, setOperations] = useState<AnyObj | null>(null)
  const [opsBusy, setOpsBusy] = useState(false)
  const [duplicateResult, setDuplicateResult] = useState<AnyObj | null>(null)
  const [approvals, setApprovals] = useState<AnyObj[]>([])
  const [posOrders, setPosOrders] = useState<AnyObj[]>([])

  const request = useCallback(async (path: string, init?: RequestInit) => {
    const res = await fetch(`${API}${path}`, init)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.detail || `Request failed (${res.status})`)
    }
    return res.json()
  }, [])

  const loadAll = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [h, r, t, a, g, i, au, source, ops, approvalRows, orderRows, stagedRows, disputeSource] = await Promise.all([
        request('/health'), request('/demo/reconcile'), request('/demo/transactions'),
        request('/demo/adjustments'), request('/graph/overview'), request('/investigations'), request('/audit'), request('/import/status'),
        request('/operations/demo'), request('/approvals'), request('/operations/pos-orders'), request('/import/staged-paytm-exports'), request('/disputes'),
      ])
      setHealth(h); setRecon(r); setTransactions(t); setAdjustments(a); setGraphOverview(g); setInvestigations(i); setAudit(au)
      setOperations(ops); setApprovals(approvalRows); setPosOrders(orderRows); setRawStaged(stagedRows)
      setDisputeCases(disputeSource.cases || [])
      setCaseId((current: string) => disputeSource.cases?.some((row: AnyObj) => row.case_id === current) ? current : (disputeSource.cases?.[0]?.case_id || ''))
      setTargetCaptureDate(source.capture_date); setTargetBatchId(source.batch_id)
      const defaultNode = a.find((item: AnyObj) => item.adjustment_id === selectedNode)?.adjustment_id || t[0]?.pg_txn_id || 'ADJ-EDI-01'
      setSelectedNode(defaultNode)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not connect to the backend')
    } finally { setLoading(false) }
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

  const graphQuery = useMemo(() => new URLSearchParams({ bank_credit_delta_paise: String(options.bank_credit_delta_paise), adjustment_delta_paise: String(options.adjustment_delta_paise), inject_unknown_adjustment: String(options.inject_unknown_adjustment), unassign_late_transaction: String(options.unassign_late_transaction) }).toString(), [options])

  useEffect(() => {
    if (!selectedNode) return
    request(`/graph/trace/${encodeURIComponent(selectedNode)}?${graphQuery}`)
      .then(setTrace).catch(() => setTrace(null))
  }, [selectedNode, request, graphQuery])

  const uploadBundle = async (file?: File) => {
    if (!file) return
    setImporting(true); setError('')
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('target_capture_date', targetCaptureDate)
      form.append('target_batch_id', targetBatchId)
      const res = await fetch(`${API}/import-zip`, { method: 'POST', body: form })
      const body = await res.json()
      if (!res.ok) throw new Error(body.detail || `Import failed (${res.status})`)
      setRecon(body.reconciliation)
      setHealth(await request('/health'))
      setTransactions(await request('/demo/transactions'))
      const newAdjustments = await request('/demo/adjustments')
      const newGraph = await request('/graph/overview')
      setAdjustments(newAdjustments)
      setGraphOverview(newGraph)
      setOptions({ ...defaultOptions })
      setSelectedNode(newGraph.selectable_nodes.find((n: AnyObj) => n.node_type === 'adjustment')?.id || newGraph.selectable_nodes[0]?.id || '')
      setAudit(await request('/audit'))
      const disputeSource = await request('/disputes')
      setDisputeCases(disputeSource.cases || [])
      setCaseId(disputeSource.cases?.[0]?.case_id || '')
      setOperations(await request('/operations/demo'))
      setDuplicateResult(null)
      setToast(`Loaded ${Object.values(body.counts as Record<string, number>).reduce((a, b) => a + b, 0)} source rows from ${file.name}.`)
      setTimeout(() => setToast(''), 5000)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not import report bundle') }
    finally { setImporting(false) }
  }

  const previewPaytmCsv = async (file?: File) => {
    if (!file) return
    setRawPreviewing(true); setError(''); setRawPreview(null)
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
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not preview CSV') }
    finally { setRawPreviewing(false) }
  }

  const stagePaytmCsv = async () => {
    if (!rawPreviewFile || !rawMappingAcknowledged || !rawBatchId.trim() || !rawPayoutUtr.trim()) return
    setRawStaging(true); setError('')
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
      setToast(`${body.stage_id} stored as a mapped source staging record. Active ledger unchanged.`)
      setRawStaged(await request('/import/staged-paytm-exports'))
      setAudit(await request('/audit'))
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not stage Paytm-style CSV') }
    finally { setRawStaging(false) }
  }

  const sendAgentChat = async () => {
    if (!agentPrompt.trim()) return
    setChatting(true); setError(''); setAgentChat(null)
    try {
      const result = await request('/agent/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: agentPrompt }) })
      setAgentChat(result)
    } catch (e) { setError(e instanceof Error ? e.message : 'Merchant teammate request failed') }
    finally { setChatting(false) }
  }

  const transcribeMerchantVoice = async (file?: File) => {
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      setError('Audio file exceeds the 10 MB upload limit. Choose a shorter or compressed recording.')
      return
    }
    const duration = await readAudioDurationSeconds(file)
    if (duration !== null && duration > 30) {
      setError(`This recording is ${duration.toFixed(1)} seconds long. Saaras REST accepts up to 30 seconds; trim it or record a shorter clip.`)
      return
    }
    setVoiceBusy(true); setError(''); setVoiceTranscript('')
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`${API}/voice/transcribe`, { method: 'POST', body: form })
      const body = await res.json()
      if (!res.ok) throw new Error(body.detail || `Voice transcription failed (${res.status})`)
      setVoiceMode(body.mode || 'LIVE_SAARAS_ASR')
      if (!body.transcript) throw new Error(body.note || 'No transcript was returned. Type the request instead; no transcript was fabricated.')
      setVoiceTranscript(body.transcript || '')
      setVoiceLanguageCode(body.language_code || '')
      setAgentPrompt(body.transcript || '')
    } catch (e) { setError(e instanceof Error ? e.message : 'Voice transcription is unavailable') }
    finally { setVoiceBusy(false) }
  }

  const startMicrophoneRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Live recording is not supported by this browser. Use the audio file upload or typed query.')
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
      recorder.onerror = () => setError('Microphone recording failed. Check browser microphone permissions and retry.')
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
      // Saaras v4 REST accepts recordings up to 30 seconds. Stop slightly early
      // to leave room for browser/container metadata and avoid a predictable 4xx.
      recordingTickRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - recordingStartedAtRef.current) / 1000)
        setRecordingSeconds(elapsed)
        if (elapsed >= 28 && recorder.state !== 'inactive') recorder.stop()
      }, 250)
    } catch (e) {
      setError(e instanceof Error ? `Microphone permission unavailable: ${e.message}` : 'Microphone permission unavailable.')
    }
  }

  const stopMicrophoneRecording = () => {
    if (recordingTickRef.current !== null) window.clearInterval(recordingTickRef.current)
    recordingTickRef.current = null
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop()
  }

  const bindSpokenReference = async () => {
    if (!spokenReference.trim()) return
    setError(''); setBindingResult(null)
    try {
      const result = await request('/voice/bind-reference', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ spoken_reference: spokenReference, max_distance: 2 }) })
      setBindingResult(result)
    } catch (e) { setError(e instanceof Error ? e.message : 'Reference matching failed') }
  }

  const compileEvidencePacket = async () => {
    setError('')
    try {
      const res = await fetch(`${API}/evidence-packet/compile`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ case_id: caseId, voice_transcript: voiceTranscript.trim() || null, voice_language_code: voiceLanguageCode || null, options }) })
      if (!res.ok) { const body = await res.json().catch(() => ({})); throw new Error(body.detail || `PDF compilation failed (${res.status})`) }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'SettleGraph_Four_Exhibit_Evidence_Packet.pdf'
      document.body.appendChild(link); link.click(); link.remove()
      URL.revokeObjectURL(url)
      setAudit(await request('/audit'))
      setToast('Four-exhibit packet compiled locally; no dispute was submitted.')
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not compile evidence packet') }
  }

  const speakMerchantText = async () => {
    const textToSpeak = String(agentChat?.assistant_message || agentChat?.message || '')
    if (!textToSpeak) return
    setVoiceBusy(true); setError('')
    try {
      const res = await fetch(`${API}/voice/speak`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: textToSpeak, language_code: 'hi-IN' }) })
      if (!res.ok) { const body = await res.json().catch(() => ({})); throw new Error(body.detail || `Speech synthesis failed (${res.status})`) }
      const blob = await res.blob()
      if (voiceAudioUrl) URL.revokeObjectURL(voiceAudioUrl)
      setVoiceAudioUrl(URL.createObjectURL(blob))
    } catch (e) {
      if ('speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined') {
        window.speechSynthesis.cancel()
        const utterance = new SpeechSynthesisUtterance(textToSpeak)
        utterance.lang = 'hi-IN'
        window.speechSynthesis.speak(utterance)
        setToast('Sarvam TTS unavailable. Using browser speech synthesis locally; audio was not generated by Sarvam.')
      } else {
        setError(e instanceof Error ? `${e.message}. Browser speech synthesis is not available.` : 'Speech synthesis is unavailable')
      }
    }
    finally { setVoiceBusy(false) }
  }

  const runDuplicateDebitCheck = async () => {
    setOpsBusy(true); setError('')
    try {
      const result = await request('/operations/duplicate-debits/check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      setDuplicateResult(result)
      setApprovals(await request('/approvals'))
      setAudit(await request('/audit'))
      setToast(result.detected ? `${result.candidate_count} source-derived duplicate candidate(s) staged for human review. No refund was initiated.` : 'No qualifying duplicate was found in the active source rows.')
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not run duplicate-debit check') }
    finally { setOpsBusy(false) }
  }

  const syncMockPosOrder = async (orderId: string) => {
    setOpsBusy(true); setError('')
    try {
      const result = await request(`/operations/orders/${encodeURIComponent(orderId)}/sync`, { method: 'POST', headers: { 'Idempotency-Key': `SETTLEGRAPH-DEMO-${orderId}` } })
      setPosOrders(await request('/operations/pos-orders'))
      setAudit(await request('/audit'))
      setToast(result.message)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not sync mock order') }
    finally { setOpsBusy(false) }
  }

  const decideApproval = async (approvalId: string, decision: 'APPROVE' | 'REJECT') => {
    setOpsBusy(true); setError('')
    try {
      const result = await request(`/approvals/${encodeURIComponent(approvalId)}/decision`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision, decided_by: 'DEMO_OPERATOR', note: decision === 'APPROVE' ? 'Reviewed for manual handoff; no automated refund.' : 'Rejected during local demo review.' }) })
      setApprovals(await request('/approvals'))
      setAudit(await request('/audit'))
      setToast(result.message)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not record approval decision') }
    finally { setOpsBusy(false) }
  }

  const restoreBuiltInDemo = async () => {
    setImporting(true); setError('')
    try {
      const body = await request('/demo/reset', { method: 'POST' })
      setRecon(body.reconciliation)
      setHealth(await request('/health'))
      setTransactions(await request('/demo/transactions'))
      const newAdjustments = await request('/demo/adjustments')
      const newGraph = await request('/graph/overview')
      setAdjustments(newAdjustments)
      setGraphOverview(newGraph)
      setOptions({ ...defaultOptions })
      setSelectedNode(newGraph.selectable_nodes.find((n: AnyObj) => n.node_type === 'adjustment')?.id || newGraph.selectable_nodes[0]?.id || '')
      setAudit(await request('/audit'))
      const disputeSource = await request('/disputes')
      setDisputeCases(disputeSource.cases || [])
      setCaseId(disputeSource.cases?.[0]?.case_id || '')
      setDisputeEval(null)
      setOperations(await request('/operations/demo'))
      setDuplicateResult(null)
      setToast('Restored the built-in synthetic source reports.')
      setTimeout(() => setToast(''), 4000)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not restore demo data') }
    finally { setImporting(false) }
  }

  const runReconcile = async (nextOptions: SimOptions = options) => {
    setRunning(true); setError('')
    try {
      const result = await request('/demo/reconcile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(nextOptions) })
      setRecon(result); setOptions(nextOptions)
      const q = new URLSearchParams({ bank_credit_delta_paise: String(nextOptions.bank_credit_delta_paise), adjustment_delta_paise: String(nextOptions.adjustment_delta_paise), inject_unknown_adjustment: String(nextOptions.inject_unknown_adjustment), unassign_late_transaction: String(nextOptions.unassign_late_transaction) }).toString()
      setGraphOverview(await request(`/graph/overview?${q}`))
      setAudit(await request('/audit'))
    } catch (e) { setError(e instanceof Error ? e.message : 'Reconciliation failed') }
    finally { setRunning(false) }
  }

  const resetSimulation = () => { void runReconcile({ ...defaultOptions }) }
  const setDelta = (key: 'bank_credit_delta_paise' | 'adjustment_delta_paise', value: number) => {
    const next = { ...options, [key]: value }
    void runReconcile(next)
  }

  const runAgent = async () => {
    setAgentRunning(true); setError(''); setAgentRun(null)
    try {
      const result = await request('/agent/investigate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ options }) })
      setAgentRun(result)
      setInvestigations(await request('/investigations')); setAudit(await request('/audit'))
    } catch (e) { setError(e instanceof Error ? e.message : 'Agent orchestration failed') }
    finally { setAgentRunning(false) }
  }

  const runDispute = async () => {
    if (!caseId) { setError('No dispute case is available. Import a disputes.csv file with the four core reports first.'); return }
    try {
      const result = await request(`/disputes/${caseId}/evaluate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(faults) })
      setDisputeEval(result); setAudit(await request('/audit'))
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not evaluate dispute') }
  }

  const verifyUtr = async () => {
    setUtrResult(null)
    try {
      const parsed = parseInrToPaise(utrAmount)
      const result = await request('/verify-demo-utr', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ utr_rrn: utr.trim(), claimed_amount_paise: parsed }) })
      setUtrResult(result)
    } catch (e) { setError(e instanceof Error ? e.message : 'UTR check failed') }
  }

  const createInvestigation = async () => {
    try {
      const result = await request('/investigations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note, source_node_id: selectedNode || null, options }) })
      setToast(`Investigation #${result.investigation.id} saved to SQLite audit trail.`)
      setInvestigations(await request('/investigations')); setAudit(await request('/audit'))
      setTimeout(() => setToast(''), 4000)
      setTab('audit')
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not create investigation') }
  }

  const filteredTransactions = useMemo(() => transactions.filter(t => {
    const q = transactionSearch.trim().toLowerCase()
    return !q || [t.pg_txn_id, t.utr_rrn, t.order_id, t.payout_batch_id].some(v => String(v || '').toLowerCase().includes(q))
  }), [transactions, transactionSearch])

  if (loading) return <div className="startup"><LoaderCircle className="spin" size={28} /><p>Loading reconciliation engine…</p></div>
  if (!health?.ok) return <div className="startup startup-error"><div className="startup-error-icon"><AlertTriangle size={25} /></div><h1>Workbench could not reach the local engine</h1><p>{error || 'The API health check did not succeed. Start the backend and retry.'}</p><code>Backend: http://127.0.0.1:8000 · API: {API}</code><button className="primary-button" onClick={() => void loadAll()}><RefreshCw size={15} /> Retry connection</button><small>Start <code>start_backend.ps1</code> in the project root, then refresh this screen.</small></div>

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><GitBranch size={21} /></div><div><strong>SettleGraph</strong><span>TEAM ALIENS · TRACK 3</span></div></div>
        <div className="side-label">WORKBENCH</div>
        <nav className="nav-list">
          <NavItem active={tab === 'reconcile'} icon={<Activity size={17} />} label="Settlement run" onClick={() => setTab('reconcile')} />
          <NavItem active={tab === 'evidence'} icon={<Network size={17} />} label="Evidence graph" onClick={() => setTab('evidence')} />
          <NavItem active={tab === 'safety'} icon={<ShieldCheck size={17} />} label="Policy & safety lab" onClick={() => setTab('safety')} />
          <NavItem active={tab === 'vendor'} icon={<Wallet size={17} />} label="Vendor & exceptions" onClick={() => setTab('vendor')} />
          <NavItem active={tab === 'operations'} icon={<ClipboardList size={17} />} label="Counter operations" onClick={() => setTab('operations')} />
          <NavItem active={tab === 'audit'} icon={<FileText size={17} />} label="Investigations & audit" onClick={() => setTab('audit')} />
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-system">
          <div className="system-dot" /><div><strong>Local engine</strong><span>{health?.ok ? 'API connected' : 'API unavailable'}</span></div>
        </div>
        <p className="sidebar-foot">Stage 2 build · v0.5.0<br />No live Paytm connection</p>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div><div className="breadcrumb">FINANCIAL OPERATIONS <ChevronRight size={13} /> {tab.toUpperCase()}</div><h1>{tab === 'reconcile' ? 'Settlement reconciliation' : tab === 'evidence' ? 'Evidence graph explorer' : tab === 'safety' ? 'Policy & safety lab' : tab === 'vendor' ? 'Vendor receivables & exceptions' : tab === 'operations' ? 'Counter operations' : 'Investigations & audit'}</h1></div>
          <div className="top-actions"><span className="synthetic-pill"><span /> {health?.mode === 'BUILT_IN_SYNTHETIC_FIXTURE' ? 'SYNTHETIC DATA' : 'LOCAL CSV DATA'}</span><button className="icon-button" title="Refresh data" onClick={() => void loadAll()}><RefreshCw size={16} /></button></div>
        </header>

        {error && <div className="alert alert-error"><AlertTriangle size={17} /><span>{error}</span><button onClick={() => setError('')}><XCircle size={16} /></button></div>}
        {toast && <div className="alert alert-success"><CheckCircle2 size={17} />{toast}</div>}

        {tab === 'reconcile' && recon && <>
          <section className="intro-row"><div><h2>Morning payout check</h2><p>Compare captured payments, source-recorded adjustments, the selected payout batch and the matching bank credit.</p></div><div className="run-meta"><Clock3 size={14} /> Capture date <strong>{recon.target_capture_date}</strong></div></section>
          <section className="import-toolbar">
            <div className="import-copy"><div className="import-icon"><FileSearch size={17} /></div><div><strong>Load source reports</strong><span>Upload one ZIP with transactions.csv, adjustments.csv, settlement_batches.csv and bank_credits.csv. Use synthetic or redacted test data only.</span></div></div>
            <div className="import-fields"><label><span>Capture date</span><input type="date" value={targetCaptureDate} onChange={e => setTargetCaptureDate(e.target.value)} /></label><label><span>Target batch ID</span><input value={targetBatchId} onChange={e => setTargetBatchId(e.target.value)} /></label></div>
            <div className="import-actions"><a className="subtle-download" href={`${API}/sample-bundle.zip`}><Download size={14} /> Sample CSV bundle</a><label className={`upload-button ${importing ? 'disabled' : ''}`}><input type="file" accept=".zip,application/zip" disabled={importing} onChange={e => { void uploadBundle(e.target.files?.[0]); e.currentTarget.value = '' }} />{importing ? <LoaderCircle size={14} className="spin" /> : <FileSearch size={14} />}{importing ? 'Loading reports…' : 'Upload ZIP'}</label><button className="restore-button" onClick={() => void restoreBuiltInDemo()} disabled={importing}><RefreshCw size={14} /> Restore demo</button></div>
            <div className="raw-csv-preview"><label className={`subtle-upload ${rawPreviewing ? 'disabled' : ''}`}><input type="file" accept=".csv,text/csv" disabled={rawPreviewing} onChange={e => { void previewPaytmCsv(e.target.files?.[0]); e.currentTarget.value = '' }} />{rawPreviewing ? <LoaderCircle size={14} className="spin" /> : <FileSearch size={14} />}{rawPreviewing ? 'Previewing…' : 'Preview raw Paytm-style CSV'}</label><small>Preview → register mapping · staging only</small></div>
          </section>
          {rawPreview && <section className="panel raw-preview-panel"><PanelHeader icon={<FileSearch size={18} />} title="Raw settlement CSV preview" subtitle="Exact decimal-to-paise normalization · source hash · batch mapping remains explicit" right={<span className="status-pill status-warn">PREVIEWED</span>} /><div className="preview-stats"><Fact label="Rows parsed" value={String(rawPreview.row_count)} /><Fact label="Unassigned to batch" value={String(rawPreview.unresolved_batch_assignment_count)} /><Fact label="File SHA-256" value={shortHash(rawPreview.source_file_sha256)} /></div><div className="preview-notes">{(rawPreview.notes || []).map((line: string, i: number) => <p key={i}>• {line}</p>)}</div><div className="table-wrap"><table><thead><tr><th>Transaction</th><th>Amount</th><th>Commission</th><th>GST</th><th>Settled</th><th>UTR</th></tr></thead><tbody>{(rawPreview.sample_rows || []).map((row: AnyObj) => <tr key={`${row.transaction_id}-${row.source_row_number}`}><td><code>{row.transaction_id}</code></td><td>{row.amount_paise == null ? '—' : money(row.amount_paise)}</td><td>{row.commission_paise == null ? '—' : money(row.commission_paise)}</td><td>{row.gst_paise == null ? '—' : money(row.gst_paise)}</td><td>{row.settled_amount_paise == null ? '—' : money(row.settled_amount_paise)}</td><td>{row.utr || '—'}</td></tr>)}</tbody></table></div><div className="mapping-form"><div className="mapping-title"><strong>Register explicit payout mapping</strong><span>Use values checked against the settlement-level report and bank statement. This stages the export; it does not silently fabricate missing source files.</span></div><div className="mapping-fields"><label><span>Capture date</span><input type="date" value={rawCaptureDate} onChange={e => setRawCaptureDate(e.target.value)} /></label><label><span>Batch ID</span><input value={rawBatchId} onChange={e => setRawBatchId(e.target.value)} /></label><label><span>Bank payout UTR</span><input value={rawPayoutUtr} onChange={e => setRawPayoutUtr(e.target.value)} placeholder="From bank statement" /></label><label><span>Payout date</span><input type="date" value={rawPayoutDate} onChange={e => setRawPayoutDate(e.target.value)} /></label></div><label className="mapping-ack"><input type="checkbox" checked={rawMappingAcknowledged} onChange={e => setRawMappingAcknowledged(e.target.checked)} /><span>I checked the batch ID, payout UTR and dates against authoritative settlement and bank records. I understand this only stages the source CSV.</span></label><button className="primary-button" onClick={() => void stagePaytmCsv()} disabled={rawStaging || !rawPreviewFile || !rawMappingAcknowledged || !rawBatchId.trim() || !rawPayoutUtr.trim()}>{rawStaging ? <LoaderCircle className="spin" size={14} /> : <Check size={14} />}{rawStaging ? 'Staging source…' : 'Register mapped source'}</button></div></section>}
          {rawStaged.length > 0 && <section className="panel staged-panel"><PanelHeader icon={<ClipboardList size={18} />} title="Mapped Paytm exports" subtitle={`${rawStaged.length} source staging records persisted locally`} /><div className="table-wrap"><table><thead><tr><th>Stage ID</th><th>Batch</th><th>Capture date</th><th>Payout UTR</th><th>Rows</th><th>Status</th></tr></thead><tbody>{rawStaged.map((row: AnyObj) => <tr key={row.stage_id}><td><code>{row.stage_id}</code></td><td>{row.batch_id}</td><td>{row.capture_date}</td><td><code>{row.payout_utr}</code></td><td>{row.row_count}</td><td><span className="status-pill status-warn">STAGED</span></td></tr>)}</tbody></table></div><p className="panel-footnote">Staged rows are not part of the active reconciliation until the matching transaction, adjustment, settlement-batch and bank-credit source reports are imported as a canonical bundle.</p></section>}
          <section className="metric-grid">
            <Metric label="Gross captured" value={recon.gross_captured_display} detail={`${recon.transaction_count} successful/deemed-success rows`} icon={<Wallet size={18} />} />
            <Metric label="Expected payout" value={recon.expected_net_display} detail={`${recon.assigned_transaction_count} rows assigned to selected batch`} icon={<Banknote size={18} />} />
            <Metric label="Bank credit" value={recon.actual_bank_display} detail="Exact batch + payout UTR match" icon={<Landmark size={18} />} />
            <Metric label="Residual" value={recon.residual_display} detail="Expected net − matched bank credit" icon={<Activity size={18} />} emphasis={recon.residual_paise !== 0} />
          </section>
          {recon.cutoff_analysis && <section className="panel cutoff-analysis-panel">
            <PanelHeader icon={<Clock3 size={18} />} title="Capture → nodal event window" subtitle="Two-pointer event pairing · exact transaction reference · no timestamp-only batch assignment" right={<span className={`status-pill ${recon.cutoff_analysis.available && recon.cutoff_analysis.unmatched_capture_ids.length === 0 && recon.cutoff_analysis.ambiguous_capture_ids.length === 0 ? 'status-good' : 'status-warn'}`}>{recon.cutoff_analysis.available ? 'EVENT ANALYSIS' : 'SOURCE EVENTS MISSING'}</span>} />
            <div className="cutoff-metrics">
              <Fact label="Exact event pairs" value={`${recon.cutoff_analysis.matched_count} / ${recon.cutoff_analysis.capture_event_count}`} />
              <Fact label="Cross-date events" value={String(recon.cutoff_analysis.cross_midnight_count)} />
              <Fact label="Cross-date amount" value={money(recon.cutoff_analysis.cross_midnight_amount_paise)} />
              <Fact label="Unmatched / ambiguous" value={`${recon.cutoff_analysis.unmatched_capture_ids.length} / ${recon.cutoff_analysis.ambiguous_capture_ids.length}`} />
            </div>
            <p className="cutoff-note">Window: {recon.cutoff_analysis.window?.before_minutes ?? '—'} minutes before capture through {recon.cutoff_analysis.window?.after_hours ?? '—'} hours after. Exact transaction ID establishes a pair; the source-provided payout batch ID remains authoritative. {recon.cutoff_analysis.reason || ''}</p>
            {(recon.cutoff_analysis.cross_midnight_examples || []).map((event: AnyObj) => <div className="cutoff-event" key={event.transaction_id}><strong>{event.transaction_id}</strong><span>{event.capture_date} {event.capture_ts?.slice(11, 19)} → {event.settlement_date} {event.nodal_settled_ts?.slice(11, 19)}</span><b>{money(event.amount_paise)}</b><small>Source batch: {event.payout_batch_id || 'Unassigned'} · nodal amount match: {event.amount_match == null ? 'not supplied' : String(event.amount_match)}</small></div>)}
            {!recon.cutoff_analysis.available && <p className="cutoff-note cutoff-warning">The imported dataset does not contain nodal settlement event timestamps. No cross-midnight inference is made.</p>}
          </section>}
          <section className="content-grid main-two-col">
            <div className="panel">
              <PanelHeader icon={<Workflow size={18} />} title="Reconciliation proof" subtitle="Source-backed bridge from collection to bank credit" right={<span className={`status-pill ${statusClass(recon.status)}`}>{recon.status.replaceAll('_', ' ')}</span>} />
              <div className="equation-list">
                <EquationRow label="Eligible rows assigned to selected batch" value={recon.current_batch_gross_display} kind="plus" detail="Batch assignment comes from the source reference" />
                {recon.adjustment_buckets.map((b: AnyObj) => <EquationRow key={b.type} label={b.label} value={`− ${money(b.amount_paise)}`} kind="minus" detail={`${b.type} · ${b.known_category ? 'known category' : 'unknown category'}`} />)}
                <div className="equation-total"><div><span>Expected payout</span><small>Current batch gross − recorded debit rows</small></div><strong>{recon.expected_net_display}</strong></div>
                <EquationRow label="Matched bank credit" value={`− ${recon.actual_bank_display}`} kind="minus" detail="Requires payout UTR + batch reference match" />
                <div className={`residual-banner ${recon.residual_paise === 0 && recon.status === 'RECONCILED' ? 'success' : 'warning'}`}>
                  {recon.residual_paise === 0 && recon.status === 'RECONCILED' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                  <div><strong>{recon.residual_paise === 0 && recon.status === 'RECONCILED' ? 'Arithmetic reconciles' : 'Review required'}</strong><span>{recon.status_explanation}</span></div><b>{recon.residual_display}</b>
                </div>
                {recon.known_other_batch_amount_paise !== 0 && <div className="info-note"><Clock3 size={16} /><div><strong>{recon.known_other_batch_amount_display} assigned to another batch</strong><span>{recon.shifted_transaction_count} transaction(s) carry a different explicit payout_batch_id. This is not inferred from timestamps alone.</span></div></div>}
                {recon.issues.length > 0 && <div className="issues-list">{recon.issues.map((issue: string) => <p key={issue}><AlertTriangle size={14} />{issue}</p>)}</div>}
              </div>
              <div className="panel-footer-note"><Fingerprint size={15} /><span>Snapshot SHA-256: <code>{shortHash(recon.snapshot_sha256)}</code></span><span className="muted">Fingerprint only; not proof of source truth.</span></div>
            </div>

            <div className="panel sim-panel">
              <PanelHeader icon={<Activity size={18} />} title="Break-the-ledger lab" subtitle="Change a test input and rerun the same engine" right={<span className="demo-tag">DEMO ONLY</span>} />
              <div className="scenario-box"><div className="scenario-label">SCENARIO 01</div><strong>Bank credited ₹100 less</strong><p>Inject a bank-credit shortfall; the engine should return a non-zero residual.</p><button className="secondary-button" onClick={() => setDelta('bank_credit_delta_paise', -10000)} disabled={running}>Inject −₹100 bank variance <ArrowDownRight size={15} /></button></div>
              <div className="scenario-box"><div className="scenario-label">SCENARIO 02</div><strong>Fee source row is altered</strong><p>Increase the MDR fixture row by ₹10; the expected payout and residual must change exactly.</p><button className="secondary-button" onClick={() => setDelta('adjustment_delta_paise', 1000)} disabled={running}>Inject +₹10 debit row <ArrowDownRight size={15} /></button></div>
              <label className="toggle-row"><span><strong>Unknown adjustment category</strong><small>Insert a source-recorded debit with an unrecognised category.</small></span><input type="checkbox" checked={options.inject_unknown_adjustment} onChange={e => void runReconcile({ ...options, inject_unknown_adjustment: e.target.checked, bank_credit_delta_paise: e.target.checked ? options.bank_credit_delta_paise - 10000 : options.bank_credit_delta_paise + (options.inject_unknown_adjustment ? 10000 : 0) })} /></label>
              <label className="toggle-row"><span><strong>Remove late row's batch reference</strong><small>System should refuse to call the run reconciled.</small></span><input type="checkbox" checked={options.unassign_late_transaction} onChange={e => void runReconcile({ ...options, unassign_late_transaction: e.target.checked })} /></label>
              <button className="reset-button" onClick={resetSimulation} disabled={running}>{running ? <LoaderCircle size={15} className="spin" /> : <RefreshCw size={15} />} Reset to baseline</button>
            </div>
          </section>

          <section className="panel agent-panel">
            <PanelHeader icon={<Workflow size={18} />} title="Investigation agent" subtitle="A policy-driven orchestrator calls tools; it does not ask an LLM to do financial arithmetic." right={<span className="status-pill status-neutral">TOOL ORCHESTRATION</span>} />
            <div className="agent-body"><div className="agent-description"><strong>Run the teammate workflow</strong><p>It reconciles the current scenario, selects an evidence path, opens an exception if required, and records an audit event. All money-moving or external actions remain disabled.</p><button className="primary-button" onClick={() => void runAgent()} disabled={agentRunning}>{agentRunning ? <LoaderCircle size={15} className="spin" /> : <Workflow size={15} />}{agentRunning ? 'Running tools…' : 'Run investigation agent'}</button></div>
              {agentRun ? <div className="agent-output"><div className="agent-result-heading"><span className={`status-pill ${statusClass(agentRun.status)}`}>{agentRun.status.replaceAll('_', ' ')}</span><span className="muted">External actions: disabled</span></div><p className="agent-summary">{agentRun.summary}</p><div className="tool-trace">{agentRun.tool_calls.map((call: AnyObj, idx: number) => <div className="tool-call" key={`${call.tool}-${idx}`}><div className="tool-step">{String(idx + 1).padStart(2, '0')}</div><div><strong>{call.tool}</strong><p>{call.status}</p><small>{JSON.stringify(call.output)}</small></div></div>)}</div><div className="next-step"><strong>Recommended next step</strong><p>{agentRun.recommended_next_step}</p></div></div> : <div className="agent-placeholder"><Workflow size={25} /><strong>Ready to act on verified output</strong><span>Run once on the clean baseline, then inject a ₹100 shortfall and run again. Compare tool choices and case creation.</span></div>}
            </div>
          </section>

          <section className="panel merchant-chat-panel">
            <PanelHeader icon={<Bot size={18} />} title="Merchant AI teammate" subtitle="Optional Sarvam tool-calling when configured; otherwise an explicitly labelled deterministic fallback." right={<span className="status-pill status-neutral">READ-ONLY TOOLS</span>} />
            <div className="merchant-chat-compose"><textarea value={agentPrompt} onChange={e => setAgentPrompt(e.target.value)} rows={2} maxLength={2000} placeholder="Ask about a payout, UTR, order or investigation…" /><button className="primary-button" onClick={() => void sendAgentChat()} disabled={chatting || !agentPrompt.trim()}>{chatting ? <LoaderCircle size={15} className="spin" /> : <MessageSquare size={15} />}{chatting ? 'Checking records…' : 'Ask teammate'}</button><label className={`subtle-upload voice-upload ${voiceBusy || recording ? 'disabled' : ''}`}><input type="file" accept="audio/*" disabled={voiceBusy || recording} onChange={e => { void transcribeMerchantVoice(e.target.files?.[0]); e.currentTarget.value = '' }} />{voiceBusy ? <LoaderCircle size={14} className="spin" /> : <Mic size={14} />}Audio file</label><button className={`secondary-button record-button ${recording ? 'recording' : ''}`} disabled={voiceBusy} onClick={() => recording ? stopMicrophoneRecording() : void startMicrophoneRecording()}>{recording ? <StopCircle size={14} /> : <Radio size={14} />}{recording ? `Stop · ${recordingSeconds}s / 28s` : 'Record live mic'}</button></div>
            <div className="voice-limit-note">Live recording stops at 28 seconds (Sarvam Saaras REST limit: 30 seconds). Uploaded audio should be 30 seconds or less and under 10 MB.</div>
            {voiceTranscript && <div className="voice-transcript"><strong>{voiceMode || 'ASR'} · edit and verify before adding it to a packet · {voiceLanguageCode || 'language not reported'}</strong><textarea value={voiceTranscript} onChange={e => setVoiceTranscript(e.target.value)} rows={3} maxLength={2500} /></div>}
            <div className="reference-bind-row"><label><span>Spoken transaction / UTR reference</span><input value={spokenReference} onChange={e => setSpokenReference(e.target.value)} placeholder="Paste the ASR-recognised ID to find candidates" /></label><button className="secondary-button" onClick={() => void bindSpokenReference()} disabled={!spokenReference.trim()}>Find candidate (≤2 edits)</button>{bindingResult && <div className="binding-result"><strong>{bindingResult.status}</strong><span>{bindingResult.candidate?.label || bindingResult.candidates?.map((c: AnyObj) => c.label).join(' · ') || 'No safe candidate'}</span><small>Confirmation required. No automatic binding or action.</small></div>}</div>
            {agentChat ? <div className="merchant-chat-result"><div className="agent-result-heading"><span className="status-pill status-neutral">{agentChat.agent_mode || 'AGENT'}</span><span className="muted">External actions disabled</span></div><p>{agentChat.assistant_message || agentChat.message}</p>{agentChat.note && <small>{agentChat.note}</small>}<div className="merchant-chat-actions"><button className="secondary-button" onClick={() => void speakMerchantText()} disabled={voiceBusy}><Volume2 size={14} /> Read response aloud</button>{voiceAudioUrl && <audio controls src={voiceAudioUrl} />}</div>{agentChat.tool_calls?.length > 0 && <div className="tool-trace">{agentChat.tool_calls.map((call: AnyObj, idx: number) => <div className="tool-call" key={`${call.tool}-${idx}`}><div className="tool-step">{String(idx + 1).padStart(2, '0')}</div><div><strong>{call.tool}</strong><p>{call.status}</p><small>{JSON.stringify(call.output || call.arguments || {})}</small></div></div>)}</div>}</div> : <div className="chat-empty">Ask about the current payout. The backend computes every rupee amount and the agent can only inspect allow-listed records.</div>}
          </section>

          <section className="panel table-panel">
            <PanelHeader icon={<FileSearch size={18} />} title="Payment source rows" subtitle="Individual records are retained; selecting a row opens its evidence path" right={<div className="search-box"><Search size={14} /><input value={transactionSearch} onChange={e => setTransactionSearch(e.target.value)} placeholder="Search ID, UTR, order…" /></div>} />
            <div className="table-wrap"><table><thead><tr><th>Transaction ID</th><th>Amount</th><th>Method</th><th>Status</th><th>Assigned payout batch</th><th>Source row</th><th /></tr></thead><tbody>
              {filteredTransactions.slice(0, 12).map((t: AnyObj) => <tr key={t.pg_txn_id}><td><code>{t.pg_txn_id}</code></td><td className="amount-cell">{t.gross_display}</td><td>{t.instrument}</td><td><span className={`mini-status ${t.status === 'SUCCESS' ? 'green' : 'amber'}`}>{t.status}</span></td><td className="subtle-cell">{t.payout_batch_id || 'MISSING REFERENCE'}</td><td className="subtle-cell">{t.source_row_id}</td><td><button className="text-button" onClick={() => { setSelectedNode(t.pg_txn_id); setTab('evidence') }}>Trace <ArrowRight size={13} /></button></td></tr>)}
            </tbody></table>{filteredTransactions.length > 12 && <div className="table-caption">Showing 12 of {filteredTransactions.length} matching rows. All {transactions.length} source rows are loaded in the graph.</div>}{filteredTransactions.length === 0 && <div className="empty-state">No matching transaction rows.</div>}</div>
          </section>
        </>}

        {tab === 'evidence' && graphOverview && <>
          <section className="intro-row"><div><h2>Follow the source, not the guess</h2><p>Each edge is created from a source-backed reference. Select a payment or adjustment to inspect its evidence path.</p></div><div className="graph-count"><Network size={15} /><strong>{graphOverview.node_count}</strong> nodes <span>/</span> <strong>{graphOverview.edge_count}</strong> edges</div></section>
          <section className="content-grid graph-grid">
            <div className="panel source-panel"><PanelHeader icon={<FileSearch size={18} />} title="Select a source record" subtitle="Payments, adjustment rows and bank credits" />
              <div className="field-label">SOURCE RECORD</div><select className="select-control" value={selectedNode} onChange={e => setSelectedNode(e.target.value)}>
                {graphOverview.selectable_nodes.map((n: AnyObj) => <option key={n.id} value={n.id}>{n.node_type.toUpperCase()} · {n.id} · {n.details.amount_display || ''}</option>)}
              </select>
              <div className="source-detail-card">
                <div className="source-kind">{trace?.nodes?.[0]?.node_type?.replace('_', ' ') || 'SOURCE'}</div><h3>{trace?.nodes?.[0]?.label || selectedNode}</h3>
                {Object.entries(trace?.nodes?.[0]?.details || {}).map(([k, v]) => <div className="detail-line" key={k}><span>{k.replaceAll('_', ' ')}</span><b>{String(v ?? '—')}</b></div>)}
              </div>
              <div className="trace-message"><CircleHelp size={16} /><span>{trace?.message || 'Select a record to inspect its links.'}</span></div>
            </div>
            <div className="panel trace-panel"><PanelHeader icon={<GitBranch size={18} />} title="Traceable path" subtitle="Node → edge evidence → node" right={trace?.path_found ? <span className="status-pill status-good">BANK PATH FOUND</span> : <span className="status-pill status-warn">PATH INCOMPLETE</span>} />
              {trace?.nodes?.length ? <div className="path-flow">{trace.nodes.map((node: AnyObj, i: number) => <div className="path-step-wrap" key={node.id}><div className={`path-node ${node.node_type}`}><div className="path-node-type">{node.node_type.replaceAll('_', ' ')}</div><strong>{node.label}</strong>{node.details?.amount_display && <b className="path-amount">{node.details.amount_display}</b>}<small>{node.details?.utr_rrn || node.details?.payout_utr || node.details?.transfer_utr || node.details?.source_row_id || 'Source-linked node'}</small></div>{i < trace.nodes.length - 1 && <div className="path-edge"><ArrowRight size={17} /><span>{trace.edges[i]?.relation?.replaceAll('_', ' ')}</span></div>}</div>)}</div> : <div className="empty-state">No path available.</div>}
              <div className="edge-evidence"><h3>Why the system connects these records</h3>{trace?.edges?.length ? trace.edges.map((edge: AnyObj, i: number) => <div className="edge-row" key={`${edge.from}-${edge.to}`}><div className="edge-index">0{i + 1}</div><div><strong>{edge.relation.replaceAll('_', ' ')}</strong><p>{edge.match_rule}</p><small>Evidence reference: {edge.evidence_ref || '—'}</small></div><CheckCircle2 size={16} /></div>) : <p className="muted">No matching bank credit was established from the available references.</p>}</div>
            </div>
          </section>
          <section className="panel"><PanelHeader icon={<Fingerprint size={18} />} title="Provenance notes" subtitle="The security boundary of this prototype" /><div className="provenance-grid"><InfoCard title="Source row IDs" text="Each fixture row preserves a source_row_id so a demo explanation can point to the originating record." /><InfoCard title="Snapshot fingerprint" text={`SHA-256 ${shortHash(recon?.snapshot_sha256)} identifies the canonical loaded demo snapshot; it does not prove the source itself is true.`} /><InfoCard title="Merkle integrity tree" text={`${recon?.merkle_leaf_count ?? 0} source rows · root ${shortHash(recon?.merkle_root_sha256)}. Per-row proofs verify changes relative to this captured dataset, not source authenticity.`} /><InfoCard title="Match rules" text="Batch assignment uses explicit payout_batch_id; bank linkage requires the batch payout UTR to exactly match the bank transfer UTR." /></div></section>
        </>}

        {tab === 'safety' && <>
          <section className="intro-row"><div><h2>Dispute policy lab</h2><p>Run deterministic checks on the active local dispute evidence dataset. Uploaded source rows are not automatically trusted, and this prototype never submits a real Paytm dispute or moves money.</p></div><span className="status-pill status-warn">EXTERNAL ACTIONS DISABLED</span></section>
          <section className="content-grid safety-grid">
            <div className="panel"><PanelHeader icon={<ShieldAlert size={18} />} title="Break-the-case controls" subtitle="Inject controlled faults into a case loaded from the active source bundle" />
              <div className="field-label">ACTIVE DISPUTE EVIDENCE</div><select className="select-control" value={caseId} disabled={disputeCases.length === 0} onChange={e => { setCaseId(e.target.value); setDisputeEval(null); setFaults({ corrupt_otp: false, inject_amount_mismatch: false, inject_courier_conflict: false, force_duplicate_debit: false }) }}>
                {disputeCases.map((item: AnyObj) => <option key={item.case_id} value={item.case_id}>{item.case_id} · {item.order_id || 'order missing'} · {money(item.disputed_paise)}</option>)}
              </select>
              {disputeCases.length === 0 && <div className="empty-state">No dispute evidence cases are loaded. Add an optional <code>disputes.csv</code> to the four-report ZIP. The policy lab will not invent POS or courier evidence.</div>}
              <div className="fault-list">
                <FaultToggle title="Corrupt delivery proof" description="Set OTP proof to unverified." checked={faults.corrupt_otp} onChange={v => setFaults({ ...faults, corrupt_otp: v })} />
                <FaultToggle title="Inject ₹200 amount mismatch" description="Change the invoice amount away from the payment amount." checked={faults.inject_amount_mismatch} onChange={v => setFaults({ ...faults, inject_amount_mismatch: v })} />
                <FaultToggle title="Contradict courier status" description="Change courier status to return-to-origin." checked={faults.inject_courier_conflict} onChange={v => setFaults({ ...faults, inject_courier_conflict: v })} />
                <FaultToggle title="Simulate duplicate debit" description="Stage the case for human approval; do not call a refund API." checked={faults.force_duplicate_debit} onChange={v => setFaults({ ...faults, force_duplicate_debit: v })} />
              </div>
              <button className="primary-button wide" disabled={!caseId} onClick={() => void runDispute()}><ShieldCheck size={16} /> Evaluate policy state</button>
            </div>
            <div className="panel decision-panel"><PanelHeader icon={<Workflow size={18} />} title="Policy outcome" subtitle="A policy state, not an external dispute submission" />
              {!disputeEval ? <div className="empty-state large"><ShieldCheck size={28} /><strong>Ready to evaluate</strong><span>Choose a synthetic case, toggle a fault, and run the deterministic policy checks.</span></div> : <>
                <div className={`decision-state ${statusClass(disputeEval.decision_state)}`}><div><span>DECISION STATE</span><strong>{disputeEval.decision_state.replaceAll('_', ' ')}</strong></div><ShieldCheck size={28} /></div>
                <p className="decision-reason">{disputeEval.reason_summary}</p>
                <div className="decision-facts"><Fact label="Case ID" value={disputeEval.case.case_id} /><Fact label="Disputed amount" value={money(disputeEval.case.disputed_paise)} /><Fact label="External submission" value="Disabled" /><Fact label="Human review required" value="Yes" /></div>
                <div className="evidence-source-refs"><div><span>NODAL SOURCE</span><code>{disputeEval.case.nodal_source_row_id || 'MISSING'}</code></div><div><span>PAYMENT ↔ ORDER</span><code>{disputeEval.case.payment_order_id || 'MISSING'} → {disputeEval.case.order_id || 'MISSING'}</code></div><div><span>POS INVOICE SOURCE</span><code>{disputeEval.case.invoice_source_row_id || 'MISSING'}</code></div><div><span>COURIER SOURCE</span><code>{disputeEval.case.courier_source_row_id || 'MISSING'}</code></div></div>
                <div className="hash-block"><span>Evidence snapshot SHA-256</span><code>{disputeEval.evidence_snapshot_sha256}</code></div>
                <div className="hash-block"><span>3-way Merkle root · Nodal + POS + Courier</span><code>{disputeEval.merkle_root_sha256}</code></div>
                <div className="merkle-leaf-list">{(disputeEval.dispute_merkle?.leaves || []).map((leaf: AnyObj) => <div className="merkle-leaf" key={leaf.kind}><span>{leaf.kind.replaceAll('_', ' ')}</span><code>{leaf.leaf_sha256}</code></div>)}</div>
                <div className="locked-action"><ShieldAlert size={17} /><div><strong>No external API called</strong><span>Policy state is local and synthetic. The Merkle root binds the three supplied evidence records, but does not authenticate Paytm, POS or courier sources. A clean case is only ready for human review.</span></div></div>
              </>}
            </div>
          </section>
          <section className="panel"><PanelHeader icon={<Search size={18} />} title="Counter-reference demo check" subtitle="Checks only the loaded synthetic fixture; it does not query Paytm or NPCI." />
            <div className="utr-form"><label><span>UTR / RRN</span><input value={utr} onChange={e => setUtr(e.target.value)} placeholder="Enter UTR" /></label><label><span>Claimed amount (₹)</span><input inputMode="decimal" value={utrAmount} onChange={e => setUtrAmount(e.target.value)} placeholder="4500.00" /></label><button className="primary-button" onClick={() => void verifyUtr()}><Search size={15} /> Check loaded fixture</button></div>
            {utrResult && <div className={`utr-result ${utrResult.verified ? 'good' : 'warn'}`}><strong>{utrResult.verdict.replaceAll('_', ' ')}</strong><p>{utrResult.message}</p><small>live_paytm_checked: {String(utrResult.live_paytm_checked)}</small></div>}
          </section>
        </>}

        {tab === 'vendor' && <VendorTab request={request} money={money} />}

        {tab === 'operations' && <>
          <section className="intro-row"><div><h2>Counter & payment operations</h2><p>Two operational exceptions from the deck, wired to local synthetic fixtures: duplicate debit review and paid-but-pending POS recovery. {operations?.note || 'No live provider connection is enabled.'}</p></div><span className="status-pill status-warn">SANDBOX · NO MONEY MOVEMENT</span></section>
          <section className="ops-grid">
            <div className="panel ops-card"><PanelHeader icon={<CreditCard size={18} />} title="Duplicate debit shield" subtitle="Exact order · exact paise amount · distinct successful payment IDs/UTRs · ≤120 seconds" />
              <div className="ops-case-summary"><span className="eyebrow">ACTIVE SOURCE ANALYSIS</span><strong>{operations?.duplicate_candidates?.length || 0} candidate pair(s)</strong><p>The detector scans the active transaction rows. It does not depend on a fixed dispute ID or order number. Every candidate is staged for human review only.</p>
                {(operations?.duplicate_candidates || []).slice(0, 4).map((item: AnyObj) => <div className="cutoff-event" key={`${item.order_id}-${item.payment_references?.[0]?.transaction_id}-${item.payment_references?.[1]?.transaction_id}`}><strong>{item.order_id}</strong><span>{money(item.amount_paise)} · {item.window_seconds}s apart</span><small>{item.payment_references?.map((ref: AnyObj) => ref.transaction_id).join(' / ')} · payer check: {item.payer_identity_check || 'NOT_AVAILABLE'}</small></div>)}
                {!operations?.duplicate_candidates?.length && <div className="muted">No qualifying duplicate pairs in the active source data.</div>}
              </div>
              <button className="primary-button wide" disabled={opsBusy || !operations?.duplicate_candidates?.length} onClick={() => void runDuplicateDebitCheck()}>{opsBusy ? <LoaderCircle size={15} className="spin" /> : <ShieldCheck size={15} />}Check & stage all candidates</button>
              {duplicateResult && <div className="ops-result"><span className={`status-pill ${duplicateResult.detected ? 'status-warn' : 'status-neutral'}`}>{duplicateResult.decision_state}</span><p>{duplicateResult.reason}</p><small>{duplicateResult.candidate_count || 0} candidate(s) · {duplicateResult.approvals?.length || 0} approval record(s) · Refund API called: {String(duplicateResult.refund_api_called)}</small></div>}
            </div>
            <div className="panel ops-card"><PanelHeader icon={<Workflow size={18} />} title="Paid but POS still pending" subtitle="Exact proof check before a local idempotent state sync" />{posOrders.map((order: AnyObj) => <div className="pos-order-card" key={order.order_id}><div><span className="eyebrow">MOCK POS ORDER</span><strong>{order.order_id}</strong></div><div className="pos-facts"><Fact label="Payment status" value={order.payment_status} /><Fact label="POS status" value={order.order_status} /><Fact label="Amount" value={money(order.amount_paise)} /><Fact label="UTR" value={order.payment_utr} /></div><button className="primary-button wide" disabled={opsBusy || order.order_status === 'PAID'} onClick={() => void syncMockPosOrder(order.order_id)}>{opsBusy ? <LoaderCircle size={15} className="spin" /> : <RefreshCw size={15} />}{order.order_status === 'PAID' ? 'Mock order is PAID' : 'Run idempotent mock sync'}</button>{order.synced_at && <small className="muted">Synced locally at {stamp(order.synced_at)} · external POS called: false</small>}</div>)}</div>
          </section>
          <section className="panel approvals-panel"><PanelHeader icon={<ClipboardList size={18} />} title="Human approval queue" subtitle={`${approvals.length} locally persisted proposals · decisions never move money`} right={<button className="secondary-button" onClick={() => { void request('/approvals').then(setApprovals) }}>Refresh queue</button>} />{approvals.length === 0 ? <div className="empty-state">No pending approvals. Run the duplicate-debit check above to create a synthetic proposal.</div> : <div className="table-wrap"><table><thead><tr><th>Approval</th><th>Case / Action</th><th>Amount</th><th>Status</th><th>Evidence</th><th>Decision</th></tr></thead><tbody>{approvals.map((item: AnyObj) => <tr key={item.approval_id}><td><code>{item.approval_id}</code></td><td><strong>{item.case_id}</strong><small className="table-sub">{item.action_type}</small></td><td className="amount-cell">{money(item.amount_paise)}</td><td><span className={`status-pill ${item.status === 'PENDING_HUMAN_APPROVAL' ? 'status-warn' : item.status === 'REJECTED' ? 'status-bad' : 'status-good'}`}>{item.status.replaceAll('_', ' ')}</span></td><td><code>{shortHash(item.evidence_sha256)}</code></td><td>{item.status === 'PENDING_HUMAN_APPROVAL' ? <div className="approval-actions"><button className="approve-button" disabled={opsBusy} onClick={() => void decideApproval(item.approval_id, 'APPROVE')}>Approve handoff</button><button className="reject-button" disabled={opsBusy} onClick={() => void decideApproval(item.approval_id, 'REJECT')}>Reject</button></div> : <small>{item.decided_by || '—'} · no external call</small>}</td></tr>)}</tbody></table></div>}</section>
          <div className="info-note ops-safety-note"><ShieldAlert size={16} /><div><strong>Important boundary</strong><span>“Approve handoff” records a local operator decision only. There is no Paytm refund adapter, dispute submission adapter, or real POS connector in this hackathon build. Provider actions require official credentials, contracts, access controls and compliance review.</span></div></div>
        </>}

        {tab === 'audit' && <>
          <section className="intro-row"><div><h2>Investigation register</h2><p>Persisted local records and audit events. This is a prototype audit trail, not a tamper-proof production ledger.</p></div><div className="audit-actions"><a className="secondary-link" href={`${API}/evidence-packet.pdf?${graphQuery}`} target="_blank" rel="noreferrer"><Download size={15} /> Quick PDF</a><button className="primary-button" onClick={() => void compileEvidencePacket()}><FileText size={15} /> Compile 4-exhibit PDF</button></div></section>
          <section className="panel create-case-panel"><div><div className="eyebrow">CREATE CASE</div><h3>Save a source-linked investigation</h3><p>The server recomputes the supplied demo scenario and stores the status, residual, source node and snapshot hash in SQLite.</p></div><div className="create-case-form"><label><span>Case note</span><input value={note} onChange={e => setNote(e.target.value)} maxLength={500} /></label><button className="primary-button" onClick={() => void createInvestigation()}><FileText size={15} /> Create investigation</button></div></section>
          <section className="panel"><PanelHeader icon={<FileSearch size={18} />} title="Saved investigations" subtitle={`${investigations.length} records · persisted locally`} />
            {investigations.length ? <div className="table-wrap"><table><thead><tr><th>ID</th><th>Created at</th><th>Status</th><th>Residual</th><th>Source node</th><th>Snapshot</th></tr></thead><tbody>{investigations.map((row: AnyObj) => <tr key={row.id}><td><strong>INV-{String(row.id).padStart(4, '0')}</strong></td><td>{stamp(row.created_at)}</td><td><span className={`status-pill ${statusClass(row.status)}`}>{row.status.replaceAll('_', ' ')}</span></td><td className="amount-cell">{money(row.residual_paise)}</td><td><code>{row.source_node_id || '—'}</code></td><td><code>{shortHash(row.snapshot_sha256)}</code></td></tr>)}</tbody></table></div> : <div className="empty-state">No investigations yet. Create one above to verify persistence.</div>}
          </section>
          <section className="panel"><PanelHeader icon={<Activity size={18} />} title="Recent audit events" subtitle={`${audit.length} latest events from SQLite`} />
            {audit.length ? <div className="audit-list">{audit.map((row: AnyObj) => <div className="audit-event" key={row.id}><div className="audit-icon"><Activity size={15} /></div><div className="audit-event-main"><strong>{row.event_type.replaceAll('_', ' ')}</strong><p>{row.detail}</p><small>{row.actor} · {stamp(row.created_at)}</small></div><code>{shortHash(row.snapshot_sha256)}</code></div>)}</div> : <div className="empty-state">No audit events yet.</div>}
          </section>
        </>}

        <footer className="page-footer"><span><span className="footer-dot" /> Deterministic local engine</span><span>All figures shown are synthetic test data</span><span>Evidence-first · Human-controlled</span></footer>
      </main>
    </div>
  )
}

function NavItem({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}>{icon}<span>{label}</span>{active && <ChevronRight size={15} className="nav-chevron" />}</button>
}
function Metric({ label, value, detail, icon, emphasis }: { label: string; value: string; detail: string; icon: ReactNode; emphasis?: boolean }) {
  return <div className={`metric-card ${emphasis ? 'metric-danger' : ''}`}><div className="metric-top"><span>{label}</span><div className="metric-icon">{icon}</div></div><strong>{value}</strong><small>{detail}</small></div>
}
function PanelHeader({ icon, title, subtitle, right }: { icon: ReactNode; title: string; subtitle: string; right?: ReactNode }) {
  return <div className="panel-header"><div className="panel-header-icon">{icon}</div><div className="panel-header-text"><h3>{title}</h3><p>{subtitle}</p></div>{right && <div className="panel-header-right">{right}</div>}</div>
}
function EquationRow({ label, value, kind, detail }: { label: string; value: string; kind: 'plus' | 'minus'; detail: string }) {
  return <div className="equation-row"><div className={`equation-marker ${kind}`}>{kind === 'plus' ? '+' : '−'}</div><div className="equation-text"><strong>{label}</strong><small>{detail}</small></div><b>{value}</b></div>
}
function InfoCard({ title, text }: { title: string; text: string }) { return <div className="info-card"><Fingerprint size={17} /><strong>{title}</strong><p>{text}</p></div> }
function FaultToggle({ title, description, checked, onChange }: { title: string; description: string; checked: boolean; onChange: (v: boolean) => void }) { return <label className="fault-toggle"><span><strong>{title}</strong><small>{description}</small></span><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} /></label> }
function Fact({ label, value }: { label: string; value: string }) { return <div className="decision-fact"><span>{label}</span><strong>{value}</strong></div> }
