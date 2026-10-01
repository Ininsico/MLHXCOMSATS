import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import SelectField from '../../components/SelectField'
import { api } from '../../lib/api'

const FIELD_CLASS =
  'mt-2 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30'

const SUBMIT_CLASS =
  'inline-flex h-11 items-center justify-center rounded-lg bg-brand-700 px-6 text-sm font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-60'

const EMPTY_ITEM = {
  name: '',
  sku: '',
  category: 'General',
  unit: 'unit',
  quantity: 0,
  reorderLevel: 0,
  location: '',
}

export default function HospitalInventoryPage() {
  const { inventory, state, reload } = useOutletContext()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_ITEM)
  const [openId, setOpenId] = useState(null)
  const [movement, setMovement] = useState({ type: 'in', quantity: 1, reason: '' })
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')

  const lowStock = inventory.filter((item) => item.quantity <= item.reorderLevel)

  async function handleCreate(event) {
    event.preventDefault()
    setError('')
    setBusyId('new')

    try {
      await api.inventory.create({
        ...form,
        quantity: Number(form.quantity),
        reorderLevel: Number(form.reorderLevel),
      })
      setForm(EMPTY_ITEM)
      setShowForm(false)
      await reload()
    } catch (err) {
      setError(err.message || 'That item could not be saved.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleMovement(event, id) {
    event.preventDefault()
    setBusyId(id)
    setError('')

    try {
      await api.inventory.addMovement(id, {
        ...movement,
        quantity: Number(movement.quantity),
      })
      setMovement({ type: 'in', quantity: 1, reason: '' })
      setOpenId(null)
      await reload()
    } catch (err) {
      setError(err.message || 'That stock movement could not be recorded.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleRemove(id) {
    setBusyId(id)
    setError('')

    try {
      await api.inventory.remove(id)
      await reload()
    } catch (err) {
      setError(err.message || 'That item could not be removed.')
    } finally {
      setBusyId(null)
    }
  }

  if (state === 'loading') {
    return <p className="text-sm text-mist">Loading inventory…</p>
  }

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-700">Operations</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink">Inventory</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-mist">
            Track stock, record every movement, and see what has fallen to its reorder level
            before a ward runs out.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowForm((current) => !current)}
          className="inline-flex items-center gap-2 rounded-full border border-line px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-body transition duration-300 hover:border-brand-300 hover:bg-brand-50 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
        >
          <Plus size={14} />
          {showForm ? 'Close' : 'Add item'}
        </button>
      </header>

      {error ? <p className="mt-6 text-sm font-medium text-danger">{error}</p> : null}

      {lowStock.length ? (
        <p className="mt-6 rounded-2xl border border-danger/40 bg-danger-bg px-5 py-4 text-sm font-medium text-danger">
          {lowStock.length} item{lowStock.length === 1 ? '' : 's'} at or below the reorder level.
        </p>
      ) : null}

      {showForm ? (
        <form
          onSubmit={handleCreate}
          className="mt-6 grid gap-5 rounded-2xl border border-line bg-white p-6 shadow-soft sm:grid-cols-2"
        >
          <div>
            <label htmlFor="name" className="text-sm font-semibold text-ink">
              Item name
            </label>
            <input
              id="name"
              required
              minLength={2}
              value={form.name}
              onChange={(event) => setForm((c) => ({ ...c, name: event.target.value }))}
              placeholder="Surgical gloves (M)"
              className={FIELD_CLASS}
            />
          </div>
          <div>
            <label htmlFor="sku" className="text-sm font-semibold text-ink">
              SKU
            </label>
            <input
              id="sku"
              value={form.sku}
              onChange={(event) => setForm((c) => ({ ...c, sku: event.target.value }))}
              className={FIELD_CLASS}
            />
          </div>
          <div>
            <label htmlFor="category" className="text-sm font-semibold text-ink">
              Category
            </label>
            <input
              id="category"
              value={form.category}
              onChange={(event) => setForm((c) => ({ ...c, category: event.target.value }))}
              className={FIELD_CLASS}
            />
          </div>
          <div>
            <label htmlFor="unit" className="text-sm font-semibold text-ink">
              Unit
            </label>
            <input
              id="unit"
              value={form.unit}
              onChange={(event) => setForm((c) => ({ ...c, unit: event.target.value }))}
              className={FIELD_CLASS}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="quantity" className="text-sm font-semibold text-ink">
                Quantity
              </label>
              <input
                id="quantity"
                type="number"
                min="0"
                value={form.quantity}
                onChange={(event) => setForm((c) => ({ ...c, quantity: event.target.value }))}
                className={FIELD_CLASS}
              />
            </div>
            <div>
              <label htmlFor="reorderLevel" className="text-sm font-semibold text-ink">
                Reorder at
              </label>
              <input
                id="reorderLevel"
                type="number"
                min="0"
                value={form.reorderLevel}
                onChange={(event) => setForm((c) => ({ ...c, reorderLevel: event.target.value }))}
                className={FIELD_CLASS}
              />
            </div>
          </div>
          <div>
            <label htmlFor="location" className="text-sm font-semibold text-ink">
              Location
            </label>
            <input
              id="location"
              value={form.location}
              onChange={(event) => setForm((c) => ({ ...c, location: event.target.value }))}
              placeholder="Store room A"
              className={FIELD_CLASS}
            />
          </div>
          <div className="sm:col-span-2">
            <button type="submit" disabled={busyId === 'new'} className={SUBMIT_CLASS}>
              {busyId === 'new' ? 'Saving…' : 'Add to inventory'}
            </button>
          </div>
        </form>
      ) : null}

      {inventory.length ? (
        <ul className="mt-6 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white shadow-soft">
          {inventory.map((item) => {
            const id = item.id ?? item._id
            const low = item.quantity <= item.reorderLevel
            const open = openId === id

            return (
              <li key={id} className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">
                      {item.name}
                      {item.sku ? <span className="ml-2 text-xs text-mist">{item.sku}</span> : null}
                    </span>
                    <span className="block truncate text-xs text-mist">
                      {item.category}
                      {item.location ? ` · ${item.location}` : ''} · reorder at{' '}
                      {item.reorderLevel}
                    </span>
                  </span>

                  <span
                    className={`text-sm font-bold ${low ? 'text-danger' : 'text-ink'}`}
                  >
                    {item.quantity} {item.unit}
                    {low ? ' · low' : ''}
                  </span>

                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : id)}
                    className="text-xs font-semibold text-brand-700 transition-colors hover:text-brand-800"
                  >
                    {open ? 'Close' : 'Record movement'}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRemove(id)}
                    disabled={busyId === id}
                    aria-label={`Remove ${item.name}`}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line text-mist transition-colors hover:border-danger hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-60"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {open ? (
                  <div className="mt-4 rounded-xl bg-surface p-4">
                    <form
                      onSubmit={(event) => handleMovement(event, id)}
                      className="flex flex-col gap-3 sm:flex-row sm:items-end"
                    >
                      <SelectField
                        id={`type-${id}`}
                        label="Movement"
                        value={movement.type}
                        onChange={(event) =>
                          setMovement((c) => ({ ...c, type: event.target.value }))
                        }
                        options={[
                          { value: 'in', label: 'Stock in' },
                          { value: 'out', label: 'Stock out' },
                          { value: 'adjust', label: 'Set exact count' },
                        ]}
                      />

                      <div className="w-32">
                        <label
                          htmlFor={`quantity-${id}`}
                          className="text-xs font-semibold uppercase tracking-wide text-mist"
                        >
                          Quantity
                        </label>
                        <input
                          id={`quantity-${id}`}
                          type="number"
                          min="0"
                          value={movement.quantity}
                          onChange={(event) =>
                            setMovement((c) => ({ ...c, quantity: event.target.value }))
                          }
                          className="mt-1 h-11 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30"
                        />
                      </div>

                      <div className="flex-1">
                        <label
                          htmlFor={`reason-${id}`}
                          className="text-xs font-semibold uppercase tracking-wide text-mist"
                        >
                          Reason
                        </label>
                        <input
                          id={`reason-${id}`}
                          value={movement.reason}
                          onChange={(event) =>
                            setMovement((c) => ({ ...c, reason: event.target.value }))
                          }
                          placeholder="Ward 3 restock"
                          className="mt-1 h-11 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30"
                        />
                      </div>

                      <button type="submit" disabled={busyId === id} className={SUBMIT_CLASS}>
                        {busyId === id ? 'Saving…' : 'Save'}
                      </button>
                    </form>

                    {item.movements?.length ? (
                      <ul className="mt-4 space-y-1.5">
                        {[...item.movements].reverse().slice(0, 4).map((entry) => (
                          <li key={`${entry.at}-${entry.type}`} className="text-xs text-mist">
                            {entry.type} · {entry.quantity}
                            {entry.reason ? ` · ${entry.reason}` : ''}
                            {entry.by ? ` · ${entry.by}` : ''}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="mt-6 rounded-2xl border border-line bg-surface px-6 py-8 text-sm text-mist">
          No stock items yet — add what you keep on the shelves to start tracking it.
        </p>
      )}
    </>
  )
}
