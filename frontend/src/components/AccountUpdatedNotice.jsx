import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { Check } from 'lucide-react'

const EASE = [0.22, 1, 0.36, 1]

/**
 * Confirmation shown when something about the account actually changed — a plan
 * switched, a theme applied. Motion respects the user's reduced-motion setting
 * through the app-wide MotionConfig.
 */
export default function AccountUpdatedNotice({ title, detail = '', onDone = null, duration = 6500 }) {
  useEffect(() => {
    if (!onDone) return undefined

    const timer = setTimeout(onDone, duration)

    return () => clearTimeout(timer)
  }, [onDone, duration])

  return (
    <motion.div
      role="status"
      aria-live="polite"
      initial={{ opacity: 0, y: -12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.45, ease: EASE }}
      className="mt-6 flex flex-wrap items-center gap-4 overflow-hidden rounded-2xl border border-brand-300 bg-brand-50 px-6 py-5"
    >
      <motion.span
        initial={{ scale: 0.4, rotate: -18 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 18, delay: 0.1 }}
        className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-600 text-white"
      >
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.28, type: 'spring', stiffness: 420, damping: 16 }}
        >
          <Check size={24} strokeWidth={3} />
        </motion.span>
      </motion.span>

      <div className="min-w-0 flex-1">
        <motion.p
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.24, duration: 0.4, ease: EASE }}
          className="text-base font-semibold text-ink"
        >
          {title}
        </motion.p>

        {detail ? (
          <motion.p
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.34, duration: 0.4, ease: EASE }}
            className="mt-1 text-sm leading-relaxed text-body"
          >
            {detail}
          </motion.p>
        ) : null}
      </div>

      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-xs font-semibold uppercase tracking-widest text-brand-700"
      >
        account updated
      </motion.span>
    </motion.div>
  )
}
