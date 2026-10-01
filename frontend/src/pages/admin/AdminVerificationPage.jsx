import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { CalendarDays, Loader2, Mail, MapPin } from 'lucide-react'
import StatusChip from '../../components/StatusChip'
import { api } from '../../lib/api'

const PRIMARY_ACTION =
  'inline-flex h-11 @sm:flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-brand-700 px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-60'

const SECONDARY_ACTION =
  'inline-flex h-11 @sm:flex-1 items-center justify-center whitespace-nowrap rounded-lg border border-line bg-white px-5 text-sm font-semibold text-body transition-colors hover:border-danger hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-60'

const NOTE_INPUT =
  'mt-2 h-11 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none transition-colors placeholder:text-mist focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30'

export default function AdminVerificationPage() {
  const { hospitals, dataState, reload } = useOutletContext()
  const [busyId, setBusyId] = useState(null)
  const [notes, setNotes] = useState({})
  const [error, setError] = useState('')

  const queue = hospitals
    .filter((hospital) => hospital.verification?.status !== 'verified')
    .sort((a, b) => {
      const weight = (hospital) => (hospital.verification?.status === 'pending' ? 0 : 1)
      return weight(a) - weight(b)
    })

  async function decide(id, status) {
    setBusyId(id)
    setError('')

    try {
      await api.admin.setVerification(id, status, notes[id] ?? '')
      setNotes((current) => ({ ...current, [id]: '' }))
      await reload()
    } catch (err) {
      setError(err.message || 'That decision could not be saved.')
    } finally {
      setBusyId(null)
    }
  }

  if (dataState === 'idle' || dataState === 'loading') {
    return <p className="text-sm text-mist">Loading verification queue…</p>
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Verification</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-mist">
          Hospitals upload registration documents from their dashboard. Verifying a hospital puts
          a trust badge on its public page; requesting new documents asks them for clearer scans.
        </p>
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-6 rounded-xl border border-danger/20 bg-danger-bg px-4 py-3 text-sm font-medium text-danger"
        >
          {error}
        </p>
      ) : null}

      {queue.length ? (
        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          {queue.map((hospital) => {
            const id = hospital.id ?? hospital._id
            const verification = hospital.verification ?? {}
            const documents = verification.documents ?? []
            const busy = busyId === id

            return (
              <article
                key={id}
                className="@container flex h-full flex-col rounded-2xl border border-line bg-white shadow-soft"
              >
                <div className="flex items-start justify-between gap-3 p-5 sm:p-6">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-semibold text-ink">{hospital.name}</h2>
                    <div className="mt-2 space-y-1 text-sm text-mist">
                      <p className="flex items-center gap-2">
                        <MapPin size={15} className="shrink-0" aria-hidden="true" />
                        <span className="truncate">
                          {hospital.area} · {hospital.city}
                        </span>
                      </p>
                      {hospital.owner?.email ? (
                        <p className="flex min-w-0 items-center gap-2">
                          <Mail size={15} className="shrink-0" aria-hidden="true" />
                          <span className="truncate">{hospital.owner.email}</span>
                        </p>
                      ) : null}
                      <p className="flex items-center gap-2">
                        <CalendarDays size={15} className="shrink-0" aria-hidden="true" />
                        <span>
                          {verification.submittedAt
                            ? `Submitted ${new Date(verification.submittedAt).toLocaleDateString(
                                'en-US',
                                { month: 'short', day: 'numeric', year: 'numeric' },
                              )}`
                            : 'No documents submitted yet'}
                        </span>
                      </p>
                    </div>
                  </div>

                  <StatusChip status={verification.status ?? 'unverified'} />
                </div>

                {verification.notes || documents.length ? (
                  <div className="space-y-4 border-t border-line px-5 py-5 sm:px-6">
                    {verification.notes ? (
                      <div className="rounded-xl bg-surface px-4 py-3">
                        <p className="text-xs font-bold tracking-widest text-mist uppercase">
                          Last note
                        </p>
                        <p className="mt-1 text-sm leading-relaxed text-body">
                          {verification.notes}
                        </p>
                      </div>
                    ) : null}

                    {documents.length ? (
                      <div>
                        <p className="text-xs font-bold tracking-widest text-mist uppercase">
                          Documents
                        </p>
                        <ul className="mt-3 grid gap-3 sm:grid-cols-3">
                          {documents.map((document) => (
                            <li key={document.url}>
                              <a
                                href={document.url}
                                target="_blank"
                                rel="noreferrer"
                                className="block rounded-xl border border-line p-2 transition-colors hover:border-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
                              >
                                <img
                                  src={document.url}
                                  alt={document.label}
                                  className="aspect-[4/3] w-full rounded-lg object-cover"
                                />
                                <span className="mt-2 block truncate text-xs font-semibold text-ink">
                                  {document.label}
                                </span>
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="mt-auto space-y-4 border-t border-line px-5 py-5 sm:px-6">
                  <div>
                    <label htmlFor={`notes-${id}`} className="text-sm font-semibold text-ink">
                      Reviewer note (optional)
                    </label>
                    <input
                      id={`notes-${id}`}
                      value={notes[id] ?? ''}
                      onChange={(event) =>
                        setNotes((current) => ({ ...current, [id]: event.target.value }))
                      }
                      placeholder="Send a clearer photo of the licence"
                      className={NOTE_INPUT}
                    />
                  </div>

                  <div className="flex flex-col gap-3 @sm:flex-row">
                    <button
                      type="button"
                      onClick={() => decide(id, 'verified')}
                      disabled={busy || !documents.length}
                      className={PRIMARY_ACTION}
                    >
                      {busy ? <Loader2 size={14} className="animate-spin" /> : null}
                      Mark verified
                    </button>
                    <button
                      type="button"
                      onClick={() => decide(id, 'rejected')}
                      disabled={busy}
                      className={SECONDARY_ACTION}
                    >
                      Request new documents
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <p className="mt-8 rounded-2xl border border-line bg-surface px-6 py-8 text-sm text-mist">
          Every hospital on Aurora is verified — new submissions land here.
        </p>
      )}
    </div>
  )
}
