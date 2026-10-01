import { Check, Loader2 } from 'lucide-react'

/**
 * Payment progress: every stage of a payment, what has happened, and when. Reads the
 * same step list the API returns, so the UI can never tell a different story than the
 * records do.
 */
export default function PaymentProgress({ steps = [], live = false, title = 'Payment progress', note = '' }) {
  if (!steps.length) return null

  const completed = steps.filter((step) => step.done).length
  const percent = Math.round((completed / steps.length) * 100)

  return (
    <section className="rounded-2xl border border-line bg-white p-6 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-mist">
          {live ? (
            <>
              <Loader2 size={12} className="animate-spin text-brand-700" />
              checking every 8s
            </>
          ) : (
            `${completed}/${steps.length} complete`
          )}
        </span>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <div
          className="h-full rounded-full bg-brand-600 transition-[width] duration-500"
          style={{ width: `${Math.max(4, percent)}%` }}
        />
      </div>

      <ol className="mt-5 space-y-3">
        {steps.map((step, index) => (
          <li key={step.key ?? step.label} className="flex items-start gap-3">
            <span
              className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                step.done ? 'bg-brand-600 text-white' : 'border border-line bg-surface text-mist'
              }`}
            >
              {step.done ? <Check size={13} /> : index + 1}
            </span>

            <div className="min-w-0">
              <p className={`text-sm ${step.done ? 'font-semibold text-ink' : 'text-mist'}`}>{step.label}</p>
              {step.at ? (
                <p className="mt-0.5 text-xs text-mist">{new Date(step.at).toLocaleString()}</p>
              ) : null}
              {step.note ? <p className="mt-0.5 text-xs text-body">{step.note}</p> : null}
            </div>
          </li>
        ))}
      </ol>

      {note ? <p className="mt-4 rounded-xl bg-surface px-4 py-3 text-xs leading-relaxed text-body">{note}</p> : null}
    </section>
  )
}
