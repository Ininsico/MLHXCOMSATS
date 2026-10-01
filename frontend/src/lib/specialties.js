export const SPECIALTIES = [
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

export const MARKETPLACE_CATEGORIES = [
  'Imaging',
  'Surgical',
  'Laboratory',
  'Monitoring',
  'Furniture',
  'Vehicles',
  'IT & Software',
  'Consumables',
  'Other',
]

export const MARKETPLACE_CONDITIONS = [
  { value: 'new', label: 'New' },
  { value: 'refurbished', label: 'Refurbished' },
  { value: 'used', label: 'Used' },
]

export const LISTING_STATUS_LABELS = {
  available: 'Available',
  reserved: 'Reserved',
  sold: 'Sold',
}

export function conditionLabel(value) {
  return MARKETPLACE_CONDITIONS.find((item) => item.value === value)?.label ?? value
}
