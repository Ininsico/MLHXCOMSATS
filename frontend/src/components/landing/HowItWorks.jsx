import { useRef } from 'react'
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion'
import { SCROLL_SPRING } from '../../lib/motion'
import { Reveal, RevealGroup, RevealItem } from './Reveal'

const STEPS = [
  {
    title: 'Create your account',
    copy: 'Sign up in under a minute — no credit card required.',
  },
  {
    title: 'Find the right hospital',
    copy: 'Search by city, area, or specialty and compare verified hospitals near you.',
  },
  {
    title: 'Keep care in one place',
    copy: 'Appointments, records, prescriptions, and billing stay in sync from then on.',
  },
]

export default function HowItWorks() {
  const ref = useRef(null)
  const reduceMotion = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const progress = useSpring(scrollYProgress, SCROLL_SPRING)
  const lineScale = useTransform(progress, [0.25, 0.6], [0, 1])
  const glowY = useTransform(progress, [0, 1], [-60, 60])

  return (
    <section
      id="how-it-works"
      ref={ref}
      className="relative scroll-mt-20 overflow-hidden bg-white py-16 md:py-24"
    >
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute top-10 -right-40 h-[480px] w-[480px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgb(240 253 244 / 0.9), transparent 65%)',
          y: reduceMotion ? 0 : glowY,
        }}
      />

      <div className="relative mx-auto max-w-6xl px-6">
        <Reveal className="max-w-2xl">
          <p className="text-xs font-bold tracking-widest text-brand-700 uppercase">
            How it works
          </p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-[-0.02em] text-ink md:text-4xl">
            From sign-up to follow-up in three steps
          </h2>
        </Reveal>

        <div className="relative mt-12">
          <div className="absolute top-6 left-6 right-[calc(33.333%_-_1.5rem)] hidden h-px bg-line md:block" />
          <motion.div
            className="absolute top-6 left-6 right-[calc(33.333%_-_1.5rem)] hidden h-px origin-left bg-gradient-to-r from-brand-300 via-brand-500 to-brand-300 md:block"
            style={{ scaleX: reduceMotion ? 1 : lineScale }}
          />

          <RevealGroup className="grid gap-10 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <RevealItem key={step.title}>
                <span className="relative z-10 inline-flex h-12 w-12 items-center justify-center rounded-full border border-brand-200 bg-white text-sm font-bold text-brand-700 shadow-soft">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-5 text-xl font-semibold text-ink">{step.title}</h3>
                <p className="mt-2 max-w-sm text-sm leading-relaxed text-body">{step.copy}</p>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </div>
    </section>
  )
}
