import { useRef } from 'react'
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import HeroBackground from './HeroBackground'
import MagneticButton from './MagneticButton'
import { EASE, SCROLL_SPRING } from '../../lib/motion'

const enter = (delay, distance = 30, duration = 1) => ({
  initial: { opacity: 0, y: distance },
  animate: { opacity: 1, y: 0 },
  transition: { duration, ease: EASE, delay },
})

const PRIMARY_CTA =
  'btn-shine inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full bg-brand-700 px-8 py-4 text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-brand-900/20 hover:-translate-y-0.5 hover:bg-brand-800 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2'

const SECONDARY_CTA =
  'inline-flex items-center justify-center whitespace-nowrap rounded-full border border-line px-8 py-4 text-xs font-bold uppercase tracking-widest text-body transition duration-300 hover:-translate-y-0.5 hover:border-brand-300 hover:bg-brand-50 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2'

export default function Hero() {
  const ref = useRef(null)
  const navigate = useNavigate()
  const reduceMotion = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const progress = useSpring(scrollYProgress, SCROLL_SPRING)

  const y = useTransform(progress, [0, 1], [0, 90])
  const scale = useTransform(progress, [0, 1], [1, 0.94])
  const opacity = useTransform(progress, [0, 0.75], [1, 0])

  return (
    <section ref={ref} aria-label="Hero" className="relative min-h-[110vh] overflow-hidden bg-white">
      <HeroBackground />

      <motion.div
        style={reduceMotion ? undefined : { y, scale, opacity }}
        className="relative z-10 mx-auto flex min-h-[110vh] max-w-6xl flex-col items-center justify-center px-6 pt-20 pb-24 text-center"
      >
        <motion.div
          {...enter(0.3, 30, 1.2)}
          className="flex w-full max-w-4xl flex-col items-center gap-6"
        >
          <motion.img
            {...enter(0.5, 20, 0.8)}
            src="/Aurora.png"
            alt="Aurora"
            className="h-12 w-auto"
          />

          <motion.h1
            {...enter(0.7, 30, 1)}
            className="text-balance text-4xl leading-[0.92] font-extrabold tracking-[-0.04em] text-ink sm:text-5xl md:text-6xl lg:text-[5.5rem]"
          >
            Better care,
            <br />
            <span className="text-brand-600">less paperwork.</span>
          </motion.h1>

          <motion.p
            {...enter(0.9, 20, 0.8)}
            className="max-w-lg text-balance text-sm leading-relaxed font-medium text-mist sm:text-base"
          >
            Appointments, patient records, prescriptions, and billing — one calm platform for
            clinics and hospitals.
          </motion.p>

          <motion.div
            {...enter(1.2, 20, 0.8)}
            className="flex flex-col items-center justify-center gap-4 pt-2 sm:flex-row"
          >
            <MagneticButton onClick={() => navigate('/signup')} className={PRIMARY_CTA}>
              Start free trial
              <ArrowRight size={14} strokeWidth={2.5} />
            </MagneticButton>
            <Link to="/explore" className={SECONDARY_CTA}>
              Explore hospitals
            </Link>
          </motion.div>
        </motion.div>
      </motion.div>
    </section>
  )
}
