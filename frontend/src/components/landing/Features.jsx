import { useRef } from 'react'
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion'
import { CalendarCheck, FileText, Pill, Receipt, Search, Star } from 'lucide-react'
import { SCROLL_SPRING } from '../../lib/motion'
import { Reveal, RevealGroup, RevealItem } from './Reveal'

const FEATURES = [
  {
    icon: CalendarCheck,
    title: 'Appointments',
    copy: 'Patients book visits in a few taps and your day stays on one calm calendar.',
  },
  {
    icon: FileText,
    title: 'Patient records',
    copy: 'History, notes, and vitals organised per patient — no stacks of files.',
  },
  {
    icon: Pill,
    title: 'Prescriptions',
    copy: 'Issue and review medication orders without the paper chase.',
  },
  {
    icon: Receipt,
    title: 'Billing',
    copy: 'Clear invoices and payment status, with nothing lost in spreadsheets.',
  },
  {
    icon: Search,
    title: 'Hospital directory',
    copy: 'Search verified hospitals by specialty, area, and city.',
  },
  {
    icon: Star,
    title: 'Reviews',
    copy: 'Ratings and reviews from real visits, before patients book.',
  },
]

export default function Features() {
  const ref = useRef(null)
  const reduceMotion = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const progress = useSpring(scrollYProgress, SCROLL_SPRING)
  const glowY = useTransform(progress, [0, 1], [60, -60])

  return (
    <section
      id="features"
      ref={ref}
      className="relative scroll-mt-20 overflow-hidden bg-white py-16 md:py-24"
    >
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/4 -left-40 h-[520px] w-[520px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgb(220 252 231 / 0.55), transparent 65%)',
          y: reduceMotion ? 0 : glowY,
        }}
      />

      <div className="relative mx-auto max-w-6xl px-6">
        <Reveal className="max-w-2xl">
          <p className="text-xs font-bold tracking-widest text-brand-700 uppercase">Features</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-[-0.02em] text-ink md:text-4xl">
            Everything your clinic runs on, in one place
          </h2>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-body">
            From the first appointment request to the final invoice, Aurora keeps every step in
            view.
          </p>
        </Reveal>

        <RevealGroup className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, copy }) => (
            <RevealItem key={title}>
              <article className="group h-full rounded-2xl border border-line bg-white p-6 shadow-soft transition duration-300 hover:-translate-y-1 hover:border-brand-200 hover:shadow-lift">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-brand-700 transition-colors duration-300 group-hover:bg-brand-100">
                  <Icon size={20} strokeWidth={2} />
                </span>
                <h3 className="mt-5 text-lg font-semibold text-ink">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-body">{copy}</p>
              </article>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  )
}
