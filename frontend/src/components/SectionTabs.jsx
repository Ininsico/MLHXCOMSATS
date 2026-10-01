import { useRef } from 'react'

/**
 * Section switcher for panel content — a real tablist: arrow keys move between tabs,
 * Home/End jump to the ends, and each tab is announced as selected.
 */
export default function SectionTabs({ tabs = [], active, onChange, label = 'Sections' }) {
  const refs = useRef({})

  function move(direction) {
    const index = tabs.findIndex((tab) => tab.id === active)
    const next = tabs[(index + direction + tabs.length) % tabs.length]

    if (!next) return

    onChange(next.id)
    refs.current[next.id]?.focus()
  }

  function onKeyDown(event) {
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      move(1)
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      move(-1)
    } else if (event.key === 'Home') {
      event.preventDefault()
      onChange(tabs[0]?.id)
      refs.current[tabs[0]?.id]?.focus()
    } else if (event.key === 'End') {
      event.preventDefault()
      const last = tabs[tabs.length - 1]
      onChange(last?.id)
      refs.current[last?.id]?.focus()
    }
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="flex flex-wrap gap-1 rounded-full border border-line bg-surface p-1"
    >
      {tabs.map((tab) => {
        const selected = tab.id === active

        return (
          <button
            key={tab.id}
            ref={(element) => {
              refs.current[tab.id] = element
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 ${
              selected ? 'bg-white text-ink shadow-soft' : 'text-mist hover:text-ink'
            }`}
          >
            {tab.label}
            {tab.badge ? (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  tab.tone === 'danger' ? 'bg-danger/10 text-danger' : 'bg-brand-50 text-brand-700'
                }`}
              >
                {tab.badge}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
