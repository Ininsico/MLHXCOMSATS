import { useCallback, useEffect, useState } from 'react'
import { Check, Copy, Loader2, Printer, ShieldCheck, Syringe, Trash2 } from 'lucide-react'
import { api } from '../../lib/api'

const FIELD_CLASS =
  'h-11 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none transition-colors placeholder:text-mist focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30'
const SUBMIT_CLASS =
  'inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand-700 px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-60'

const COMMON = [
  'COVID-19',
  'Influenza',
  'Hepatitis B',
  'Tetanus / Tdap',
  'Measles (MMR)',
  'Polio (OPV/IPV)',
  'HPV',
  'Pneumococcal',
  'Rabies',
  'Other',
]

export default function PatientVaccinationsPage() {
  const [records, setRecords] = useState([])
  const [form, setForm] = useState({
    vaccine: 'COVID-19',
    doseNumber: 1,
    administeredAt: new Date().toISOString().slice(0, 10),
    administeredBy: '',
    batchNumber: '',
    site: '',
  })
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [copied, setCopied] = useState('')

  const load = useCallback(async () => {
    const data = await api.patients.vaccinations()
    setRecords(data ?? [])
  }, [])

  useEffect(() => {
    let cancelled = false

    api.patients
      .vaccinations()
      .then((data) => {
        if (!cancelled) setRecords(data ?? [])
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load your vaccination records.')
      })

    return () => {
      cancelled = true
    }
  }, [])

  async function add(event) {
    event.preventDefault()
    setBusy('add')
    setError('')
    setNotice('')

    try {
      const record = await api.patients.addVaccination(form)
      setNotice(`Recorded — verification code ${record.verificationCode}.`)
      await load()
    } catch (err) {
      setError(err.message || 'Could not record that vaccination.')
    } finally {
      setBusy('')
    }
  }

  async function remove(id) {
    setBusy(id)

    try {
      await api.patients.removeVaccination(id)
      await load()
    } catch (err) {
      setError(err.message || 'Could not remove that record.')
    } finally {
      setBusy('')
    }
  }

  return (
    <>
      <div className="mx-auto max-w-3xl print:hidden">
        <header>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-700">Your record</p>
          <h1 className="mt-2 flex items-center gap-3 text-3xl font-extrabold tracking-tight text-ink">
            <Syringe size={26} className="text-brand-700" />
            Vaccination card
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-mist">
            Every entry carries a verification code, so a school, employer or border officer can
            confirm it without calling the hospital.
          </p>
        </header>

        {error ? <p className="mt-6 text-sm font-medium text-danger">{error}</p> : null}
        {notice ? <p className="mt-6 text-sm font-medium text-brand-800">{notice}</p> : null}

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-full bg-brand-700 px-6 py-3 text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-brand-900/20 transition duration-300 hover:-translate-y-0.5 hover:bg-brand-800"
          >
            <Printer size={14} />
            Print card
          </button>
        </div>
      </div>

      <div className="mx-auto mt-6 max-w-3xl rounded-2xl border border-line bg-white p-8 shadow-soft print:mt-0 print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
          <div>
            <p className="text-lg font-extrabold text-ink">Aurora vaccination record</p>
            <p className="mt-1 text-xs text-mist">{records.length} entr{records.length === 1 ? 'y' : 'ies'}</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-800">
            <ShieldCheck size={12} />
            Verifiable
          </span>
        </header>

        <ul className="mt-4 divide-y divide-line">
          {records.map((record) => (
            <li key={record.id ?? record._id} className="py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-ink">
                    {record.vaccine}
                    <span className="ml-2 font-normal text-mist">dose {record.doseNumber}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-mist">
                    {new Date(record.administeredAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                    {record.administeredBy ? ` · ${record.administeredBy}` : ''}
                    {record.hospital?.name ? ` · ${record.hospital.name}` : ''}
                    {record.batchNumber ? ` · batch ${record.batchNumber}` : ''}
                    {record.site ? ` · ${record.site}` : ''}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => remove(record.id ?? record._id)}
                  disabled={Boolean(busy)}
                  aria-label={`Remove ${record.vaccine}`}
                  className="rounded p-2 text-mist transition-colors hover:text-danger print:hidden"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {record.verificationCode ? (
                <div className="mt-2 flex flex-wrap items-center gap-3 print:hidden">
                  <span className="rounded-lg bg-surface px-3 py-1.5 font-mono text-xs text-body">{record.verificationCode}</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(record.verifyUrl)
                      setCopied(record.id ?? record._id)
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:text-brand-800"
                  >
                    {copied === (record.id ?? record._id) ? <Check size={12} /> : <Copy size={12} />}
                    {copied === (record.id ?? record._id) ? 'copied' : 'copy verify link'}
                  </button>
                </div>
              ) : null}
            </li>
          ))}
          {!records.length ? (
            <li className="py-8 text-center text-sm text-mist">Nothing recorded yet.</li>
          ) : null}
        </ul>
      </div>

      <form onSubmit={add} className="mx-auto mt-6 max-w-3xl rounded-2xl border border-line bg-white p-6 shadow-soft print:hidden">
        <h2 className="text-lg font-semibold text-ink">Add an entry</h2>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="vaccine" className="text-xs font-semibold uppercase tracking-wide text-mist">
              Vaccine
            </label>
            <input
              id="vaccine"
              list="common-vaccines"
              value={form.vaccine}
              onChange={(event) => setForm({ ...form, vaccine: event.target.value })}
              className={`${FIELD_CLASS} mt-1.5`}
            />
            <datalist id="common-vaccines">
              {COMMON.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>

          <div>
            <label htmlFor="dose" className="text-xs font-semibold uppercase tracking-wide text-mist">
              Dose number
            </label>
            <input
              id="dose"
              inputMode="numeric"
              value={form.doseNumber}
              onChange={(event) => setForm({ ...form, doseNumber: Number(event.target.value) || 1 })}
              className={`${FIELD_CLASS} mt-1.5`}
            />
          </div>

          <div>
            <label htmlFor="given" className="text-xs font-semibold uppercase tracking-wide text-mist">
              Date given
            </label>
            <input
              id="given"
              type="date"
              value={form.administeredAt}
              onChange={(event) => setForm({ ...form, administeredAt: event.target.value })}
              className={`${FIELD_CLASS} mt-1.5`}
            />
          </div>

          <div>
            <label htmlFor="by" className="text-xs font-semibold uppercase tracking-wide text-mist">
              Given by
            </label>
            <input
              id="by"
              value={form.administeredBy}
              onChange={(event) => setForm({ ...form, administeredBy: event.target.value })}
              placeholder="Nurse or clinic"
              className={`${FIELD_CLASS} mt-1.5`}
            />
          </div>

          <div>
            <label htmlFor="batch" className="text-xs font-semibold uppercase tracking-wide text-mist">
              Batch number
            </label>
            <input
              id="batch"
              value={form.batchNumber}
              onChange={(event) => setForm({ ...form, batchNumber: event.target.value })}
              className={`${FIELD_CLASS} mt-1.5`}
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="site" className="text-xs font-semibold uppercase tracking-wide text-mist">
              Site
            </label>
            <input
              id="site"
              value={form.site}
              onChange={(event) => setForm({ ...form, site: event.target.value })}
              placeholder="Left arm"
              className={`${FIELD_CLASS} mt-1.5`}
            />
          </div>
        </div>

        <button type="submit" disabled={busy === 'add'} className={`${SUBMIT_CLASS} mt-4 w-full`}>
          {busy === 'add' ? <Loader2 size={15} className="animate-spin" /> : <Syringe size={15} />}
          Record vaccination
        </button>
      </form>
    </>
  )
}
