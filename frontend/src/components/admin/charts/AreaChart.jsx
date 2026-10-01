import { useId, useState } from 'react'
import { motion } from 'framer-motion'
import { EASE } from '../../../lib/motion'

const WIDTH = 720
const HEIGHT = 260
const PAD_X = 36
const PAD_TOP = 18
const PAD_BOTTOM = 32

function formatDay(iso) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

function smoothPath(points) {
  if (!points.length) return ''

  let path = `M ${points[0][0]},${points[0][1]}`

  for (let index = 1; index < points.length; index += 1) {
    const [previousX, previousY] = points[index - 1]
    const [x, y] = points[index]
    const midX = (previousX + x) / 2

    path += ` C ${midX},${previousY} ${midX},${y} ${x},${y}`
  }

  return path
}

export default function AreaChart({ data, series, ariaLabel }) {
  const uid = useId().replace(/[:]/g, '')
  const [hoverIndex, setHoverIndex] = useState(null)

  const maxValue = Math.max(
    1,
    ...data.flatMap((point) => series.map((item) => point[item.key] ?? 0)),
  )
  const stepX = data.length > 1 ? (WIDTH - PAD_X * 2) / (data.length - 1) : 0
  const xAt = (index) => PAD_X + index * stepX
  const yAt = (value) => PAD_TOP + (1 - value / maxValue) * (HEIGHT - PAD_TOP - PAD_BOTTOM)
  const baseY = HEIGHT - PAD_BOTTOM
  const gridValues = [maxValue, Math.round(maxValue / 2), 0]
  const labelEvery = Math.max(1, Math.ceil(data.length / 6))

  function handleMove(event) {
    const rect = event.currentTarget.getBoundingClientRect()
    const viewX = ((event.clientX - rect.left) / rect.width) * WIDTH
    const raw = stepX ? Math.round((viewX - PAD_X) / stepX) : 0

    setHoverIndex(Math.min(data.length - 1, Math.max(0, raw)))
  }

  const hovered = hoverIndex == null ? null : data[hoverIndex]
  const totals = series.map((item) => ({
    ...item,
    total: data.reduce((sum, point) => sum + (point[item.key] ?? 0), 0),
  }))

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        role="img"
        aria-label={ariaLabel}
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIndex(null)}
      >
        {gridValues.map((value, index) => (
          <g key={value}>
            <line
              x1={PAD_X}
              x2={WIDTH - PAD_X}
              y1={yAt(value)}
              y2={yAt(value)}
              className="text-line"
              stroke="currentColor"
              strokeWidth="1"
              strokeDasharray={index === gridValues.length - 1 ? undefined : '4 6'}
            />
            <text
              x={PAD_X - 8}
              y={yAt(value) + 4}
              textAnchor="end"
              className="fill-mist text-[11px]"
            >
              {value}
            </text>
          </g>
        ))}

        {data.map((point, index) =>
          index % labelEvery === 0 || index === data.length - 1 ? (
            <text
              key={point.date}
              x={xAt(index)}
              y={HEIGHT - 8}
              textAnchor="middle"
              className="fill-mist text-[11px]"
            >
              {formatDay(point.date)}
            </text>
          ) : null,
        )}

        {series.map((item, seriesIndex) => {
          const points = data.map((point, index) => [xAt(index), yAt(point[item.key] ?? 0)])
          const line = smoothPath(points)
          const area = `${line} L ${xAt(data.length - 1)},${baseY} L ${xAt(0)},${baseY} Z`
          const gradientId = `${uid}-${item.key}`

          return (
            <g key={item.key} className={item.className}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="currentColor" stopOpacity="0.26" />
                  <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                </linearGradient>
              </defs>

              <motion.path
                d={area}
                fill={`url(#${gradientId})`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.9, ease: EASE, delay: 0.35 + seriesIndex * 0.15 }}
              />

              <motion.path
                d={line}
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.2, ease: EASE, delay: 0.15 + seriesIndex * 0.15 }}
              />
            </g>
          )
        })}

        {hovered ? (
          <g>
            <line
              x1={xAt(hoverIndex)}
              x2={xAt(hoverIndex)}
              y1={PAD_TOP}
              y2={baseY}
              className="text-brand-300"
              stroke="currentColor"
              strokeWidth="1"
            />
            {series.map((item) => (
              <circle
                key={item.key}
                cx={xAt(hoverIndex)}
                cy={yAt(hovered[item.key] ?? 0)}
                r="4"
                className={`${item.className} stroke-white`}
                fill="currentColor"
                strokeWidth="2"
              />
            ))}
          </g>
        ) : null}
      </svg>

      {hovered ? (
        <div
          className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-lg border border-line bg-white px-3 py-2 shadow-soft"
          style={{ left: `${(xAt(hoverIndex) / WIDTH) * 100}%` }}
        >
          <p className="text-xs font-semibold text-ink">{formatDay(hovered.date)}</p>
          {series.map((item) => (
            <p key={item.key} className="mt-1 flex items-center gap-2 text-xs text-body">
              <span className={`h-2 w-2 rounded-full ${item.dotClassName}`} />
              {item.name}
              <span className="font-semibold text-ink">{hovered[item.key] ?? 0}</span>
            </p>
          ))}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
        {totals.map((item) => (
          <span key={item.key} className="flex items-center gap-2 text-xs text-body">
            <span className={`h-2 w-2 rounded-full ${item.dotClassName}`} />
            {item.name}
            <span className="font-semibold text-ink">{item.total}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
