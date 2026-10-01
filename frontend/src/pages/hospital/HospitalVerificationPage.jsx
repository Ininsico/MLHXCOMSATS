import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Plus, ShieldCheck, Trash2 } from 'lucide-react'
import ImageUploadField from '../../components/ImageUploadField'
import StatusChip from '../../components/StatusChip'
import { api } from '../../lib/api'

const FIELD_CLASS =
  'mt-2 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30'

const SUBMIT_CLASS =
  'inline-flex h-11 items-center justify-center rounded-lg bg-brand-700 px-6 text-sm font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-60'

const BLANK_ROW = { label: '', url: '' }

export default function HospitalVerificationPage() {
  const { hospital, reload } = useOutletContext()
  const [rows, setRows] = useState([{ ...BLANK_ROW }])
  const [state, setState] = useState('idle')
  const [error, setError] = useState('')

  const verification = hospital?.verification ?? { status: 'unverified', documents: [] }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setState('saving')

    const documents = rows.filter((row) => row.label.trim().length >= 2 && row.url)

    try {
      await api.hospitals.submitVerification(documents)
      setRows([{ ...BLANK_ROW }])
      setState('saved')
      await reload()
    } catch (err) {
      setError(err.message || 'Your documents could not be submitted.')
      setState('error')
    }
  }

  return (
    <>
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-brand-700">Operations</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink">Verification</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-mist">
          Upload your registration and licence documents. Once the Aurora team verifies them,
          your public page carries a trust badge patients can see.
        </p>
      </header>

      <section className="mt-8 rounded-2xl border border-line bg-white p-6 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-brand-700">
              <ShieldCheck size={20} />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-ink">Verification status</h2>
              <p className="text-sm text-mist">
                {verification.submittedAt
                  ? `Submitted ${new Date(verification.submittedAt).toLocaleDateString('en-US')}`
                  : 'No documents submitted yet'}
              </p>
            </div>
          </div>
          <StatusChip status={verification.status} />
        </div>

        {verification.notes ? (
          <p className="mt-4 rounded-xl bg-surface px-4 py-3 text-sm leading-relaxed text-body">
            Reviewer note: {verification.notes}
          </p>
        ) : null}

        {verification.documents?.length ? (
          <ul className="mt-5 grid gap-4 sm:grid-cols-3">
            {verification.documents.map((document) => (
              <li key={document.url} className="rounded-xl border border-line p-3">
                <img
                  src={document.url}
                  alt={document.label}
                  className="aspect-[4/3] w-full rounded-lg object-cover"
                />
                <p className="mt-2 text-xs font-semibold text-ink">{document.label}</p>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <div className="rounded-2xl border border-line bg-white p-6 shadow-soft">
          <h2 className="text-lg font-semibold text-ink">Submit documents</h2>
          <p className="mt-1 text-sm text-mist">
            Up to five documents — a registration certificate, a licence, or a utility bill work
            well.
          </p>

          <div className="mt-5 space-y-5">
            {rows.map((row, index) => (
              <div key={index} className="rounded-xl border border-line p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <label htmlFor={`label-${index}`} className="text-sm font-semibold text-ink">
                      Document label
                    </label>
                    <input
                      id={`label-${index}`}
                      value={row.label}
                      onChange={(event) =>
                        setRows((current) =>
                          current.map((entry, position) =>
                            position === index ? { ...entry, label: event.target.value } : entry,
                          ),
                        )
                      }
                      placeholder="Registration certificate"
                      className={FIELD_CLASS}
                    />
                  </div>

                  {rows.length > 1 ? (
                    <button
                      type="button"
                      onClick={() =>
                        setRows((current) => current.filter((entry, position) => position !== index))
                      }
                      aria-label="Remove document"
                      className="mt-6 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line text-mist transition-colors hover:border-danger hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
                    >
                      <Trash2 size={14} />
                    </button>
                  ) : null}
                </div>

                <div className="mt-4">
                  <ImageUploadField
                    id={`document-${index}`}
                    label="Document image"
                    hint="PNG, JPG, or WebP up to 4 MB."
                    value={row.url}
                    onChange={(url) =>
                      setRows((current) =>
                        current.map((entry, position) =>
                          position === index ? { ...entry, url } : entry,
                        ),
                      )
                    }
                  />
                </div>
              </div>
            ))}
          </div>

          {rows.length < 5 ? (
            <button
              type="button"
              onClick={() => setRows((current) => [...current, { ...BLANK_ROW }])}
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand-700 transition-colors hover:text-brand-800"
            >
              <Plus size={14} />
              Add another document
            </button>
          ) : null}
        </div>

        {error ? <p className="text-sm font-medium text-danger">{error}</p> : null}

        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" disabled={state === 'saving'} className={SUBMIT_CLASS}>
            {state === 'saving' ? 'Submitting…' : 'Submit for verification'}
          </button>
          {state === 'saved' ? (
            <span className="text-sm font-medium text-brand-700">
              Submitted — the Aurora team will review it.
            </span>
          ) : null}
        </div>
      </form>
    </>
  )
}
