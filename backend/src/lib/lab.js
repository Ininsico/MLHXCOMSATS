function flagForValue(value, referenceLow, referenceHigh) {
  const numeric = Number(value)

  if (value === '' || value === null || value === undefined || !Number.isFinite(numeric)) {
    return 'unknown'
  }
  if (typeof referenceLow === 'number' && numeric < referenceLow) return 'low'
  if (typeof referenceHigh === 'number' && numeric > referenceHigh) return 'high'

  return 'normal'
}

function formatRange(low, high, unit) {
  const parts = []

  if (typeof low === 'number') parts.push(String(low))
  if (typeof high === 'number') parts.push(String(high))

  if (!parts.length) return '—'

  const range = parts.length === 2 ? `${parts[0]} – ${parts[1]}` : parts[0]
  return unit ? `${range} ${unit}` : range
}

module.exports = { flagForValue, formatRange }
