import { ChevronDown } from 'lucide-react'

const SIZES = {
  md: 'h-11',
  sm: 'h-10',
}

export default function SelectField({
  id,
  label,
  hint,
  error,
  options = [],
  size = 'md',
  className = '',
  ...selectProps
}) {
  return (
    <div className={className}>
      {label ? (
        <label htmlFor={id} className="text-sm font-semibold text-ink">
          {label}
        </label>
      ) : null}

      <div className={`relative ${label ? 'mt-2' : ''}`}>
        <select
          id={id}
          {...selectProps}
          className={`w-full appearance-none rounded-lg border bg-white pr-10 pl-3 text-sm text-ink outline-none transition-colors duration-200 placeholder:text-mist focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30 disabled:bg-surface disabled:text-mist ${
            error ? 'border-danger' : 'border-line hover:border-brand-200'
          } ${SIZES[size] ?? SIZES.md}`}
        >
          {options.map((option) => {
            const value = typeof option === 'string' ? option : option.value
            const text = typeof option === 'string' ? option : option.label

            return (
              <option key={value} value={value}>
                {text}
              </option>
            )
          })}
        </select>

        <ChevronDown
          size={16}
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-mist"
        />
      </div>

      {hint ? <p className="mt-1.5 text-xs text-mist">{hint}</p> : null}
      {error ? <p className="mt-1.5 text-xs font-medium text-danger">{error}</p> : null}
    </div>
  )
}
