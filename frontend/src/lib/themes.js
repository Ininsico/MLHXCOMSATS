export const THEME_STYLES = {
  classic: {
    page: 'bg-white',
    hero: 'rounded-2xl border border-line bg-white p-6 sm:p-8',
    title: 'text-ink',
    muted: 'text-mist',
    body: 'text-body',
    chip: 'border border-line text-body',
    card: 'rounded-2xl border border-line bg-white shadow-soft',
    primary: 'bg-brand-700 text-white hover:bg-brand-800',
    secondary:
      'border border-line text-body hover:border-brand-300 hover:bg-brand-50 hover:text-ink',
    badge: 'bg-brand-50 text-brand-800',
    divider: 'border-line',
  },
  emerald: {
    page: 'bg-white',
    hero: 'rounded-2xl bg-brand-950 p-6 sm:p-8',
    title: 'text-white',
    muted: 'text-white/60',
    body: 'text-white/80',
    chip: 'border border-white/20 text-white/80',
    card: 'rounded-2xl border border-line bg-white shadow-soft',
    primary: 'bg-brand-700 text-white hover:bg-brand-800',
    secondary: 'border border-white/20 text-white hover:bg-white/10',
    badge: 'bg-brand-400/15 text-brand-300',
    divider: 'border-white/10',
  },
  sunrise: {
    page: 'bg-brand-50/40',
    hero: 'rounded-2xl border border-brand-200 bg-brand-50 p-6 sm:p-8',
    title: 'text-ink',
    muted: 'text-mist',
    body: 'text-body',
    chip: 'border border-brand-200 bg-white text-body',
    card: 'rounded-2xl border border-brand-200 bg-white shadow-soft',
    primary: 'bg-brand-700 text-white hover:bg-brand-800',
    secondary: 'border border-brand-200 bg-white text-body hover:bg-brand-100',
    badge: 'bg-brand-100 text-brand-800',
    divider: 'border-brand-200',
  },
  midnight: {
    page: 'bg-brand-950',
    hero: 'rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8',
    title: 'text-white',
    muted: 'text-white/50',
    body: 'text-white/75',
    chip: 'border border-white/20 text-white/80',
    card: 'rounded-2xl bg-white shadow-soft',
    primary: 'bg-white text-ink hover:bg-brand-50',
    secondary: 'border border-white/20 text-white hover:bg-white/10',
    badge: 'bg-brand-400/15 text-brand-300',
    divider: 'border-white/10',
  },
}

export function themeStyles(themeId) {
  return THEME_STYLES[themeId] ?? THEME_STYLES.classic
}

export const SLOT_TIMES = (() => {
  const times = []

  for (let hour = 9; hour <= 17; hour += 1) {
    times.push(`${String(hour).padStart(2, '0')}:00`)
    if (hour !== 17) times.push(`${String(hour).padStart(2, '0')}:30`)
  }

  return times
})()

export function todayISO() {
  const now = new Date()
  const pad = (value) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function formatSlotDate(date) {
  if (!date) return ''
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}
