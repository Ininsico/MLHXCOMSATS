export const SEVERITY_META = {
  low: {
    label: 'Low',
    badge: 'bg-brand-50 text-brand-800',
    bar: 'bg-brand-600',
    blurb: 'Nothing urgent stands out in this scan.',
  },
  moderate: {
    label: 'Moderate',
    badge: 'bg-brand-950 text-white',
    bar: 'bg-brand-700',
    blurb: 'Something worth a closer look before the patient leaves.',
  },
  high: {
    label: 'High',
    badge: 'bg-danger-bg text-danger',
    bar: 'bg-danger',
    blurb: 'Review this urgently and consider escalating care.',
  },
}

export const AI_DISCLAIMER =
  'For assistive use only — not a diagnostic tool. All outputs must be reviewed by a licensed clinician.'

export const MAX_SCAN_BYTES = 12 * 1024 * 1024

export function severityMeta(severity) {
  return SEVERITY_META[severity] ?? SEVERITY_META.low
}

export function confidencePercent(value) {
  const number = Number(value)

  if (!Number.isFinite(number)) return 0

  return Math.max(0, Math.min(100, Math.round(number * 100)))
}

export function isDicomFile(file) {
  if (!file) return false

  return (
    file.name.toLowerCase().endsWith('.dcm') ||
    file.name.toLowerCase().endsWith('.dicom') ||
    file.type === 'application/dicom'
  )
}

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('That file could not be read.'))
    reader.readAsDataURL(file)
  })
}
