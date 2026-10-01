import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  BrainCircuit,
  Check,
  FileUp,
  Loader2,
  PencilLine,
  RotateCcw,
  ShieldCheck,
  X,
} from 'lucide-react'
import SeverityBadge from '../../components/SeverityBadge'
import { api } from '../../lib/api'
import {
  AI_DISCLAIMER,
  MAX_SCAN_BYTES,
  confidencePercent,
  isDicomFile,
  readFileAsDataUrl,
  severityMeta,
} from '../../lib/ai'

const SUBMIT_CLASS =
  'inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand-700 px-6 text-sm font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-60'

const FIELD_CLASS =
  'mt-2 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30'

function formatWhen(value) {
  if (!value) return ''

  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function DoctorAiPage() {
  const inputRef = useRef(null)
  const [status, setStatus] = useState(null)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState('')
  const [patientName, setPatientName] = useState('')
  const [question, setQuestion] = useState('')
  const [state, setState] = useState('idle')
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [feedbackState, setFeedbackState] = useState('idle')
  const [overrideOpen, setOverrideOpen] = useState(false)
  const [notes, setNotes] = useState('')
  const [dragging, setDragging] = useState(false)
  const [history, setHistory] = useState([])

  useEffect(() => {
    let cancelled = false

    Promise.all([api.ai.status().catch(() => null), api.ai.inferences(8).catch(() => [])]).then(
      ([statusData, inferences]) => {
        if (cancelled) return
        setStatus(statusData)
        setHistory(inferences ?? [])
      },
    )

    return () => {
      cancelled = true
    }
  }, [])

  async function acceptFile(candidate) {
    setError('')

    if (!candidate) return

    const dicom = isDicomFile(candidate)
    const allowed = dicom || candidate.type.startsWith('image/')

    if (!allowed) {
      setError('Upload a JPEG, PNG, WebP, or a DICOM (.dcm) file.')
      return
    }
    if (candidate.size > MAX_SCAN_BYTES) {
      setError('Keep scans under 12 MB.')
      return
    }

    setFile(candidate)
    setResult(null)
    setFeedbackState('idle')
    setOverrideOpen(false)

    if (dicom) {
      setPreview('')
      return
    }

    try {
      setPreview(await readFileAsDataUrl(candidate))
    } catch {
      setPreview('')
    }
  }

  function handleDrop(event) {
    event.preventDefault()
    setDragging(false)
    acceptFile(event.dataTransfer?.files?.[0])
  }

  async function handleAnalyze(event) {
    event.preventDefault()

    if (!file) {
      setError('Attach a scan first.')
      return
    }

    setError('')
    setState('analysing')
    setResult(null)
    setFeedbackState('idle')

    try {
      const dataUrl = preview || (await readFileAsDataUrl(file))
      const analysis = await api.ai.analyzeImage({
        image: dataUrl,
        question: question.trim(),
        patientName: patientName.trim(),
      })

      setResult(analysis)
      setState('ready')
      setHistory(await api.ai.inferences(8).catch(() => history))
    } catch (err) {
      setError(err.message || 'The analysis could not be completed.')
      setState('error')
    }
  }

  async function sendFeedback(decision) {
    if (!result?.inferenceId) return

    setFeedbackState('saving')
    setError('')

    try {
      await api.ai.feedback(result.inferenceId, { decision, notes: notes.trim() })
      setFeedbackState(decision === 'confirmed' ? 'confirmed' : 'overridden')
      setOverrideOpen(false)
      setNotes('')
      setHistory(await api.ai.inferences(8).catch(() => history))
    } catch (err) {
      setError(err.message || 'Your feedback could not be saved.')
      setFeedbackState('idle')
    }
  }

  const available = status?.available === true
  const enabled = status?.enabled !== false
  const meta = result ? severityMeta(result.severity) : null

  return (
    <>
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-brand-700">Clinical</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink">AI Assistant</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-mist">
          MedGemma runs on this machine — nothing is sent to an external service. Upload a scan,
          ask a question, and review the findings yourself before anything reaches the patient.
        </p>
      </header>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <span
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-widest ${
            available ? 'bg-brand-50 text-brand-800' : 'bg-danger-bg text-danger'
          }`}
        >
          {available ? <ShieldCheck size={13} /> : <AlertTriangle size={13} />}
          {available ? 'Local model online' : 'Local model offline'}
        </span>

        {status?.health ? (
          <span className="text-xs text-mist">
            {status.health.backend} · {status.health.nGpuLayers === 0 ? 'CPU' : `${status.health.nGpuLayers} GPU layers`}
            {status.health.mmprojOffloaded ? '' : ' · vision on CPU'} · {status.health.modelVersion}
          </span>
        ) : (
          <span className="text-xs text-mist">
            {status?.reason ?? 'Start it with: uvicorn app.main:app (inside ai-service/)'}
          </span>
        )}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <form onSubmit={handleAnalyze} className="rounded-2xl border border-line bg-white p-6 shadow-soft">
          <h2 className="text-lg font-semibold text-ink">New analysis</h2>

          <div
            onDragOver={(event) => {
              event.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`mt-5 rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${
              dragging ? 'border-brand-400 bg-brand-50/60' : 'border-line bg-surface'
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,.dcm,application/dicom"
              className="hidden"
              onChange={(event) => {
                acceptFile(event.target.files?.[0])
                event.target.value = ''
              }}
            />

            {preview ? (
              <img
                src={preview}
                alt="Scan preview"
                className="mx-auto max-h-52 w-auto rounded-xl border border-line object-contain"
              />
            ) : file ? (
              <p className="text-sm font-semibold text-ink">
                {file.name} <span className="text-xs font-normal text-mist">(DICOM — converted on the server)</span>
              </p>
            ) : (
              <>
                <FileUp size={22} className="mx-auto text-brand-700" />
                <p className="mt-3 text-sm font-semibold text-ink">
                  Drop a scan here, or choose a file
                </p>
                <p className="mt-1 text-xs text-mist">JPEG, PNG, WebP, or DICOM up to 12 MB</p>
              </>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="inline-flex h-10 items-center rounded-lg border border-line bg-white px-5 text-sm font-semibold text-body transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
              >
                {file ? 'Replace scan' : 'Choose scan'}
              </button>

              {file ? (
                <button
                  type="button"
                  onClick={() => {
                    setFile(null)
                    setPreview('')
                    setResult(null)
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-mist transition-colors hover:text-danger"
                >
                  <X size={12} />
                  Remove
                </button>
              ) : null}
            </div>
          </div>

          <div className="mt-5">
            <label htmlFor="patientName" className="text-sm font-semibold text-ink">
              Patient label (optional)
            </label>
            <input
              id="patientName"
              value={patientName}
              onChange={(event) => setPatientName(event.target.value)}
              placeholder="Bed 12 · chest X-ray"
              className={FIELD_CLASS}
            />
            <p className="mt-1.5 text-xs text-mist">
              A label for your own reference — it is stored with the inference log, not in the
              patient record.
            </p>
          </div>

          <div className="mt-5">
            <label htmlFor="question" className="text-sm font-semibold text-ink">
              Clinical question (optional)
            </label>
            <textarea
              id="question"
              rows={3}
              maxLength={500}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Is there consolidation in the right lower lobe?"
              className={FIELD_CLASS}
            />
          </div>

          {error ? <p className="mt-4 text-sm font-medium text-danger">{error}</p> : null}

          <button
            type="submit"
            disabled={state === 'analysing' || !available || !enabled}
            className={`${SUBMIT_CLASS} mt-5 w-full`}
          >
            {state === 'analysing' ? <Loader2 size={15} className="animate-spin" /> : <BrainCircuit size={15} />}
            {state === 'analysing' ? 'Analysing on the local model…' : 'Analyze scan'}
          </button>

          {state === 'analysing' ? (
            <p className="mt-3 text-xs text-mist">
              The first run after a restart loads the model into memory — around 10–15 seconds on
              the Consumer GPU GTX 1050-Ti
            </p>
          ) : null}
        </form>

        <div className="space-y-6">
          <section className="rounded-2xl border border-line bg-white p-6 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-ink">Result</h2>
              {result ? <SeverityBadge severity={result.severity} /> : null}
            </div>

            {!result ? (
              <p className="mt-5 rounded-xl bg-surface px-4 py-8 text-sm text-mist">
                Nothing analysed yet — attach a scan and run the assistant.
              </p>
            ) : (
              <>
                <div className="mt-5">
                  <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-mist">
                    <span>Model confidence</span>
                    <span className="text-ink">{confidencePercent(result.confidence)}%</span>
                  </div>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-surface">
                    <div
                      className={`h-full rounded-full ${meta?.bar ?? 'bg-brand-600'}`}
                      style={{ width: `${Math.max(3, confidencePercent(result.confidence))}%` }}
                    />
                  </div>
                </div>

                {meta ? <p className="mt-3 text-xs text-body">{meta.blurb}</p> : null}

                <div className="mt-5 rounded-xl border border-line px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-mist">
                    Reading from the local model
                  </p>
                  <ul className="mt-2 space-y-2">
                    {(result.findings ?? []).map((finding) => (
                      <li key={finding} className="flex items-start gap-3">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-mist" />
                        <span className="text-sm leading-relaxed text-body">{finding}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {result.interpretation ? (
                  <div className="mt-5 rounded-xl border border-brand-200 bg-brand-50/60 px-4 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
                        Interpretation
                      </p>
                      {result.interpretation.model ? (
                        <span className="text-[11px] font-medium text-brand-700/80">
                          reasoned by {result.interpretation.model}
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-2 text-sm leading-relaxed text-brand-900">
                      {result.interpretation.impression}
                    </p>

                    {result.interpretation.keyFindings?.length ? (
                      <ul className="mt-3 space-y-2">
                        {result.interpretation.keyFindings.map((finding) => (
                          <li key={finding} className="flex items-start gap-3">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600" />
                            <span className="text-sm leading-relaxed text-body">{finding}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    {result.interpretation.redFlags?.length ? (
                      <div className="mt-3 rounded-lg border border-danger/30 bg-white px-3 py-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-danger">
                          Red flags
                        </p>
                        <ul className="mt-1 space-y-1">
                          {result.interpretation.redFlags.map((flag) => (
                            <li key={flag} className="text-sm text-body">
                              {flag}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {result.interpretation.nextSteps?.length ? (
                      <div className="mt-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-mist">
                          Next steps
                        </p>
                        <ul className="mt-1 space-y-1">
                          {result.interpretation.nextSteps.map((step) => (
                            <li key={step} className="text-sm text-body">
                              {step}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {result.interpretation.confidenceNote ? (
                      <p className="mt-3 text-xs text-mist">
                        {result.interpretation.confidenceNote}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <div className="mt-5 rounded-xl bg-surface px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-mist">
                    Recommended follow-up
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-body">
                    {result.recommended_followup}
                  </p>
                </div>

                <p className="mt-3 text-xs text-mist">
                  {result.cached ? 'Served from the identical-scan cache · ' : ''}
                  {result.latencyMs ? `${(result.latencyMs / 1000).toFixed(1)}s on this machine · ` : ''}
                  {result.modelVersion}
                </p>

                <div className="mt-5 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
                  <p className="flex items-start gap-2 text-xs font-medium leading-relaxed text-brand-800">
                    <ShieldCheck size={14} className="mt-0.5 shrink-0" />
                    {result.disclaimer || AI_DISCLAIMER}
                  </p>
                </div>

                <div className="mt-5">
                  {feedbackState === 'confirmed' || feedbackState === 'overridden' ? (
                    <p className="flex items-center gap-2 text-sm font-medium text-brand-700">
                      <Check size={14} />
                      {feedbackState === 'confirmed'
                        ? 'Finding confirmed — logged for validation.'
                        : 'Override recorded — thank you.'}
                    </p>
                  ) : (
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => sendFeedback('confirmed')}
                        disabled={feedbackState === 'saving'}
                        className={SUBMIT_CLASS}
                      >
                        <Check size={14} />
                        Confirm finding
                      </button>

                      <button
                        type="button"
                        onClick={() => setOverrideOpen((current) => !current)}
                        className="inline-flex h-11 items-center gap-2 rounded-lg border border-line px-5 text-sm font-semibold text-body transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
                      >
                        <PencilLine size={14} />
                        Override with notes
                      </button>
                    </div>
                  )}

                  {overrideOpen ? (
                    <div className="mt-4">
                      <label htmlFor="override" className="text-sm font-semibold text-ink">
                        What did you change?
                      </label>
                      <textarea
                        id="override"
                        rows={3}
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        placeholder="I disagree with the confidence — the image quality is too low to call."
                        className={FIELD_CLASS}
                      />
                      <button
                        type="button"
                        onClick={() => sendFeedback('overridden')}
                        disabled={feedbackState === 'saving' || notes.trim().length < 3}
                        className={`${SUBMIT_CLASS} mt-3`}
                      >
                        {feedbackState === 'saving' ? 'Saving…' : 'Save override'}
                      </button>
                    </div>
                  ) : null}
                </div>
              </>
            )}
          </section>

          <section className="rounded-2xl border border-line bg-white p-6 shadow-soft">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
              <RotateCcw size={16} className="text-brand-700" />
              Recent analyses
            </h2>

            {history.length ? (
              <ul className="mt-4 divide-y divide-line">
                {history.map((entry) => (
                  <li key={entry.id ?? entry._id} className="flex flex-wrap items-center gap-3 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">
                        {entry.patient || entry.question || 'Unlabelled scan'}
                      </span>
                      <span className="block text-xs text-mist">
                        {formatWhen(entry.createdAt)}
                        {entry.latencyMs ? ` · ${(entry.latencyMs / 1000).toFixed(1)}s` : ''}
                        {entry.cached ? ' · cached' : ''}
                      </span>
                    </span>

                    {entry.kind === 'image' ? <SeverityBadge severity={entry.severity} /> : null}

                    {entry.feedback ? (
                      <span
                        className={`text-xs font-semibold ${
                          entry.feedback.decision === 'confirmed' ? 'text-brand-700' : 'text-mist'
                        }`}
                      >
                        {entry.feedback.decision}
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-mist">awaiting review</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 rounded-xl bg-surface px-4 py-6 text-sm text-mist">
                Your analyses will appear here with the confirm/override decision you recorded.
              </p>
            )}
          </section>
        </div>
      </div>
    </>
  )
}
