import { motion } from 'framer-motion'
import { EASE } from '../../../lib/motion'

const SIZE = 176
const RADIUS = 62
const STROKE = 18
const CENTER = SIZE / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export default function DonutChart({ data, centerValue, centerLabel, ariaLabel }) {
  const total = data.reduce((sum, item) => sum + item.value, 0)
  const segments = []
  let offset = 0

  for (const item of data) {
    if (item.value <= 0) continue

    const length = (item.value / total) * CIRCUMFERENCE
    segments.push({ ...item, length, offset })
    offset += length
  }

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-center">
      <motion.div
        className="relative shrink-0"
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: EASE }}
      >
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="h-44 w-44"
          role="img"
          aria-label={ariaLabel}
        >
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
            className="text-surface"
            stroke="currentColor"
          />

          <g transform={`rotate(-90 ${CENTER} ${CENTER})`}>
            {segments.map((segment, index) => (
              <motion.circle
                key={segment.label}
                cx={CENTER}
                cy={CENTER}
                r={RADIUS}
                fill="none"
                strokeWidth={STROKE}
                className={segment.className}
                stroke="currentColor"
                strokeDasharray={`${segment.length} ${CIRCUMFERENCE - segment.length}`}
                strokeDashoffset={-segment.offset}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, ease: EASE, delay: 0.15 + index * 0.12 }}
              />
            ))}
          </g>
        </svg>

        <div className="absolute inset-0 grid place-items-center">
          <div className="text-center">
            <p className="text-2xl font-extrabold text-ink">{centerValue ?? total}</p>
            {centerLabel ? (
              <p className="text-xs font-semibold uppercase tracking-wide text-mist">
                {centerLabel}
              </p>
            ) : null}
          </div>
        </div>
      </motion.div>

      <ul className="w-full max-w-[220px] space-y-3">
        {data.map((item) => (
          <li key={item.label} className="flex items-center gap-2 text-sm">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${item.dotClassName}`} />
            <span className="flex-1 text-body">{item.label}</span>
            <span className="font-semibold text-ink">{item.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
