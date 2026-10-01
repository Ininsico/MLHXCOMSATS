import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Copy, Link2, Loader2, Printer, ShieldCheck, Trash2 } from 'lucide-react'
import LabResultsTable from '../../components/LabResultsTable'
import { api } from '../../lib/api'

const SHARE_CLASS =
  'inline-flex items-center gap-2 rounded-full border border-line px-5 py-3 text-xs font-bold uppercase tracking-widest text-body transition duration-300 hover:border-brand-300 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-60'

function Field({ label, value }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-mist">{label}</p>
      <p className="mt-1 text-sm text-ink">{value || '—'}</p>
    </div>
  )
}

export default function PatientLabReportPage() {
  const { orderId } = useParams()
  const [report, setReport] = useState(null)
  const [state, setState] = useState('loading')
  const [shares, setShares] = useState([])
  const [shareUrl, setShareUrl] = useState('')
  const [busy, setBusy] = useState('')
  const [shareError, setShareError] = useState('')

  useEffect(() => {
    let cancelled = false

    api.lab
      .mineReport(orderId)
      .then((data) => {
        if (cancelled) return
        setReport(data?.report ?? null)
        setState('ready')
      })
      .catch((err) => {
        if (!cancelled) setState(err.status === 404 ? 'missing' : 'error')
      })

    return () => {
      cancelled = true
    }
  }, [orderId])

  useEffect(() => {
    let cancelled = false

    api.patients
      .shares()
      .then((data) => {
        if (!cancelled) setShares((data ?? []).filter((entry) => !entry.revokedAt))
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [orderId])

  async function createShare(hours) {
    setBusy('share')
    setShareError('')

    try {
      const data = await api.patients.shareReport(orderId, { ttlHours: hours })
      setShareUrl(data.url)
      const list = await api.patients.shares()
      setShares((list ?? []).filter((entry) => !entry.revokedAt))
    } catch (err) {
      setShareError(err.message || 'Could not create a share link.')
    } finally {
      setBusy('')
    }
  }

  async function revoke(id) {
    setBusy(id)

    try {
      await api.patients.revokeShare(id)
      setShares((current) => current.filter((entry) => (entry.id ?? entry._id) !== id))
      setShareUrl('')
    } catch (err) {
      setShareError(err.message || 'Could not revoke that link.')
    } finally {
      setBusy('')
    }
  }

  return (
    <>
      <div className="mx-auto max-w-3xl print:hidden">
        <Link
          to="/dashboard/lab"
          className="inline-flex items-center gap-2 text-sm font-semibold text-mist transition-colors hover:text-ink"
        >
          <ArrowLeft size={15} />
          Back to lab results
        </Link>
      </div>

      {state === 'loading' ? (
        <p className="mx-auto mt-8 max-w-3xl text-sm text-mist">Loading the report…</p>
      ) : null}

      {state === 'missing' ? (
        <div className="mx-auto mt-8 max-w-3xl rounded-2xl border border-line bg-white p-6 shadow-soft">
          <h1 className="text-xl font-semibold text-ink">Report not available</h1>
          <p className="mt-2 text-sm leading-relaxed text-body">
            This report has not been released yet, or it belongs to another account.
          </p>
          <Link
            to="/dashboard/lab"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-brand-700 px-6 py-3 text-xs font-bold uppercase tracking-widest text-white transition duration-300 hover:-translate-y-0.5 hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
          >
            Back to lab results
          </Link>
        </div>
      ) : null}

      {state === 'error' ? (
        <p className="mx-auto mt-8 max-w-3xl text-sm text-danger">
          Couldn&apos;t load that report right now.
        </p>
      ) : null}

      {state === 'ready' && report ? (
        <>
          <div className="mx-auto mt-6 flex max-w-3xl flex-wrap items-center justify-end gap-3 print:hidden">
            <button
              type="button"
              onClick={() => createShare(24)}
              disabled={busy === 'share'}
              className={SHARE_CLASS}
            >
              {busy === 'share' ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
              Share link · 24h
            </button>
            <button type="button" onClick={() => createShare(168)} disabled={busy === 'share'} className={SHARE_CLASS}>
              <Link2 size={14} />
              7 days
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-full bg-brand-700 px-6 py-3 text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-brand-900/20 transition duration-300 hover:-translate-y-0.5 hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
            >
              <Printer size={14} />
              Print or save as PDF
            </button>
          </div>

          {shareError ? <p className="mx-auto mt-4 max-w-3xl text-sm font-medium text-danger print:hidden">{shareError}</p> : null}

          {shareUrl ? (
            <div className="mx-auto mt-4 flex max-w-3xl flex-wrap items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 px-5 py-4 print:hidden">
              <p className="min-w-0 flex-1 truncate text-xs text-body">{shareUrl}</p>
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(shareUrl)}
                className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold uppercase tracking-widest text-brand-800 transition-colors hover:bg-brand-100"
              >
                <Copy size={12} />
                Copy
              </button>
            </div>
          ) : null}

          {shares.length ? (
            <div className="mx-auto mt-4 max-w-3xl rounded-xl border border-line bg-white px-5 py-4 print:hidden">
              <p className="text-xs font-semibold uppercase tracking-wide text-mist">Active links</p>
              <ul className="mt-3 space-y-2">
                {shares.map((entry) => (
                  <li key={entry.id ?? entry._id} className="flex flex-wrap items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-xs text-body">{entry.url}</span>
                    <span className="flex items-center gap-3">
                      <span className="text-[11px] text-mist">
                        expires {new Date(entry.expiresAt).toLocaleString()} · {entry.views ?? 0} views
                      </span>
                      <button
                        type="button"
                        onClick={() => revoke(entry.id ?? entry._id)}
                        disabled={Boolean(busy)}
                        aria-label="Revoke this link"
                        className="rounded p-1 text-mist transition-colors hover:text-danger disabled:opacity-50"
                      >
                        <Trash2 size={13} />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <article className="mx-auto mt-6 max-w-3xl rounded-2xl border border-line bg-white p-8 shadow-soft print:mt-0 print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
            <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-6">
              <div className="flex items-start gap-4">
                {report.hospital?.logoUrl ? (
                  <img
                    src={report.hospital.logoUrl}
                    alt=""
                    className="h-14 w-14 rounded-xl border border-line object-cover"
                  />
                ) : null}
                <div>
                  <p className="text-lg font-extrabold text-ink">{report.hospital?.name}</p>
                  <p className="mt-1 text-xs text-mist">
                    {report.hospital?.address || `${report.hospital?.area}, ${report.hospital?.city}`}
                  </p>
                  <p className="mt-0.5 text-xs text-mist">{report.hospital?.phone}</p>
                </div>
              </div>

              <div className="text-right">
                <p className="text-xs font-bold uppercase tracking-widest text-brand-700">
                  Laboratory report
                </p>
                <p className="mt-1 text-sm font-semibold text-ink">{report.reportNumber}</p>
                <p className="mt-0.5 text-xs text-mist">
                  Released{' '}
                  {report.sentAt
                    ? new Date(report.sentAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })
                    : '—'}
                </p>
                {report.hospital?.verification?.status === 'verified' ? (
                  <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-800">
                    <ShieldCheck size={12} />
                    Verified hospital
                  </p>
                ) : null}
              </div>
            </header>

            <section className="mt-6 grid gap-4 sm:grid-cols-3">
              <Field label="Patient" value={report.patientName} />
              <Field label="Test" value={report.testName} />
              <Field label="Requested by" value={report.orderedBy || 'Hospital laboratory'} />
            </section>

            <section className="mt-8">
              <h2 className="text-sm font-bold uppercase tracking-wide text-mist">Results</h2>
              <LabResultsTable results={report.results} />
              {!report.results?.length ? (
                <p className="mt-3 text-sm text-body">{report.resultSummary || 'No results recorded.'}</p>
              ) : null}
            </section>

            {report.resultSummary ? (
              <section className="mt-8">
                <h2 className="text-sm font-bold uppercase tracking-wide text-mist">
                  Laboratory summary
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-body">{report.resultSummary}</p>
              </section>
            ) : null}

            {report.interpretation ? (
              <section className="mt-6 rounded-xl bg-surface px-5 py-4">
                <h2 className="text-sm font-bold uppercase tracking-wide text-mist">
                  Doctor&apos;s interpretation
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-body">{report.interpretation}</p>
                <p className="mt-3 text-xs text-mist">Released by {report.sentBy || 'the hospital'}</p>
              </section>
            ) : null}

            <footer className="mt-10 border-t border-line pt-6">
              <div className="flex flex-wrap items-end justify-between gap-6">
                <div>
                  <p className="text-xs text-mist">
                    Reference ranges are specific to this laboratory. Please discuss these results
                    with your doctor before making any treatment decision.
                  </p>
                </div>
                <div className="text-right">
                  <div className="h-10 w-48 border-b border-line" />
                  <p className="mt-1 text-xs text-mist">Authorised signature</p>
                </div>
              </div>
            </footer>
          </article>
        </>
      ) : null}
    </>
  )
}
