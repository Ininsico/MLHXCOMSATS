export const FLAG_STYLES = {
  low: 'text-danger',
  high: 'text-danger',
  normal: 'text-brand-700',
  unknown: 'text-mist',
}

export const FLAG_LABELS = {
  low: 'Low',
  high: 'High',
  normal: 'Normal',
  unknown: '—',
}

export function formatRange(parameter) {
  const parts = []

  if (typeof parameter?.referenceLow === 'number') parts.push(String(parameter.referenceLow))
  if (typeof parameter?.referenceHigh === 'number') parts.push(String(parameter.referenceHigh))

  if (!parts.length) return 'No range'

  const range = parts.length === 2 ? `${parts[0]} – ${parts[1]}` : parts[0]
  return parameter.unit ? `${range} ${parameter.unit}` : range
}
