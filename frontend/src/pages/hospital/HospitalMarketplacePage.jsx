import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import ImageUploadField from '../../components/ImageUploadField'
import SelectField from '../../components/SelectField'
import StatusChip from '../../components/StatusChip'
import { api } from '../../lib/api'
import {
  LISTING_STATUS_LABELS,
  MARKETPLACE_CATEGORIES,
  MARKETPLACE_CONDITIONS,
  conditionLabel,
} from '../../lib/specialties'

const FIELD_CLASS =
  'mt-2 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30'

const SUBMIT_CLASS =
  'inline-flex h-11 items-center justify-center rounded-lg bg-brand-700 px-6 text-sm font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-60'

const EMPTY_LISTING = {
  title: '',
  description: '',
  category: 'Imaging',
  condition: 'used',
  price: '',
  images: [],
}

export default function HospitalMarketplacePage() {
  const [tab, setTab] = useState('browse')
  const [listings, setListings] = useState([])
  const [mine, setMine] = useState({ selling: [], bought: [] })
  const [state, setState] = useState('loading')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [condition, setCondition] = useState('all')
  const [form, setForm] = useState(EMPTY_LISTING)
  const [showForm, setShowForm] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')

  async function load(filters = { q: query, category, condition }) {
    const params = new URLSearchParams()
    if (filters.q?.trim()) params.set('q', filters.q.trim())
    if (filters.category && filters.category !== 'all') params.set('category', filters.category)
    if (filters.condition && filters.condition !== 'all') params.set('condition', filters.condition)

    const [browse, own] = await Promise.all([
      api.marketplace.list(params.toString()),
      api.marketplace.mine(),
    ])

    setListings(browse ?? [])
    setMine(own ?? { selling: [], bought: [] })
    setState('ready')
  }

  useEffect(() => {
    let cancelled = false

    Promise.all([api.marketplace.list(), api.marketplace.mine()])
      .then(([browse, own]) => {
        if (cancelled) return
        setListings(browse ?? [])
        setMine(own ?? { selling: [], bought: [] })
        setState('ready')
      })
      .catch(() => {
        if (!cancelled) setState('error')
      })

    return () => {
      cancelled = true
    }
  }, [])

  async function refresh() {
    try {
      await load()
    } catch {
      setState('error')
    }
  }

  async function handleCreate(event) {
    event.preventDefault()
    setError('')
    setBusyId('new')

    try {
      await api.marketplace.create({ ...form, price: Number(form.price || 0) })
      setForm(EMPTY_LISTING)
      setShowForm(false)
      await refresh()
    } catch (err) {
      setError(err.message || 'That listing could not be saved.')
    } finally {
      setBusyId(null)
    }
  }

  async function act(id, action) {
    setBusyId(id)
    setError('')

    try {
      await action()
      await refresh()
    } catch (err) {
      setError(err.message || 'That action could not be completed.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-700">Operations</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink">Marketplace</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-mist">
            Buy and sell hospital equipment with other Aurora hospitals — imaging, surgical,
            monitoring, furniture and vehicles, all in one place.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setShowForm((current) => !current)
            setTab('selling')
          }}
          className="inline-flex items-center gap-2 rounded-full border border-line px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-body transition duration-300 hover:border-brand-300 hover:bg-brand-50 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
        >
          <Plus size={14} />
          {showForm ? 'Close' : 'Sell equipment'}
        </button>
      </header>

      {error ? <p className="mt-6 text-sm font-medium text-danger">{error}</p> : null}

      <div className="mt-6 inline-flex rounded-full border border-line bg-surface p-1">
        {[
          { id: 'browse', label: 'Browse' },
          { id: 'selling', label: `My listings (${mine.selling.length})` },
          { id: 'bought', label: `Purchases (${mine.bought.length})` },
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

      {showForm && tab === 'selling' ? (
        <form
          onSubmit={handleCreate}
          className="mt-6 space-y-5 rounded-2xl border border-line bg-white p-6 shadow-soft"
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="title" className="text-sm font-semibold text-ink">
                What are you selling?
              </label>
              <input
                id="title"
                required
                minLength={4}
                value={form.title}
                onChange={(event) => setForm((c) => ({ ...c, title: event.target.value }))}
                placeholder="GE Logiq P5 ultrasound machine"
                className={FIELD_CLASS}
              />
            </div>

            <SelectField
              id="category"
              label="Category"
              value={form.category}
              onChange={(event) => setForm((c) => ({ ...c, category: event.target.value }))}
              options={MARKETPLACE_CATEGORIES}
            />
            <SelectField
              id="condition"
              label="Condition"
              value={form.condition}
              onChange={(event) => setForm((c) => ({ ...c, condition: event.target.value }))}
              options={MARKETPLACE_CONDITIONS}
            />

            <div>
              <label htmlFor="price" className="text-sm font-semibold text-ink">
                Price (Rs)
              </label>
              <input
                id="price"
                type="number"
                min="0"
                required
                value={form.price}
                onChange={(event) => setForm((c) => ({ ...c, price: event.target.value }))}
                className={FIELD_CLASS}
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="description" className="text-sm font-semibold text-ink">
                Description
              </label>
              <textarea
                id="description"
                rows={4}
                required
                minLength={20}
                maxLength={800}
                value={form.description}
                onChange={(event) => setForm((c) => ({ ...c, description: event.target.value }))}
                className={FIELD_CLASS}
              />
              <p className="mt-1.5 text-xs text-mist">
                20-800 characters — mention age, condition and what is included.
              </p>
            </div>
          </div>

          <ImageUploadField
            id="cover"
            label="Photo"
            hint="One clear photo helps the listing sell — PNG, JPG, or WebP up to 4 MB."
            value={form.images[0] ?? ''}
            onChange={(url) =>
              setForm((c) => ({ ...c, images: url ? [url, ...c.images.slice(1, 3)] : [] }))
            }
          />

          <button type="submit" disabled={busyId === 'new'} className={SUBMIT_CLASS}>
            {busyId === 'new' ? 'Publishing…' : 'Publish listing'}
          </button>
        </form>
      ) : null}

      {tab === 'browse' ? (
        <>
          <div className="mt-6 grid gap-5 rounded-2xl border border-line bg-white p-6 shadow-soft sm:grid-cols-3">
            <div>
              <label htmlFor="q" className="text-sm font-semibold text-ink">
                Search
              </label>
              <input
                id="q"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onBlur={() => load({ q: query, category, condition })}
                placeholder="Ultrasound, monitor, ambulance…"
                className={FIELD_CLASS}
              />
            </div>
            <SelectField
              id="filterCategory"
              label="Category"
              value={category}
              onChange={(event) => {
                setCategory(event.target.value)
                load({ q: query, category: event.target.value, condition })
              }}
              options={[{ value: 'all', label: 'All categories' }, ...MARKETPLACE_CATEGORIES]}
            />
            <SelectField
              id="filterCondition"
              label="Condition"
              value={condition}
              onChange={(event) => {
                setCondition(event.target.value)
                load({ q: query, category, condition: event.target.value })
              }}
              options={[{ value: 'all', label: 'Any condition' }, ...MARKETPLACE_CONDITIONS]}
            />
          </div>

          {state === 'loading' ? <p className="mt-6 text-sm text-mist">Loading listings…</p> : null}
          {state === 'error' ? (
            <p className="mt-6 text-sm text-danger">Couldn't load the marketplace right now.</p>
          ) : null}

          {state === 'ready' && listings.length === 0 ? (
            <p className="mt-6 rounded-2xl border border-line bg-surface px-6 py-8 text-sm text-mist">
              Nothing listed right now — publish the first item.
            </p>
          ) : null}

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            {listings.map((listing) => {
              const id = listing.id ?? listing._id
              const isMine = mine.selling.some((item) => (item.id ?? item._id) === id)

              return (
                <article
                  key={id}
                  className="overflow-hidden rounded-2xl border border-line bg-white shadow-soft"
                >
                  {listing.images?.[0] ? (
                    <img
                      src={listing.images[0]}
                      alt=""
                      className="h-44 w-full object-cover"
                    />
                  ) : null}

                  <div className="p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <h2 className="text-base font-semibold text-ink">{listing.title}</h2>
                      <StatusChip
                        status={listing.status}
                        label={LISTING_STATUS_LABELS[listing.status] ?? listing.status}
                      />
                    </div>

                    <p className="mt-1 text-xs text-mist">
                      {listing.category} · {conditionLabel(listing.condition)} ·{' '}
                      {listing.seller?.name ?? 'Hospital'}
                      {listing.seller?.city ? ` · ${listing.seller.city}` : ''}
                    </p>

                    <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-body">
                      {listing.description}
                    </p>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                      <span className="text-lg font-extrabold text-ink">
                        Rs {Number(listing.price ?? 0).toLocaleString('en-US')}
                      </span>

                      {isMine ? (
                        <span className="text-xs font-semibold text-mist">Your listing</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => act(id, () => api.marketplace.reserve(id))}
                          disabled={busyId === id || listing.status !== 'available'}
                          className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-700 px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-50"
                        >
                          {listing.status === 'available' ? 'Reserve' : 'Unavailable'}
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </>
      ) : null}

      {tab === 'selling' ? (
        <section className="mt-6">
          {mine.selling.length ? (
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white shadow-soft">
              {mine.selling.map((listing) => {
                const id = listing.id ?? listing._id

                return (
                  <li key={id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                    {listing.images?.[0] ? (
                      <img
                        src={listing.images[0]}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded-xl border border-line object-cover"
                      />
                    ) : null}

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">
                        {listing.title}
                      </span>
                      <span className="block truncate text-xs text-mist">
                        {listing.category} · Rs {Number(listing.price ?? 0).toLocaleString('en-US')}
                        {listing.buyer?.name ? ` · reserved by ${listing.buyer.name}` : ''}
                      </span>
                    </span>

                    <StatusChip
                      status={listing.status}
                      label={LISTING_STATUS_LABELS[listing.status] ?? listing.status}
                    />

                    <span className="flex items-center gap-3">
                      {listing.status !== 'sold' ? (
                        <button
                          type="button"
                          onClick={() => act(id, () => api.marketplace.update(id, { status: 'sold' }))}
                          disabled={busyId === id}
                          className="text-xs font-semibold text-brand-700 transition-colors hover:text-brand-800 disabled:opacity-60"
                        >
                          Mark sold
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            act(id, () => api.marketplace.update(id, { status: 'available' }))
                          }
                          disabled={busyId === id}
                          className="text-xs font-semibold text-brand-700 transition-colors hover:text-brand-800 disabled:opacity-60"
                        >
                          Relist
                        </button>
                      )}

                      {listing.status === 'reserved' ? (
                        <button
                          type="button"
                          onClick={() => act(id, () => api.marketplace.release(id))}
                          disabled={busyId === id}
                          className="text-xs font-semibold text-mist transition-colors hover:text-ink disabled:opacity-60"
                        >
                          Release
                        </button>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => act(id, () => api.marketplace.remove(id))}
                        disabled={busyId === id}
                        aria-label={`Delete ${listing.title}`}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line text-mist transition-colors hover:border-danger hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-60"
                      >
                        <Trash2 size={14} />
                      </button>
                    </span>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="rounded-2xl border border-line bg-surface px-6 py-8 text-sm text-mist">
              You have not listed anything yet — use &ldquo;Sell equipment&rdquo; above.
            </p>
          )}
        </section>
      ) : null}

      {tab === 'bought' ? (
        <section className="mt-6">
          {mine.bought.length ? (
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white shadow-soft">
              {mine.bought.map((listing) => {
                const id = listing.id ?? listing._id

                return (
                  <li key={id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">
                        {listing.title}
                      </span>
                      <span className="block truncate text-xs text-mist">
                        From {listing.seller?.name ?? 'hospital'}
                        {listing.seller?.city ? ` · ${listing.seller.city}` : ''} · Rs{' '}
                        {Number(listing.price ?? 0).toLocaleString('en-US')}
                      </span>
                    </span>

                    <StatusChip
                      status={listing.status}
                      label={LISTING_STATUS_LABELS[listing.status] ?? listing.status}
                    />

                    {listing.status === 'reserved' ? (
                      <button
                        type="button"
                        onClick={() => act(id, () => api.marketplace.release(id))}
                        disabled={busyId === id}
                        className="text-xs font-semibold text-mist transition-colors hover:text-danger disabled:opacity-60"
                      >
                        Cancel reservation
                      </button>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="rounded-2xl border border-line bg-surface px-6 py-8 text-sm text-mist">
              Nothing reserved yet — browse the marketplace and reserve what your hospital needs.
            </p>
          )}
        </section>
      ) : null}
    </>
  )
}
