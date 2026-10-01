import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { FlaskConical } from 'lucide-react'
import LabResultsTable from '../../components/LabResultsTable'
import SelectField from '../../components/SelectField'
import StatusChip from '../../components/StatusChip'
import { api } from '../../lib/api'
import { LAB_STATUS_LABELS } from '../../lib/labels'

const FIELD_CLASS =
  'mt-2 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30'

const SUBMIT_CLASS =
  'inline-flex h-11 items-center justify-center rounded-lg bg-brand-700 px-6 text-sm font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-60'

const EMPTY_FORM = { patientName: '', patientEmail: '', testId: '', priority: 'routine', notes: '' }

export default function DoctorLabPage() {
  const { labOrders: orders, labTests: tests, state, refresh } = useOutletContext()
  const [form, setForm] = useState(EMPTY_FORM)
  const [drafts, setDrafts] = useState({})
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function handleRequest(event) {
    event.preventDefault()
    setError('')
    setNotice('')
    setBusyId('request')

    try {
      await api.doctor.requestLabOrder(form)
      setForm(EMPTY_FORM)
      setNotice('Request sent to the laboratory.')
      await refresh()
    } catch (err) {
      setError(err.message || 'That request could not be sent.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleUpdate(id, patch, note) {
    setBusyId(id)
    setError('')
    setNotice('')

    try {
      await api.doctor.updateLabOrder(id, patch)
      if (note) setNotice(note)
      await refresh()
    } catch (err) {
      setError(err.message || 'That change could not be saved.')
    } finally {
      setBusyId(null)
    }
  }

  const awaitingReview = orders.filter((order) => order.status === 'completed').length

  return (
    <>
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-brand-700">Clinical</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink">Laboratory</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-mist">
          Request tests for your patients, read the results the laboratory files, then add your
          interpretation and send the report to the patient.
        </p>
      </header>

      {error ? <p className="mt-6 text-sm font-medium text-danger">{error}</p> : null}
      {notice ? <p className="mt-6 text-sm font-medium text-brand-700">{notice}</p> : null}

      <form
        onSubmit={handleRequest}
        className="mt-6 grid gap-5 rounded-2xl border border-line bg-white p-6 shadow-soft sm:grid-cols-2"
      >
        <div>
          <label htmlFor="patientName" className="text-sm font-semibold text-ink">
            Patient name
          </label>
          <input
            id="patientName"
            required
            minLength={2}
            value={form.patientName}
            onChange={(event) => setForm((c) => ({ ...c, patientName: event.target.value }))}
            className={FIELD_CLASS}
          />
        </div>
        <div>
          <label htmlFor="patientEmail" className="text-sm font-semibold text-ink">
            Patient account email
          </label>
          <input
            id="patientEmail"
            type="email"
            value={form.patientEmail}
            onChange={(event) => setForm((c) => ({ ...c, patientEmail: event.target.value }))}
            className={FIELD_CLASS}
          />
          <p className="mt-1.5 text-xs text-mist">
            Links the report to the patient — they see it as soon as you send it.
          </p>
        </div>
        <SelectField
          id="testId"
          label="Test"
          required
          value={form.testId}
          onChange={(event) => setForm((c) => ({ ...c, testId: event.target.value }))}
          options={[
            { value: '', label: 'Choose a test…' },
            ...tests.map((test) => ({ value: test.id ?? test._id, label: test.name })),
          ]}
        />
        <SelectField
          id="priority"
          label="Priority"
          value={form.priority}
          onChange={(event) => setForm((c) => ({ ...c, priority: event.target.value }))}
          options={[
            { value: 'routine', label: 'Routine' },
            { value: 'urgent', label: 'Urgent' },
          ]}
        />
        <div className="sm:col-span-2">
          <label htmlFor="notes" className="text-sm font-semibold text-ink">
            Clinical note for the laboratory
          </label>
          <input
            id="notes"
            value={form.notes}
            onChange={(event) => setForm((c) => ({ ...c, notes: event.target.value }))}
            className={FIELD_CLASS}
          />
        </div>
        <div className="sm:col-span-2">
          <button type="submit" disabled={busyId === 'request'} className={SUBMIT_CLASS}>
            {busyId === 'request' ? 'Sending…' : 'Request this test'}
          </button>
        </div>
      </form>

      <section className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-ink">Requested &amp; reported</h2>
          {awaitingReview ? (
            <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-800">
              {awaitingReview} report{awaitingReview === 1 ? '' : 's'} waiting for you
            </span>
          ) : null}
        </div>

        {state === 'loading' ? <p className="mt-5 text-sm text-mist">Loading requests…</p> : null}
        {state === 'error' ? (
          <p className="mt-5 text-sm text-danger">Couldn't load the laboratory requests.</p>
        ) : null}

        {state === 'ready' && orders.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-line bg-surface px-6 py-10 text-center">
            <FlaskConical size={22} className="mx-auto text-brand-700" />
            <p className="mt-3 text-sm font-semibold text-ink">No test requests yet</p>
            <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-mist">
              Request a test above and the laboratory will file the results back to you.
            </p>
          </div>
        ) : null}

        {orders.length ? (
          <ul className="mt-5 space-y-4">
            {orders.map((order) => {
              const id = order.id ?? order._id
              const draft = drafts[id] ?? { interpretation: order.interpretation ?? '' }
              const canSend = order.status === 'completed'

              return (
                <li key={id} className="rounded-2xl border border-line bg-white p-6 shadow-soft">
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">
                        {order.testName}
                      </span>
                      <span className="block truncate text-xs text-mist">
                        {order.patientName} · report {order.reportNumber}
                        {order.orderedBy ? ` · requested by ${order.orderedBy}` : ''}
                      </span>
                    </span>

                    {order.priority === 'urgent' ? (
                      <StatusChip status="rejected" label="Urgent" />
                    ) : null}
                    <StatusChip
                      status={order.status}
                      label={LAB_STATUS_LABELS[order.status] ?? order.status}
                    />
                  </div>

                  <LabResultsTable results={order.results} />

                  {order.resultSummary ? (
                    <p className="mt-4 rounded-xl bg-surface px-4 py-3 text-sm leading-relaxed text-body">
                      Laboratory summary: {order.resultSummary}
                    </p>
                  ) : null}

                  <div className="mt-4">
                    <label
                      htmlFor={`interpretation-${id}`}
                      className="text-xs font-semibold text-ink"
                    >
                      Your interpretation
                    </label>
                    <textarea
                      id={`interpretation-${id}`}
                      rows={2}
                      maxLength={600}
                      value={draft.interpretation}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [id]: { ...draft, interpretation: event.target.value },
                        }))
                      }
                      className="mt-1 w-full rounded-lg border border-line bg-white p-3 text-sm text-ink outline-none transition-colors focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30"
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdate(id, { interpretation: draft.interpretation }, 'Interpretation saved.')
                      }
                      disabled={busyId === id}
                      className="inline-flex h-10 items-center justify-center rounded-lg border border-line px-5 text-sm font-semibold text-body transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-60"
                    >
                      Save interpretation
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleUpdate(
                          id,
                          { interpretation: draft.interpretation, send: true },
                          'Report sent to the patient.',
                        )
                      }
                      disabled={!canSend || busyId === id}
                      title={
                        canSend
                          ? 'Release this report to the patient'
                          : 'The laboratory has not completed this report yet'
                      }
                      className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-700 px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-50"
                    >
                      {busyId === id ? 'Working…' : 'Send to patient'}
                    </button>
                  </div>

                  {order.status === 'sent' ? (
                    <p className="mt-3 text-xs font-medium text-brand-700">
                      Sent {order.sentAt ? new Date(order.sentAt).toLocaleString('en-US') : ''}
                      {order.sentBy ? ` by ${order.sentBy}` : ''}.
                    </p>
                  ) : null}
                </li>
              )
            })}
          </ul>
        ) : null}
      </section>
    </>
  )
}
