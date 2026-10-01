const STYLES = {
  approved: 'bg-brand-50 text-brand-800',
  active: 'bg-brand-50 text-brand-800',
  verified: 'bg-brand-50 text-brand-800',
  confirmed: 'bg-brand-50 text-brand-800',
  completed: 'bg-brand-50 text-brand-800',
  arrived: 'bg-brand-50 text-brand-800',
  pending: 'bg-surface text-body',
  requested: 'bg-surface text-body',
  collected: 'bg-surface text-body',
  processing: 'bg-surface text-body',
  unverified: 'bg-surface text-body',
  leave: 'bg-surface text-body',
  inactive: 'bg-surface text-body',
  cancelled: 'bg-danger-bg text-danger',
  suspended: 'bg-danger-bg text-danger',
  rejected: 'bg-danger-bg text-danger',
}

export default function StatusChip({ status, label }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
        STYLES[status] ?? STYLES.pending
      }`}
    >
      {label ?? status}
    </span>
  )
}
