import { useCallback, useEffect, useState } from 'react'
import { BadgeCheck, BookOpen, Coins, FileSearch, Loader2, ScrollText, Send, ShieldCheck, ToggleRight } from 'lucide-react'
import SelectField from '../../components/SelectField'
import StatusChip from '../../components/StatusChip'
import { api } from '../../lib/api'

const FIELD_CLASS =
  'h-11 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none transition-colors placeholder:text-mist focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30'
const SUBMIT_CLASS =
  'inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand-700 px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-60'
const GHOST_CLASS =
  'inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-line px-4 text-sm font-semibold text-body transition-colors hover:border-brand-300 hover:text-ink disabled:opacity-60'

const FLAGS = ['ai', 'voice', 'whatsapp', 'therapy', 'nurse', 'marketplace', 'lab']

export default function AdminPlatformPage() {
  const [usage, setUsage] = useState(null)
  const [requests, setRequests] = useState([])
  const [events, setEvents] = useState([])
  const [corpus, setCorpus] = useState(null)
  const [flags, setFlags] = useState({ ai: true, voice: true, whatsapp: true, therapy: true, nurse: true, marketplace: true, lab: true })
  const [hospitalId, setHospitalId] = useState('')
  const [guideline, setGuideline] = useState({ title: '', text: '' })
  const [patientId, setPatientId] = useState('')
  const [exported, setExported] = useState(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    try {
      const [usageData, requestData, eventData, corpusData] = await Promise.all([
        api.platform.usage(),
        api.platform.subscriptionRequests(),
        api.platform.audit('limit=12'),
        api.platform.corpusStats(),
      ])
      setUsage(usageData)
      setRequests(requestData ?? [])
      setEvents(eventData ?? [])
      setCorpus(corpusData)
      return usageData
    } catch (err) {
      setError(err.message || 'Could not load the platform data.')
      return null
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    Promise.all([
      api.platform.usage(),
      api.platform.subscriptionRequests(),
      api.platform.audit('limit=12'),
      api.platform.corpusStats(),
    ])
      .then(([usageData, requestData, eventData, corpusData]) => {
        if (cancelled) return
        setUsage(usageData)
        setRequests(requestData ?? [])
        setEvents(eventData ?? [])
        setCorpus(corpusData)

        const firstHospital = usageData?.perHospital?.[0]?.hospital
        if (firstHospital) setHospitalId(firstHospital)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load the platform data.')
      })

    return () => {
      cancelled = true
    }
  }, [])

  async function decide(id, body, label) {
    setBusy(`${id}-${label}`)
    setError('')
    setNotice('')

    try {
      await api.platform.decideSubscription(id, body)
      setNotice(`${label} done.`)
      await load()
    } catch (err) {
      setError(err.message || `${label} failed.`)
    } finally {
      setBusy('')
    }
  }

  async function saveFlags() {
    if (!hospitalId) {
      setError('Choose a hospital first.')
      return
    }

    setBusy('flags')

    try {
      await api.platform.setFlags(hospitalId, flags)
      setNotice('Feature flags saved for that hospital.')
    } catch (err) {
      setError(err.message || 'Could not save flags.')
    } finally {
      setBusy('')
    }
  }

  async function addGuideline(event) {
    event.preventDefault()
    setBusy('corpus')

    try {
      await api.platform.addCorpusDocument(guideline)
      setGuideline({ title: '', text: '' })
      setNotice('Guideline embedded into the corpus — the agents can now cite it.')
      const stats = await api.platform.corpusStats()
      setCorpus(stats)
    } catch (err) {
      setError(err.message || 'Could not add the guideline.')
    } finally {
      setBusy('')
    }
  }

  async function reindex() {
    setBusy('reindex')

    try {
      await api.platform.reindexCorpus()
      setNotice('Corpus reindexed.')
      setCorpus(await api.platform.corpusStats())
    } catch (err) {
      setError(err.message || 'Reindex failed — is the AI service running?')
    } finally {
      setBusy('')
    }
  }

  async function exportPatient() {
    if (!patientId) return
    setBusy('export')

    try {
      const data = await api.platform.exportPatient(patientId)
      setExported(data)
      setNotice(`Export ready — ${Object.entries(data.counts ?? {}).map(([key, value]) => `${key} ${value}`).join(', ')}`)
    } catch (err) {
      setError(err.message || 'Could not export that record.')
    } finally {
      setBusy('')
    }
  }

  return (
    <>
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-brand-700">Aurora platform</p>
        <h1 className="mt-2 flex items-center gap-3 text-3xl font-extrabold tracking-tight text-ink">
          <ShieldCheck size={26} className="text-brand-700" />
          Metering, billing &amp; safety
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-mist">
          What every hospital's AI actually costs, which plans are waiting on payment
          verification, what the corpus contains, and what has been done in your name.
        </p>
      </header>

      {error ? <p className="mt-6 text-sm font-medium text-danger">{error}</p> : null}
      {notice ? <p className="mt-6 text-sm font-medium text-brand-800">{notice}</p> : null}

      <section className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-line bg-white p-6 shadow-soft">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Coins size={16} className="text-brand-700" />
            AI tokens this period
          </h2>
          <p className="mt-3 text-3xl font-extrabold tracking-tight text-ink">
            {usage?.totals?.tokens ?? 0}
          </p>
          <p className="mt-1 text-xs text-mist">
            {usage?.totals?.auroraTurns ?? 0} Aurora turns · {usage?.totals?.nurseTurns ?? 0} nurse turns ·{' '}
            {usage?.totals?.whatsappThreads ?? 0} WhatsApp threads
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-white p-6 shadow-soft">
          <h2 className="text-sm font-semibold text-ink">Clinical AI</h2>
          <p className="mt-3 text-3xl font-extrabold tracking-tight text-ink">
            {usage?.totals?.clinicalInferences ?? 0}
          </p>
          <p className="mt-1 text-xs text-mist">
            inferences from doctors and radiologists, logged with feedback
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-white p-6 shadow-soft">
          <h2 className="text-sm font-semibold text-ink">Waiting on you</h2>
          <p className="mt-3 text-3xl font-extrabold tracking-tight text-ink">
            {requests.filter((request) => request.status === 'pending').length}
          </p>
          <p className="mt-1 text-xs text-mist">
            plan requests pending payment verification
          </p>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-white p-6 shadow-soft">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
          <BadgeCheck size={18} className="text-brand-700" />
          Hospital usage
        </h2>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-mist">
                <th className="pb-2">Hospital</th>
                <th className="pb-2">Tokens</th>
                <th className="pb-2">Turns</th>
                <th className="hidden pb-2 md:table-cell">Breakdown</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(usage?.perHospital ?? []).map((row) => (
                <tr key={row.hospital}>
                  <td className="py-3">
                    <span className="font-semibold text-ink">{row.name}</span>
                    <span className="ml-2 text-xs text-mist">{row.city}</span>
                  </td>
                  <td className="py-3 font-semibold text-ink">{row.tokens}</td>
                  <td className="py-3 text-body">{row.turns}</td>
                  <td className="hidden py-3 text-xs text-mist md:table-cell">
                    {Object.entries(row.byKind ?? {}).map(([kind, value]) => `${kind} ${value}`).join(' · ') || '—'}
                  </td>
                </tr>
              ))}
              {!(usage?.perHospital ?? []).length ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-sm text-mist">
                    No hospital-attributed usage yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-white p-6 shadow-soft">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
          <Coins size={18} className="text-brand-700" />
          Plan requests
        </h2>
        <p className="mt-1 text-xs text-mist">
          A plan is never switched on an unverified payment — verify first, then approve.
        </p>

        <ul className="mt-4 space-y-3">
          {requests.map((request) => (
            <li key={request.id ?? request._id} className="rounded-xl border border-line px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink">
                    {request.hospital?.name} · {request.requestedPlan}
                    <span className="ml-2 font-normal text-mist">
                      {request.amount} {request.currency} {request.billingCycle}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-mist">
                    {request.requestedByName} · {new Date(request.createdAt).toLocaleDateString()}
                    {request.payment?.reference ? ` · ref ${request.payment.reference}` : ''}
                    {request.payment?.verified ? ' · payment verified' : ' · payment unverified'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <StatusChip status={request.status} />

                  {request.status === 'pending' && !request.payment?.verified ? (
                    <button
                      type="button"
                      onClick={() => decide(request.id ?? request._id, { action: 'verify-payment', note: 'Checked against the bank statement' }, 'verify-payment')}
                      disabled={Boolean(busy)}
                      className={GHOST_CLASS}
                    >
                      {busy === `${request.id ?? request._id}-verify-payment` ? <Loader2 size={14} className="animate-spin" /> : null}
                      Verify payment
                    </button>
                  ) : null}

                  {request.status === 'pending' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => decide(request.id ?? request._id, { action: 'approve' }, 'approve')}
                        disabled={Boolean(busy)}
                        className={SUBMIT_CLASS}
                      >
                        {busy === `${request.id ?? request._id}-approve` ? <Loader2 size={14} className="animate-spin" /> : null}
                        Approve &amp; activate
                      </button>
                      <button
                        type="button"
                        onClick={() => decide(request.id ?? request._id, { action: 'reject', note: 'Could not match the payment' }, 'reject')}
                        disabled={Boolean(busy)}
                        className="text-xs font-semibold text-mist transition-colors hover:text-danger disabled:opacity-60"
                      >
                        Reject
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
          {!requests.length ? (
            <li className="rounded-xl bg-surface px-4 py-6 text-center text-sm text-mist">
              No plan requests waiting.
            </li>
          ) : null}
        </ul>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-white p-6 shadow-soft">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
            <ToggleRight size={18} className="text-brand-700" />
            Feature flags
          </h2>

          <SelectField
            id="flag-hospital"
            label="Hospital"
            className="mt-4"
            value={hospitalId}
            onChange={(event) => setHospitalId(event.target.value)}
            options={[
              { value: '', label: 'Choose a hospital…' },
              ...(usage?.perHospital ?? []).map((row) => ({ value: row.hospital, label: row.name })),
            ]}
          />

          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {FLAGS.map((flag) => (
              <label key={flag} className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2 text-sm text-body">
                <input
                  type="checkbox"
                  checked={Boolean(flags[flag])}
                  onChange={(event) => setFlags({ ...flags, [flag]: event.target.checked })}
                />
                {flag}
              </label>
            ))}
          </div>

          <button type="button" onClick={saveFlags} disabled={busy === 'flags'} className={`${SUBMIT_CLASS} mt-4`}>
            {busy === 'flags' ? <Loader2 size={14} className="animate-spin" /> : null}
            Save flags
          </button>
        </section>

        <section className="rounded-2xl border border-line bg-white p-6 shadow-soft">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
            <BookOpen size={18} className="text-brand-700" />
            Clinical corpus
          </h2>
          <p className="mt-1 text-xs text-mist">
            {corpus?.chunks ?? 0} chunks from {corpus?.sources?.length ?? 0} sources — what the
            agents ground their answers in.
          </p>

          <form onSubmit={addGuideline} className="mt-4 space-y-3">
            <input
              value={guideline.title}
              onChange={(event) => setGuideline({ ...guideline, title: event.target.value })}
              placeholder="Guideline title"
              aria-label="Guideline title"
              className={FIELD_CLASS}
            />
            <textarea
              value={guideline.text}
              onChange={(event) => setGuideline({ ...guideline, text: event.target.value })}
              rows={5}
              placeholder="Paste the guidance text (at least 40 characters)…"
              aria-label="Guideline text"
              className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30"
            />
            <div className="flex flex-wrap gap-3">
              <button type="submit" disabled={busy === 'corpus'} className={SUBMIT_CLASS}>
                {busy === 'corpus' ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Add to corpus
              </button>
              <button type="button" onClick={reindex} disabled={busy === 'reindex'} className={GHOST_CLASS}>
                {busy === 'reindex' ? <Loader2 size={14} className="animate-spin" /> : null}
                Reindex
              </button>
            </div>
          </form>

          <ul className="mt-3 flex flex-wrap gap-2">
            {(corpus?.sources ?? []).map((source) => (
              <li key={source} className="rounded-full bg-surface px-3 py-1 text-[11px] text-body">
                {source}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-white p-6 shadow-soft">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
            <ScrollText size={18} className="text-brand-700" />
            Audit trail
          </h2>

          <ul className="mt-4 divide-y divide-line">
            {events.map((event) => (
              <li key={event.id ?? event._id} className="py-2.5">
                <p className="text-xs font-semibold text-ink">{event.action}</p>
                <p className="mt-0.5 text-xs text-mist">
                  {event.actorName || 'system'} ({event.actorRole || '—'}) ·{' '}
                  {new Date(event.createdAt).toLocaleString()} · {event.summary}
                </p>
              </li>
            ))}
            {!events.length ? (
              <li className="py-6 text-center text-sm text-mist">Nothing recorded yet.</li>
            ) : null}
          </ul>
        </section>

        <section className="rounded-2xl border border-line bg-white p-6 shadow-soft">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
            <FileSearch size={18} className="text-brand-700" />
            Patient data requests
          </h2>
          <p className="mt-1 text-xs text-mist">
            Export bundles everything on the record; erasure removes the identity and keeps the
            clinical entries anonymised, with an audit line either way.
          </p>

          <div className="mt-4 flex flex-wrap gap-3">
            <input
              value={patientId}
              onChange={(event) => setPatientId(event.target.value)}
              placeholder="Patient account id"
              aria-label="Patient id"
              className={`${FIELD_CLASS} flex-1`}
            />
            <button type="button" onClick={exportPatient} disabled={busy === 'export'} className={SUBMIT_CLASS}>
              {busy === 'export' ? <Loader2 size={14} className="animate-spin" /> : null}
              Export
            </button>
            <button
              type="button"
              onClick={() => {
                if (patientId && window.confirm('Erase this patient’s identity? Clinical entries are anonymised, not deleted.')) {
                  api.platform
                    .erasePatient(patientId)
                    .then((data) => setNotice(`Erasure done — ${JSON.stringify(data.removed)}`))
                    .catch((err) => setError(err.message))
                }
              }}
              disabled={busy === 'erase'}
              className={GHOST_CLASS}
            >
              Erase
            </button>
          </div>

          {exported ? (
            <ul className="mt-4 space-y-1 rounded-xl bg-surface px-4 py-3">
              {Object.entries(exported.counts ?? {}).map(([key, value]) => (
                <li key={key} className="flex justify-between text-xs text-body">
                  <span>{key}</span>
                  <span className="font-semibold text-ink">{value}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>
    </>
  )
}
