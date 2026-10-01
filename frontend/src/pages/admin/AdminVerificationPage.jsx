import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import StatusChip from '../../components/StatusChip'
import { api } from '../../lib/api'

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
    <>
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Verification</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-mist">
          Hospitals upload registration documents from their dashboard. Verifying a hospital puts
          a trust badge on its public page; rejecting asks them for clearer documents.
        </p>
      </div>

      {error ? <p className="mt-6 text-sm font-medium text-danger">{error}</p> : null}

      {queue.length ? (
        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          {queue.map((hospital) => {
            const id = hospital.id ?? hospital._id
            const verification = hospital.verification ?? {}
            const busy = busyId === id

            return (
              <article key={id} className="rounded-2xl border border-line bg-white p-6 shadow-soft">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-ink">{hospital.name}</h2>
                    <p className="mt-1 text-sm text-mist">
                      {hospital.area} · {hospital.city}
                      {hospital.owner?.email ? ` · ${hospital.owner.email}` : ''}
                    </p>
                    {verification.submittedAt ? (
                      <p className="mt-1 text-xs text-mist">
                        Submitted{' '}
                        {new Date(verification.submittedAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-mist">No documents submitted yet</p>
                    )}
                  </div>
                  <StatusChip status={verification.status ?? 'unverified'} />
                </div>

                {verification.notes ? (
                  <p className="mt-4 rounded-xl bg-surface px-4 py-3 text-xs text-body">
                    Last note: {verification.notes}
                  </p>
                ) : null}

                {verification.documents?.length ? (
                  <ul className="mt-4 grid gap-3 sm:grid-cols-3">
                    {verification.documents.map((document) => (
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
                ) : null}

                <div className="mt-5">
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
                    className="mt-2 h-11 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none transition-colors focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30"
                  />
                </div>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => decide(id, 'verified')}
                    disabled={busy || !verification.documents?.length}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand-700 px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-60"
                  >
                    {busy ? <Loader2 size={14} className="animate-spin" /> : null}
                    Mark verified
                  </button>
                  <button
                    type="button"
                    onClick={() => decide(id, 'rejected')}
                    disabled={busy}
                    className="inline-flex h-10 items-center justify-center rounded-lg border border-line px-5 text-sm font-semibold text-body transition-colors hover:border-danger hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-60"
                  >
                    Request new documents
                  </button>
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
    </>
  )
}
