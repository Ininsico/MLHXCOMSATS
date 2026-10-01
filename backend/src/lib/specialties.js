const SPECIALTIES = [
  'Cardiology',
  'Dermatology',
  'Pediatrics',
  'Orthopedics',
  'Neurology',
  'Gynecology',
  'Gastroenterology',
  'Pulmonology',
  'Endocrinology',
  'Nephrology',
  'Ophthalmology',
  'ENT',
  'Dentistry',
  'Psychiatry',
  'Oncology',
  'Urology',
  'Rheumatology',
  'General Medicine',
  'General Surgery',
  'Emergency',
  'Radiology',
  'Anesthesiology',
  'Physiotherapy',
  'Nutrition & Dietetics',
]

function isSpecialty(value) {
  return SPECIALTIES.includes(value)
}

function normalizeSpecialties(list) {
  if (!Array.isArray(list)) return null

  const cleaned = [...new Set(list.map((item) => (typeof item === 'string' ? item.trim() : '')))].filter(
    (item) => isSpecialty(item),
  )

  return cleaned.length === list.length && cleaned.length > 0 ? cleaned : null
}

module.exports = { SPECIALTIES, isSpecialty, normalizeSpecialties }
