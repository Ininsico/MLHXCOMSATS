import { motion } from 'framer-motion'
import { EASE } from '../../../lib/motion'

export default function BarChart({ data, ariaLabel }) {
  const maxValue = Math.max(1, ...data.map((item) => item.value))

  return (
    <ul className="space-y-5" role="img" aria-label={ariaLabel}>
      {data.map((item, index) => (
        <li key={item.label}>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium text-body">{item.label}</span>
            <span className="text-sm font-semibold text-ink">{item.value}</span>
          </div>

          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-surface">
            <motion.div
              className={`h-full origin-left rounded-full ${item.barClassName}`}
              style={{ width: `${Math.max(2, (item.value / maxValue) * 100)}%` }}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.9, ease: EASE, delay: 0.15 + index * 0.1 }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}
