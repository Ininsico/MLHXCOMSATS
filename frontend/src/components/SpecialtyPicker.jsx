import { SPECIALTIES } from '../lib/specialties'

export default function SpecialtyPicker({ id, label, value = [], onChange, hint }) {
  function toggle(item) {
    onChange(value.includes(item) ? value.filter((entry) => entry !== item) : [...value, item])
  }

  return (
    <div>
      <span className="text-sm font-semibold text-ink" id={id}>
        {label}
      </span>

      <div className="mt-2 flex flex-wrap gap-2">
        {SPECIALTIES.map((item) => {
          const active = value.includes(item)

          return (
            <button
              key={item}
              type="button"
              onClick={() => toggle(item)}
              aria-pressed={active}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 ${
                active
                  ? 'border-brand-300 bg-brand-50 text-brand-800'
                  : 'border-line text-body hover:border-brand-300 hover:bg-brand-50 hover:text-ink'
              }`}
            >
              {item}
            </button>
          )
        })}
      </div>

      <p className="mt-2 text-xs text-mist">
        {value.length} selected{hint ? ` — ${hint}` : ''}
      </p>
    </div>
  )
}
