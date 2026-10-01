/**
 * Hand-rolled SVG line chart — same rule as the other charts: no chart library,
 * design tokens only. Used for trends (vitals, lab parameters, revenue).
 */
const PADDING = { top: 16, right: 16, bottom: 28, left: 40 }

export default function LineChart({
  data = [],
  label = 'Trend',
  suffix = '',
  height = 220,
  stroke = 'var(--color-brand-600)',
  fill = 'var(--color-brand-50)',
}) {
  if (!data.length) {
    return (
      <p className="rounded-xl bg-surface px-4 py-8 text-center text-sm text-mist">
        Nothing recorded yet — points appear as data comes in.
      </p>
    )
  }

  const width = 640
  const values = data.map((point) => Number(point.value) || 0)
  const max = Math.max(...values)
  const min = Math.min(...values)
  const span = max - min || 1

  const plotWidth = width - PADDING.left - PADDING.right
  const plotHeight = height - PADDING.top - PADDING.bottom

  const points = data.map((point, index) => {
    const x = PADDING.left + (data.length === 1 ? plotWidth / 2 : (index / (data.length - 1)) * plotWidth)
    const y = PADDING.top + plotHeight - ((Number(point.value) - min) / span) * plotHeight

    return { x, y, ...point }
  })

  const line = points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ')
  const area = `${PADDING.left},${PADDING.top + plotHeight} ${line} ${
    PADDING.left + plotWidth
  },${PADDING.top + plotHeight}`

  const gridLines = [0, 0.5, 1].map((fraction) => ({
    y: PADDING.top + plotHeight - fraction * plotHeight,
    value: min + fraction * span,
  }))

  return (
    <figure>
      <figcaption className="sr-only">{label}</figcaption>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label={`${label}: ${data.length} points, from ${min}${suffix} to ${max}${suffix}`}
      >
        {gridLines.map((line_) => (
          <g key={line_.y}>
            <line
              x1={PADDING.left}
              x2={width - PADDING.right}
              y1={line_.y}
              y2={line_.y}
              stroke="var(--color-line)"
              strokeWidth="1"
            />
            <text
              x={PADDING.left - 8}
              y={line_.y + 4}
              textAnchor="end"
              className="fill-mist text-[10px]"
            >
              {Math.round(line_.value)}
              {suffix}
            </text>
          </g>
        ))}

        <polygon points={area} fill={fill} opacity="0.6" />
        <polyline points={line} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" />

        {points.map((point) => (
          <circle key={point.label} cx={point.x} cy={point.y} r="3" fill={stroke} />
        ))}

        {points
          .filter((_, index) => index % Math.ceil(points.length / 6) === 0)
          .map((point) => (
            <text
              key={`label-${point.label}`}
              x={point.x}
              y={height - 8}
              textAnchor="middle"
              className="fill-mist text-[10px]"
            >
              {point.label}
            </text>
          ))}
      </svg>
    </figure>
  )
}
