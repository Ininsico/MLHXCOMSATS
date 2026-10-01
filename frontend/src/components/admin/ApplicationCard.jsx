import { Loader2 } from 'lucide-react'

export default function ApplicationCard({ hospital, busy, onDecide }) {
  const owner = hospital.owner ?? {}
  const id = hospital.id ?? hospital._id

  return (
    <article className="rounded-2xl border border-line bg-white p-6 shadow-soft">
      <div className="flex items-start gap-4">
        {hospital.logoUrl ? (
          <img
            src={hospital.logoUrl}
            alt=""
            className="h-12 w-12 shrink-0 rounded-xl border border-line object-cover"
          />
        ) : (
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-brand-200 bg-brand-50 text-lg font-extrabold text-brand-700">
            {hospital.name?.charAt(0) ?? 'A'}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-ink">{hospital.name}</h3>
          <p className="mt-1 text-sm text-mist">
            {hospital.area} · {hospital.city}
          </p>
          <p className="mt-1 text-xs text-mist">
            {owner.name ? `${owner.name} · ` : ''}
            {owner.email ?? 'No contact on file'}
          </p>
        </div>

        <span className="shrink-0 text-xs text-mist">
          {hospital.createdAt
            ? new Date(hospital.createdAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })
            : null}
        </span>
      </div>

      {hospital.specialties?.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {hospital.specialties.map((specialty) => (
            <span
              key={specialty}
              className="rounded-full border border-line px-3 py-1 text-xs font-medium text-body"
            >
              {specialty}
            </span>
          ))}
        </div>
      ) : null}

      {hospital.description ? (
        <p className="mt-4 text-sm leading-relaxed text-body">{hospital.description}</p>
      ) : null}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => onDecide(id, 'approved')}
          disabled={busy}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand-700 px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-60"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : null}
          Approve
        </button>
        <button
          type="button"
          onClick={() => onDecide(id, 'suspended')}
          disabled={busy}
          className="inline-flex h-10 items-center justify-center rounded-lg border border-line px-5 text-sm font-semibold text-body transition-colors hover:border-danger hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-60"
        >
          Reject
        </button>
      </div>
    </article>
  )
}
