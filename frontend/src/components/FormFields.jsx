import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

const INPUT_CLASS =
  'h-11 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none transition-colors duration-200 placeholder:text-mist hover:border-brand-200 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30 disabled:bg-surface disabled:text-mist'

export function TextField({ id, label, hint, ...inputProps }) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
      </label>
      <input id={id} {...inputProps} className={`mt-2 ${INPUT_CLASS}`} />
      {hint ? <p className="mt-1.5 text-xs text-mist">{hint}</p> : null}
    </div>
  )
}

export function PasswordField({ id, label, hint, ...inputProps }) {
  const [visible, setVisible] = useState(false)

  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
      </label>
      <div className="relative mt-2">
        <input
          id={id}
          {...inputProps}
          type={visible ? 'text' : 'password'}
          className={`${INPUT_CLASS} pr-11`}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-mist transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-inset"
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {hint ? <p className="mt-1.5 text-xs text-mist">{hint}</p> : null}
    </div>
  )
}
