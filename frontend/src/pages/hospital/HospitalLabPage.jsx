import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import LabResultsTable from '../../components/LabResultsTable'
import SelectField from '../../components/SelectField'
import StatusChip from '../../components/StatusChip'
import { api } from '../../lib/api'
import { formatRange } from '../../lib/lab'
import { LAB_STATUS_LABELS } from '../../lib/labels'

const FIELD_CLASS =
  'mt-2 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30'

const SUBMIT_CLASS =
  'inline-flex h-11 items-center justify-center rounded-lg bg-brand-700 px-6 text-sm font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-60'

const NEXT_STATUS = {
  requested: { label: 'Mark sample collected', status: 'collected' },
  collected: { label: 'Start processing', status: 'processing' },
  processing: { label: 'Complete & file report', status: 'completed' },
}

const EMPTY_TEST = {
  name: '',
  category: 'General',
  sampleType: 'Blood',
  price: '',
  turnaroundHours: 24,
  parameters: [],
}

const EMPTY_ORDER = { testId: '', patientName: '', patientEmail: '', priority: 'routine', notes: '' }
const BLANK_PARAMETER = { name: '', unit: '', referenceLow: '', referenceHigh: '' }

export default function HospitalLabPage() {
  const { labOrders, labTests, state, reload } = useOutletContext()
  const [tab, setTab] = useState('orders')
  const [testForm, setTestForm] = useState(EMPTY_TEST)
  const [orderForm, setOrderForm] = useState(EMPTY_ORDER)
  const [drafts, setDrafts] = useState({})
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')

  function draftFor(order) {
    const id = order.id ?? order._id

    if (drafts[id]) return drafts[id]

    return {
      results: Object.fromEntries(
        (order.results ?? []).map((row) => [row.parameter, row.value ?? '']),
      ),
      summary: order.resultSummary ?? '',
    }
  }

  function updateDraft(id, patch) {
    setDrafts((current) => ({ ...current, [id]: { ...(current[id] ?? {}), ...patch } }))
  }

  async function handleCreateTest(event) {
    event.preventDefault()
    setError('')
    setBusyId('test')

    try {
      await api.lab.createTest({
        ...testForm,
        price: Number(testForm.price || 0),
        parameters: testForm.parameters.filter((row) => row.name.trim().length >= 2),
      })
      setTestForm(EMPTY_TEST)
      await reload()
    } catch (err) {
      setError(err.message || 'That test could not be saved.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleCreateOrder(event) {
    event.preventDefault()
    setError('')
    setBusyId('order')

    try {
      await api.lab.createOrder(orderForm)
      setOrderForm(EMPTY_ORDER)
      await reload()
    } catch (err) {
      setError(err.message || 'That order could not be created.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleOrder(event, id, patch) {
    if (event) event.preventDefault()
    setBusyId(id)
    setError('')

    try {
      await api.lab.updateOrder(id, patch)
      await reload()
    } catch (err) {
      setError(err.message || 'That order could not be updated.')
    } finally {
      setBusyId(null)
    }
  }

  function saveResults(event, order) {
    const id = order.id ?? order._id
    const draft = draftFor(order)

    const results = (order.parameters?.length
      ? order.parameters.map((parameter) => ({
          parameter: parameter.name,
          value: draft.results?.[parameter.name] ?? '',
          unit: parameter.unit,
          referenceLow: parameter.referenceLow,
          referenceHigh: parameter.referenceHigh,
        }))
      : []
    ).filter((row) => row.value !== '')

    return handleOrder(event, id, { results, resultSummary: draft.summary ?? '' })
  }

  if (state === 'loading') {
    return <p className="text-sm text-mist">Loading the laboratory module…</p>
  }

  return (
    <>
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-brand-700">Clinical</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink">Laboratory</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-mist">
          Keep the test catalogue with its reference ranges, record results against each
          parameter, and file the report — the requesting doctor reviews it and releases it to
          the patient.
        </p>
      </header>

      {error ? <p className="mt-6 text-sm font-medium text-danger">{error}</p> : null}

      <div className="mt-6 inline-flex rounded-full border border-line bg-surface p-1">
        {[
          { id: 'orders', label: 'Orders & results' },
          { id: 'tests', label: 'Test catalogue' },
        ].map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setTab(option.id)}
            aria-pressed={tab === option.id}
            className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 ${
              tab === option.id ? 'bg-white text-ink shadow-soft' : 'text-mist hover:text-ink'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {tab === 'orders' ? (
        <>
          <form
            onSubmit={handleCreateOrder}
            className="mt-6 grid gap-5 rounded-2xl border border-line bg-white p-6 shadow-soft sm:grid-cols-2"
          >
            <SelectField
              id="testId"
              label="Test"
              required
              value={orderForm.testId}
              onChange={(event) => setOrderForm((c) => ({ ...c, testId: event.target.value }))}
              options={[
                { value: '', label: 'Choose a test…' },
                ...labTests.map((test) => ({ value: test.id ?? test._id, label: test.name })),
              ]}
            />
            <div>
              <label htmlFor="patientName" className="text-sm font-semibold text-ink">
                Patient name
              </label>
              <input
                id="patientName"
                required
                minLength={2}
                value={orderForm.patientName}
                onChange={(event) =>
                  setOrderForm((c) => ({ ...c, patientName: event.target.value }))
                }
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
                value={orderForm.patientEmail}
                onChange={(event) =>
                  setOrderForm((c) => ({ ...c, patientEmail: event.target.value }))
                }
                className={FIELD_CLASS}
              />
              <p className="mt-1.5 text-xs text-mist">
                Optional — links the report to the patient&apos;s Aurora account.
              </p>
            </div>
            <SelectField
              id="priority"
              label="Priority"
              value={orderForm.priority}
              onChange={(event) => setOrderForm((c) => ({ ...c, priority: event.target.value }))}
              options={[
                { value: 'routine', label: 'Routine' },
                { value: 'urgent', label: 'Urgent' },
              ]}
            />
            <div className="sm:col-span-2">
              <label htmlFor="notes" className="text-sm font-semibold text-ink">
                Notes for the laboratory
              </label>
              <input
                id="notes"
                value={orderForm.notes}
                onChange={(event) => setOrderForm((c) => ({ ...c, notes: event.target.value }))}
                className={FIELD_CLASS}
              />
            </div>
            <div className="sm:col-span-2">
              <button type="submit" disabled={busyId === 'order'} className={SUBMIT_CLASS}>
                {busyId === 'order' ? 'Raising order…' : 'Raise lab order'}
              </button>
            </div>
          </form>

          {labOrders.length ? (
            <ul className="mt-6 space-y-4">
              {labOrders.map((order) => {
                const id = order.id ?? order._id
                const next = NEXT_STATUS[order.status]
                const draft = draftFor(order)
                const locked = ['sent', 'cancelled'].includes(order.status)

                return (
                  <li key={id} className="rounded-2xl border border-line bg-white p-6 shadow-soft">
                    <div className="flex flex-wrap items-center gap-4">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-ink">
                          {order.testName}
                        </span>
                        <span className="block truncate text-xs text-mist">
                          {order.patientName}
                          {order.patientUser ? ' · linked account' : ''} · report{' '}
                          {order.reportNumber}
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

                      <span className="flex items-center gap-3">
                        {next && !locked ? (
                          <button
                            type="button"
                            onClick={() => handleOrder(null, id, { status: next.status })}
                            disabled={busyId === id}
                            className="text-xs font-semibold text-brand-700 transition-colors hover:text-brand-800 disabled:opacity-60"
                          >
                            {next.label}
                          </button>
                        ) : null}
                        {!locked ? (
                          <button
                            type="button"
                            onClick={() => handleOrder(null, id, { status: 'cancelled' })}
                            disabled={busyId === id}
                            className="text-xs font-semibold text-mist transition-colors hover:text-danger disabled:opacity-60"
                          >
                            Cancel
                          </button>
                        ) : null}
                      </span>
                    </div>

                    {order.notes ? (
                      <p className="mt-3 rounded-xl bg-surface px-4 py-3 text-xs text-body">
                        {order.notes}
                      </p>
                    ) : null}

                    {order.parameters?.length ? (
                      <form onSubmit={(event) => saveResults(event, order)} className="mt-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                          {order.parameters.map((parameter) => (
                            <div key={parameter.name}>
                              <label
                                htmlFor={`${id}-${parameter.name}`}
                                className="text-xs font-semibold text-ink"
                              >
                                {parameter.name}
                                <span className="ml-2 font-normal text-mist">
                                  {formatRange(parameter)}
                                </span>
                              </label>
                              <input
                                id={`${id}-${parameter.name}`}
                                value={draft.results?.[parameter.name] ?? ''}
                                disabled={locked}
                                onChange={(event) =>
                                  updateDraft(id, {
                                    results: {
                                      ...(draft.results ?? {}),
                                      [parameter.name]: event.target.value,
                                    },
                                  })
                                }
                                placeholder="Result"
                                className="mt-1 h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none transition-colors focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30 disabled:bg-surface disabled:text-mist"
                              />
                            </div>
                          ))}
                        </div>

                        <div className="mt-4">
                          <label htmlFor={`${id}-summary`} className="text-xs font-semibold text-ink">
                            Laboratory summary (optional)
                          </label>
                          <input
                            id={`${id}-summary`}
                            value={draft.summary ?? ''}
                            disabled={locked}
                            onChange={(event) => updateDraft(id, { summary: event.target.value })}
                            placeholder="One line the doctor reads first"
                            className="mt-1 h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none transition-colors focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30 disabled:bg-surface disabled:text-mist"
                          />
                        </div>

                        {!locked ? (
                          <button
                            type="submit"
                            disabled={busyId === id}
                            className="mt-4 inline-flex h-10 items-center justify-center rounded-lg border border-line px-5 text-sm font-semibold text-body transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-60"
                          >
                            Save results
                          </button>
                        ) : null}
                      </form>
                    ) : (
                      <form
                        onSubmit={(event) =>
                          handleOrder(event, id, { resultSummary: draft.summary ?? '' })
                        }
                        className="mt-4 flex flex-col gap-3 sm:flex-row"
                      >
                        <input
                          aria-label={`Result summary for ${order.testName}`}
                          value={draft.summary ?? ''}
                          disabled={locked}
                          onChange={(event) => updateDraft(id, { summary: event.target.value })}
                          placeholder="Result summary for the doctor and patient"
                          className="h-11 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none transition-colors focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30 disabled:bg-surface disabled:text-mist"
                        />
                        {!locked ? (
                          <button
                            type="submit"
                            disabled={busyId === id}
                            className="inline-flex h-11 shrink-0 items-center justify-center rounded-lg border border-line px-5 text-sm font-semibold text-body transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-60"
                          >
                            Save result
                          </button>
                        ) : null}
                      </form>
                    )}

                    {order.results?.length ? <LabResultsTable results={order.results} /> : null}

                    {order.interpretation ? (
                      <p className="mt-4 rounded-xl bg-surface px-4 py-3 text-sm leading-relaxed text-body">
                        Doctor&apos;s interpretation: {order.interpretation}
                      </p>
                    ) : null}

                    {order.status === 'sent' ? (
                      <p className="mt-3 text-xs font-medium text-brand-700">
                        Released to the patient{order.sentBy ? ` by ${order.sentBy}` : ''}.
                      </p>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="mt-6 rounded-2xl border border-line bg-surface px-6 py-8 text-sm text-mist">
              No lab orders yet — raise one above and the requesting doctor sees the report once
              you file it.
            </p>
          )}
        </>
      ) : (
        <>
          <form
            onSubmit={handleCreateTest}
            className="mt-6 space-y-5 rounded-2xl border border-line bg-white p-6 shadow-soft"
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="name" className="text-sm font-semibold text-ink">
                  Test name
                </label>
                <input
                  id="name"
                  required
                  minLength={2}
                  value={testForm.name}
                  onChange={(event) => setTestForm((c) => ({ ...c, name: event.target.value }))}
                  placeholder="Complete Blood Count"
                  className={FIELD_CLASS}
                />
              </div>
              <div>
                <label htmlFor="category" className="text-sm font-semibold text-ink">
                  Category
                </label>
                <input
                  id="category"
                  value={testForm.category}
                  onChange={(event) => setTestForm((c) => ({ ...c, category: event.target.value }))}
                  className={FIELD_CLASS}
                />
              </div>
              <div>
                <label htmlFor="sampleType" className="text-sm font-semibold text-ink">
                  Sample
                </label>
                <input
                  id="sampleType"
                  value={testForm.sampleType}
                  onChange={(event) =>
                    setTestForm((c) => ({ ...c, sampleType: event.target.value }))
                  }
                  className={FIELD_CLASS}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="price" className="text-sm font-semibold text-ink">
                    Price (Rs)
                  </label>
                  <input
                    id="price"
                    type="number"
                    min="0"
                    value={testForm.price}
                    onChange={(event) => setTestForm((c) => ({ ...c, price: event.target.value }))}
                    className={FIELD_CLASS}
                  />
                </div>
                <div>
                  <label htmlFor="turnaroundHours" className="text-sm font-semibold text-ink">
                    Hours
                  </label>
                  <input
                    id="turnaroundHours"
                    type="number"
                    min="1"
                    value={testForm.turnaroundHours}
                    onChange={(event) =>
                      setTestForm((c) => ({ ...c, turnaroundHours: event.target.value }))
                    }
                    className={FIELD_CLASS}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-line p-4">
              <p className="text-sm font-semibold text-ink">Result parameters</p>
              <p className="mt-1 text-xs text-mist">
                Add every value the report shows, with its unit and reference range — flags are
                worked out automatically.
              </p>

              <div className="mt-4 space-y-3">
                {testForm.parameters.map((row, index) => (
                  <div key={index} className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_1fr_auto]">
                    <input
                      aria-label={`Parameter ${index + 1} name`}
                      value={row.name}
                      onChange={(event) =>
                        setTestForm((c) => ({
                          ...c,
                          parameters: c.parameters.map((entry, position) =>
                            position === index ? { ...entry, name: event.target.value } : entry,
                          ),
                        }))
                      }
                      placeholder="Hemoglobin"
                      className="h-10 rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none transition-colors focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30"
                    />
                    <input
                      aria-label={`Parameter ${index + 1} unit`}
                      value={row.unit}
                      onChange={(event) =>
                        setTestForm((c) => ({
                          ...c,
                          parameters: c.parameters.map((entry, position) =>
                            position === index ? { ...entry, unit: event.target.value } : entry,
                          ),
                        }))
                      }
                      placeholder="g/dL"
                      className="h-10 rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none transition-colors focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30"
                    />
                    <input
                      aria-label={`Parameter ${index + 1} low`}
                      value={row.referenceLow}
                      onChange={(event) =>
                        setTestForm((c) => ({
                          ...c,
                          parameters: c.parameters.map((entry, position) =>
                            position === index
                              ? { ...entry, referenceLow: event.target.value }
                              : entry,
                          ),
                        }))
                      }
                      placeholder="Low"
                      className="h-10 rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none transition-colors focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30"
                    />
                    <input
                      aria-label={`Parameter ${index + 1} high`}
                      value={row.referenceHigh}
                      onChange={(event) =>
                        setTestForm((c) => ({
                          ...c,
                          parameters: c.parameters.map((entry, position) =>
                            position === index
                              ? { ...entry, referenceHigh: event.target.value }
                              : entry,
                          ),
                        }))
                      }
                      placeholder="High"
                      className="h-10 rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none transition-colors focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setTestForm((c) => ({
                          ...c,
                          parameters: c.parameters.filter((entry, position) => position !== index),
                        }))
                      }
                      aria-label={`Remove parameter ${index + 1}`}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-line text-mist transition-colors hover:border-danger hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() =>
                  setTestForm((c) => ({ ...c, parameters: [...c.parameters, { ...BLANK_PARAMETER }] }))
                }
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand-700 transition-colors hover:text-brand-800"
              >
                <Plus size={14} />
                Add parameter
              </button>
            </div>

            <button type="submit" disabled={busyId === 'test'} className={SUBMIT_CLASS}>
              {busyId === 'test' ? 'Saving…' : 'Add test to catalogue'}
            </button>
          </form>

          {labTests.length ? (
            <ul className="mt-6 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white shadow-soft">
              {labTests.map((test) => (
                <li key={test.id ?? test._id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">
                        {test.name}
                      </span>
                      <span className="block truncate text-xs text-mist">
                        {test.category} · {test.sampleType} · ready in {test.turnaroundHours}h ·{' '}
                        {test.parameters?.length ?? 0} parameter
                        {(test.parameters?.length ?? 0) === 1 ? '' : 's'}
                      </span>
                    </span>
                    <span className="text-sm font-semibold text-ink">
                      Rs {Number(test.price ?? 0).toLocaleString('en-US')}
                    </span>
                    <StatusChip status={test.active ? 'active' : 'inactive'} />
                  </div>

                  {test.parameters?.length ? (
                    <p className="mt-2 text-xs text-mist">
                      {test.parameters
                        .map((parameter) => `${parameter.name} (${formatRange(parameter)})`)
                        .join(' · ')}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-6 rounded-2xl border border-line bg-surface px-6 py-8 text-sm text-mist">
              Your catalogue is empty — add the tests your lab runs so orders can be raised
              against them.
            </p>
          )}
        </>
      )}
    </>
  )
}
