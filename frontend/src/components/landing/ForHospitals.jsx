import { useRef } from 'react'
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion'
import { ArrowRight, Check, Star } from 'lucide-react'
import { Link } from 'react-router-dom'
import { SCROLL_SPRING } from '../../lib/motion'
import { Reveal } from './Reveal'

const POINTS = [
  'A public profile patients can find and trust',
  'Update specialties, contact details, and your story anytime',
  'One clear pipeline from appointment to billing',
]

const CHIPS = ['Cardiology', 'Pediatrics', 'Emergency']

export default function ForHospitals() {
  const ref = useRef(null)
  const reduceMotion = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const progress = useSpring(scrollYProgress, SCROLL_SPRING)
  const glowY = useTransform(progress, [0, 1], [70, -70])
  const cardY = useTransform(progress, [0, 1], [30, -30])

  return (
    <section id="for-hospitals" ref={ref} className="scroll-mt-20 bg-white py-16 md:py-24">
      <div className="page-container">
        <div className="relative overflow-hidden rounded-2xl bg-brand-950 px-8 py-14 md:px-16 md:py-20">
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute -top-32 -right-32 h-[420px] w-[420px] rounded-full"
            style={{
              background: 'radial-gradient(circle, rgb(74 222 128 / 0.18), transparent 65%)',
              y: reduceMotion ? 0 : glowY,
            }}
          />
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-40 -left-24 h-[380px] w-[380px] rounded-full"
            style={{
              background: 'radial-gradient(circle, rgb(134 239 172 / 0.14), transparent 65%)',
              y: reduceMotion ? 0 : cardY,
            }}
          />

          <div className="relative grid gap-12 lg:grid-cols-2 lg:items-center">
            <Reveal>
              <p className="text-xs font-bold tracking-widest text-brand-300 uppercase">
                For hospitals
              </p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-[-0.02em] text-white md:text-4xl">
                Bring your hospital onto Aurora
              </h2>
              <p className="mt-4 max-w-lg text-base leading-relaxed text-white/70">
                Claim your profile, keep your services current, and let patients find you by
                specialty, area, and city.
              </p>

              <ul className="mt-8 space-y-4">
                {POINTS.map((point) => (
                  <li key={point} className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-400/15 text-brand-400">
                      <Check size={12} strokeWidth={3} />
                    </span>
                    <span className="text-sm leading-relaxed text-white/80">{point}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/hospital/apply"
                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full bg-white px-8 py-4 text-xs font-bold tracking-widest text-ink uppercase transition duration-300 hover:-translate-y-0.5 hover:bg-brand-50 focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-950 focus-visible:outline-none"
                >
                  Register your hospital
                  <ArrowRight size={14} strokeWidth={2.5} />
                </Link>
                <Link
                  to="/hospital/signin"
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-full border border-white/20 px-8 py-4 text-xs font-bold tracking-widest text-white uppercase transition duration-300 hover:-translate-y-0.5 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-950 focus-visible:outline-none"
                >
                  Sign in to the portal
                </Link>
              </div>

              <Link
                to="/for-hospitals"
                className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-brand-300 transition-colors hover:text-white"
              >
                Everything hospitals get on Aurora
                <ArrowRight size={14} strokeWidth={2.5} />
              </Link>
            </Reveal>

            <Reveal className="mx-auto w-full max-w-md">
              <motion.div style={reduceMotion ? undefined : { y: cardY }}>
                <p className="text-xs font-semibold tracking-widest text-white/50 uppercase">
                  Your public profile
                </p>
                <div className="mt-4 rounded-2xl bg-white p-6 shadow-lift">
                  <h3 className="text-lg font-semibold text-ink">
                    Cedar Valley General Hospital
                  </h3>
                  <p className="mt-1 text-sm text-mist">Mandian · Abbottabad</p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {CHIPS.map((chip) => (
                      <span
                        key={chip}
                        className="rounded-full border border-line px-3 py-1 text-xs font-medium text-body"
                      >
                        {chip}
                      </span>
                    ))}
                  </div>

                  <p className="mt-4 border-l-2 border-brand-200 pl-3 text-sm leading-relaxed text-mist italic">
                    “We schedule, bill, and follow up from one screen now.” — Imran Q.
                  </p>

                  <div className="mt-4 flex items-center gap-2">
                    <Star
                      size={14}
                      fill="currentColor"
                      strokeWidth={0}
                      className="text-brand-500"
                    />
                    <span className="text-sm font-semibold text-ink">4.8</span>
                    <span className="text-xs text-mist">(126 reviews)</span>
                  </div>
                </div>
              </motion.div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  )
}
