import { useCallback, useEffect, useState } from 'react'
import { Activity, Ambulance, BedDouble, Loader2, Plus, Receipt, Siren } from 'lucide-react'
import SelectField from '../../components/SelectField'
import StatusChip from '../../components/StatusChip'
import LineChart from '../../components/charts/LineChart'
import { api } from '../../lib/api'

const FIELD_CLASS =
  'h-11 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none transition-colors placeholder:text-mist focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30'
const SUBMIT_CLASS =
  'inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand-700 px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-60'
const GHOST_CLASS =
  'inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-line px-4 text-xs font-bold uppercase tracking-widest text-body transition-colors hover:border-brand-300 hover:text-ink disabled:opacity-60'

const BED_STATUS = [
  { value: 'free', label: 'Free' },
  { value: 'occupied', label: 'Occupied' },
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'closed', label: 'Closed' },
]

const INTAKE_STATUS = [
  { value: 'waiting', label: 'Waiting' },
  { value: 'in_treatment', label: 'In treatment' },
  { value: 'admitted', label: 'Admitted' },
  { value: 'discharged', label: 'Discharged' },
]

export default function HospitalOperationsPage() {
  const [analytics, setAnalytics] = useState(null)
  const [beds, setBeds] = useState([])
  const [admissions, setAdmissions] = useState([])
  const [invoices, setInvoices] = useState([])
  const [intake, setIntake] = useState([])
  const [bedForm, setBedForm] = useState({ ward: '', label: '', kind: 'general' })
  const [admitForm, setAdmitForm] = useState({ patientName: '', bedId: '', reason: '' })
  const [invoiceForm, setInvoiceForm] = useState({ patientName: '', label: '', amount: '' })
  const [intakeForm, setIntakeForm] = useState({ patientName: '', complaint: '' })
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    try {
      const [analyticsData, bedData, admissionData, invoiceData, intakeData] = await Promise.all([
        api.operations.analytics(),
        api.operations.beds(),
        api.operations.admissions('active=true'),
        api.operations.invoices(),
        api.operations.intake('open=true'),
      ])
      setAnalytics(analyticsData)
      setBeds(bedData ?? [])
      setAdmissions(admissionData ?? [])
      setInvoices(invoiceData ?? [])
      setIntake(intakeData ?? [])
    } catch (err) {
      setError(err.message || 'Could not load operations data.')
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    Promise.all([
      api.operations.analytics(),
      api.operations.beds(),
      api.operations.admissions('active=true'),
      api.operations.invoices(),
      api.operations.intake('open=true'),
    ])
      .then(([analyticsData, bedData, admissionData, invoiceData, intakeData]) => {
        if (cancelled) return
        setAnalytics(analyticsData)
        setBeds(bedData ?? [])
        setAdmissions(admissionData ?? [])
        setInvoices(invoiceData ?? [])
        setIntake(intakeData ?? [])
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load operations data.')
      })

    return () => {
      cancelled = true
    }
  }, [])

  async function run(label, action) {
    setBusy(label)
    setError('')
    setNotice('')

    try {
      await action()
      await load()
    } catch (err) {
      setError(err.message || `${label} failed.`)
    } finally {
      setBusy('')
    }
  }

  const revenue = (analytics?.revenue ?? []).map((row) => ({ label: row.month.slice(2), value: row.billed }))
  const topDepartment = Math.max(1, ...(analytics?.topDepartments ?? []).map((row) => row.count))

  return (
    <>
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-brand-700">Hospital operations</p>
        <h1 className="mt-2 flex items-center gap-3 text-3xl font-extrabold tracking-tight text-ink">
          <Activity size={26} className="text-brand-700" />
          Analytics, ward &amp; billing
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-mist">
          Where the money and the beds actually are — revenue, occupancy, no-shows, the emergency
          board and the invoices that back it all.
        </p>
      </header>

      {error ? <p className="mt-6 text-sm font-medium text-danger">{error}</p> : null}
      {notice ? <p className="mt-6 text-sm font-medium text-brand-800">{notice}</p> : null}

      <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-2xl border border-line bg-white p-6 shadow-soft">
          <h2 className="text-lg font-semibold text-ink">Revenue billed by month</h2>
          <div className="mt-4">
            <LineChart data={revenue} label="Revenue billed" height={220} />
          </div>
          <p className="mt-2 text-xs text-mist">
            Collected {invoices.filter((invoice) => invoice.status === 'paid').reduce((sum, invoice) => sum + invoice.total, 0)} ·
            outstanding {invoices.filter((invoice) => invoice.status === 'issued').reduce((sum, invoice) => sum + invoice.total, 0)}
          </p>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-line bg-white p-5 shadow-soft">
            <p className="text-xs uppercase tracking-wide text-mist">Beds occupied</p>
            <p className="mt-1 text-3xl font-extrabold text-ink">
              {analytics?.occupancy?.occupied ?? 0}/{analytics?.occupancy?.beds ?? 0}
            </p>
            <p className="mt-1 text-xs text-mist">
              {analytics?.occupancy?.rate ?? 0}% · {analytics?.occupancy?.inpatients ?? 0} inpatients
            </p>
          </div>

          <div className="rounded-2xl border border-line bg-white p-5 shadow-soft">
            <p className="text-xs uppercase tracking-wide text-mist">No-show rate</p>
            <p className="mt-1 text-3xl font-extrabold text-ink">{analytics?.appointments?.noShowRate ?? 0}%</p>
            <p className="mt-1 text-xs text-mist">
              {analytics?.appointments?.completed ?? 0} completed of {analytics?.appointments?.total ?? 0}
            </p>
          </div>

          <div className="rounded-2xl border border-line bg-white p-5 shadow-soft">
            <p className="text-xs uppercase tracking-wide text-mist">Patient experience</p>
            <p className="mt-1 text-3xl font-extrabold text-ink">{analytics?.experience?.average ?? 0}★</p>
            <p className="mt-1 text-xs text-mist">
              NPS {analytics?.experience?.nps ?? 0} · {analytics?.experience?.satisfaction ?? 0}% rated 4+ from{' '}
              {analytics?.experience?.reviews ?? 0} reviews
            </p>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-white p-6 shadow-soft">
        <h2 className="text-lg font-semibold text-ink">Busiest departments</h2>
        <ul className="mt-4 space-y-2">
          {(analytics?.topDepartments ?? []).map((row) => (
            <li key={row.name} className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-xs font-semibold text-body sm:w-40">
                {row.name}
              </span>
              <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface">
                <span
                  className="block h-full rounded-full bg-brand-600"
                  style={{ width: `${Math.max(6, (row.count / topDepartment) * 100)}%` }}
                />
              </span>
              <span className="w-10 text-right text-xs text-mist">{row.count}</span>
            </li>
          ))}
          {!(analytics?.topDepartments ?? []).length ? (
            <li className="rounded-xl bg-surface px-4 py-6 text-center text-sm text-mist">
              No appointments recorded yet.
            </li>
          ) : null}
        </ul>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-white p-6 shadow-soft">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
            <BedDouble size={18} className="text-brand-700" />
            Ward board
          </h2>

          <form
            onSubmit={(event) => {
              event.preventDefault()
              run('bed', async () => {
                await api.operations.addBed(bedForm)
                setBedForm({ ward: '', label: '', kind: 'general' })
                setNotice('Bed added to the board.')
              })
            }}
            className="mt-4 flex flex-wrap items-end gap-2"
          >
            <input
              value={bedForm.ward}
              onChange={(event) => setBedForm({ ...bedForm, ward: event.target.value })}
              placeholder="Ward"
              aria-label="Ward"
              className={`${FIELD_CLASS} w-full sm:w-32`}
            />
            <input
              value={bedForm.label}
              onChange={(event) => setBedForm({ ...bedForm, label: event.target.value })}
              placeholder="Bed"
              aria-label="Bed label"
              className={`${FIELD_CLASS} w-full sm:w-28`}
            />
            <SelectField
              id="bed-kind"
              size="sm"
              className="w-full sm:w-36"
              value={bedForm.kind}
              onChange={(event) => setBedForm({ ...bedForm, kind: event.target.value })}
              options={['general', 'hdu', 'icu', 'isolation', 'maternity'].map((value) => ({ value, label: value }))}
            />
            <button type="submit" disabled={busy === 'bed'} className={SUBMIT_CLASS}>
              <Plus size={14} /> Add
            </button>
          </form>

          <ul className="mt-4 flex flex-wrap gap-2">
            {beds.map((bed) => (
              <li key={bed.id ?? bed._id} className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2">
                <span className="text-xs font-semibold text-ink">
                  {bed.ward} {bed.label}
                </span>
                <SelectField
                  id={`bed-${bed.id ?? bed._id}`}
                  size="sm"
                  className="w-28"
                  value={bed.status}
                  onChange={(event) => api.operations.setBed(bed.id ?? bed._id, event.target.value).then(load)}
                  options={BED_STATUS}
                />
              </li>
            ))}
            {!beds.length ? <li className="py-4 text-sm text-mist">No beds set up yet.</li> : null}
          </ul>

          <form
            onSubmit={(event) => {
              event.preventDefault()
              run('admit', async () => {
                await api.operations.admit(admitForm)
                setAdmitForm({ patientName: '', bedId: '', reason: '' })
                setNotice('Patient admitted — the bed is now occupied.')
              })
            }}
            className="mt-5 flex flex-wrap items-end gap-2 border-t border-line pt-5"
          >
            <input
              value={admitForm.patientName}
              onChange={(event) => setAdmitForm({ ...admitForm, patientName: event.target.value })}
              placeholder="Patient name"
              aria-label="Patient name"
              className={`${FIELD_CLASS} w-full sm:w-44`}
            />
            <SelectField
              id="admit-bed"
              label="Bed"
              size="sm"
              className="w-full sm:w-40"
              value={admitForm.bedId}
              onChange={(event) => setAdmitForm({ ...admitForm, bedId: event.target.value })}
              options={[
                { value: '', label: 'Unassigned' },
                ...beds.filter((bed) => bed.status === 'free').map((bed) => ({ value: bed.id ?? bed._id, label: `${bed.ward} ${bed.label}` })),
              ]}
            />
            <button type="submit" disabled={busy === 'admit'} className={SUBMIT_CLASS}>
              Admit
            </button>
          </form>

          <ul className="mt-4 divide-y divide-line">
            {admissions.map((entry) => (
              <li key={entry.id ?? entry._id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <div>
                  <p className="text-sm font-semibold text-ink">
                    {entry.patientName} · {entry.ward || 'unassigned'}
                  </p>
                  <p className="mt-0.5 text-xs text-mist">
                    since {new Date(entry.admittedAt).toLocaleDateString()} · {entry.reason || 'no reason recorded'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => run('discharge', () => api.operations.discharge(entry.id ?? entry._id, 'Discharged from the ward'))}
                  disabled={Boolean(busy)}
                  className={GHOST_CLASS}
                >
                  Discharge
                </button>
              </li>
            ))}
            {!admissions.length ? <li className="py-4 text-center text-sm text-mist">No inpatients right now.</li> : null}
          </ul>
        </section>

        <section className="rounded-2xl border border-line bg-white p-6 shadow-soft">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
            <Siren size={18} className="text-danger" />
            Emergency intake
          </h2>
          <p className="mt-1 text-xs text-mist">
            The triage level is seeded from the clinical graph — a nurse can override it.
          </p>

          <form
            onSubmit={(event) => {
              event.preventDefault()
              run('intake', async () => {
                const data = await api.operations.addIntake(intakeForm)
                setIntakeForm({ patientName: '', complaint: '' })
                setNotice(
                  `Logged at triage level ${data.triageLevel}${data.suggestedLevel ? ` (graph suggested ${data.suggestedLevel})` : ''}.`,
                )
              })
            }}
            className="mt-4 space-y-2"
          >
            <input
              value={intakeForm.patientName}
              onChange={(event) => setIntakeForm({ ...intakeForm, patientName: event.target.value })}
              placeholder="Patient name (or 'unknown')"
              aria-label="Intake patient"
              className={FIELD_CLASS}
            />
            <input
              value={intakeForm.complaint}
              onChange={(event) => setIntakeForm({ ...intakeForm, complaint: event.target.value })}
              placeholder="Complaint — e.g. crushing chest pain spreading to the arm"
              aria-label="Complaint"
              className={FIELD_CLASS}
            />
            <button type="submit" disabled={busy === 'intake'} className={`${SUBMIT_CLASS} w-full`}>
              {busy === 'intake' ? <Loader2 size={14} className="animate-spin" /> : <Ambulance size={14} />}
              Log arrival
            </button>
          </form>

          <ul className="mt-4 divide-y divide-line">
            {intake.map((entry) => (
              <li key={entry.id ?? entry._id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">
                    T{entry.triageLevel} · {entry.patientName || 'unknown'}
                    {entry.overridden ? <span className="ml-2 text-[11px] uppercase text-mist">overridden</span> : null}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-mist">
                    {entry.complaint}
                    {entry.concepts?.length ? ` · graph: ${entry.concepts.join(', ')}` : ''}
                  </p>
                </div>
                <SelectField
                  id={`intake-${entry.id ?? entry._id}`}
                  size="sm"
                  className="w-36"
                  value={entry.status}
                  onChange={(event) => api.operations.setIntake(entry.id ?? entry._id, { status: event.target.value }).then(load)}
                  options={INTAKE_STATUS}
                />
              </li>
            ))}
            {!intake.length ? <li className="py-4 text-center text-sm text-mist">Nobody waiting.</li> : null}
          </ul>
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-line bg-white p-6 shadow-soft">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
          <Receipt size={18} className="text-brand-700" />
          Billing &amp; claims
        </h2>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            run('invoice', async () => {
              await api.operations.createInvoice({
                patientName: invoiceForm.patientName,
                lines: [{ label: invoiceForm.label, amount: Number(invoiceForm.amount) || 0, kind: 'consultation' }],
              })
              setInvoiceForm({ patientName: '', label: '', amount: '' })
              setNotice('Invoice issued.')
            })
          }}
          className="mt-4 flex flex-wrap items-end gap-2"
        >
          <input
            value={invoiceForm.patientName}
            onChange={(event) => setInvoiceForm({ ...invoiceForm, patientName: event.target.value })}
            placeholder="Patient"
            aria-label="Invoice patient"
            className={`${FIELD_CLASS} w-full sm:w-44`}
          />
          <input
            value={invoiceForm.label}
            onChange={(event) => setInvoiceForm({ ...invoiceForm, label: event.target.value })}
            placeholder="Line item"
            aria-label="Line item"
            className={`${FIELD_CLASS} w-full sm:w-52`}
          />
          <input
            value={invoiceForm.amount}
            onChange={(event) => setInvoiceForm({ ...invoiceForm, amount: event.target.value })}
            placeholder="Amount"
            inputMode="numeric"
            aria-label="Amount"
            className={`${FIELD_CLASS} w-full sm:w-28`}
          />
          <button type="submit" disabled={busy === 'invoice'} className={SUBMIT_CLASS}>
            {busy === 'invoice' ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Issue invoice
          </button>
        </form>

        <ul className="mt-5 divide-y divide-line">
          {invoices.slice(0, 12).map((invoice) => (
            <li key={invoice.id ?? invoice._id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="text-sm font-semibold text-ink">
                  {invoice.number} · {invoice.patientName || 'patient'}
                  <span className="ml-2 font-normal text-mist">
                    {invoice.total} {invoice.currency}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-mist">
                  {(invoice.lines ?? []).map((line) => line.label).join(', ') || 'no lines'}
                  {invoice.claim?.insurer ? ` · claim ${invoice.claim.status} (${invoice.claim.insurer})` : ''}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <StatusChip status={invoice.status} />

                {invoice.status !== 'paid' ? (
                  <button
                    type="button"
                    onClick={() => run('paid', () => api.operations.setInvoice(invoice.id ?? invoice._id, 'paid'))}
                    disabled={Boolean(busy)}
                    className={GHOST_CLASS}
                  >
                    Mark paid
                  </button>
                ) : null}

                {invoice.claim?.status === 'none' || !invoice.claim?.insurer ? (
                  <button
                    type="button"
                    onClick={() =>
                      run('claim', () =>
                        api.operations.submitClaim(invoice.id ?? invoice._id, {
                          insurer: 'Adamjee',
                          policyNumber: `POL-${String(invoice.number ?? '').slice(-4)}`,
                          status: 'submitted',
                        }),
                      )
                    }
                    disabled={Boolean(busy)}
                    className={GHOST_CLASS}
                  >
                    Submit claim
                  </button>
                ) : null}
              </div>
            </li>
          ))}
          {!invoices.length ? (
            <li className="py-6 text-center text-sm text-mist">No invoices yet.</li>
          ) : null}
        </ul>
      </section>
    </>
  )
}
