import { severityMeta } from '../lib/ai'

export default function SeverityBadge({ severity, className = '' }) {
  const meta = severityMeta(severity)

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-widest ${meta.badge} ${className}`}
    >
      {meta.label} severity
    </span>
  )
}
