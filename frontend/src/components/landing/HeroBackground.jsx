import { useRef } from 'react'
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion'
import { EASE, SCROLL_SPRING } from '../../lib/motion'

const DOTS = [
  { cx: 200, cy: 150 },
  { cx: 600, cy: 250 },
  { cx: 1000, cy: 300 },
  { cx: 400, cy: 600 },
  { cx: 800, cy: 500 },
  { cx: 1200, cy: 550 },
  { cx: 300, cy: 400 },
  { cx: 700, cy: 350 },
  { cx: 1100, cy: 400 },
]

const PATHS = [
  {
    d: 'M-50,200 C200,100 400,350 600,250 S900,100 1100,300 S1300,200 1500,150',
    gradient: 'aurora-hero-grad1',
    strokeWidth: 1.5,
    delay: 0.5,
  },
  {
    d: 'M-50,600 C150,500 350,700 550,550 S800,400 1000,600 S1250,500 1500,450',
    gradient: 'aurora-hero-grad2',
    strokeWidth: 1.5,
    delay: 0.75,
  },
  {
    d: 'M-50,400 C100,300 300,500 500,350 S750,200 950,400 S1200,350 1500,300',
    gradient: 'aurora-hero-grad3',
    strokeWidth: 1,
    delay: 1,
  },
]

export default function HeroBackground({ photoSrc = null }) {
  const ref = useRef(null)
  const reduceMotion = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const progress = useSpring(scrollYProgress, SCROLL_SPRING)

  const glowTopY = useTransform(progress, [0, 1], [0, 140])
  const glowSideY = useTransform(progress, [0, 1], [0, -110])
  const gridY = useTransform(progress, [0, 1], [0, -60])
  const artY = useTransform(progress, [0, 1], [0, -150])
  const artOpacity = useTransform(progress, [0, 0.55, 1], [0.35, 0.35, 0])

  return (
    <div ref={ref} aria-hidden="true" className="pointer-events-none absolute inset-0">
      {photoSrc ? (
        <img
          src={photoSrc}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover opacity-10 grayscale"
        />
      ) : null}

      <motion.div
        className="absolute -top-40 -left-40 h-[560px] w-[560px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgb(134 239 172 / 0.4), transparent 65%)',
          y: reduceMotion ? 0 : glowTopY,
        }}
      />
      <motion.div
        className="absolute top-1/4 -right-48 h-[640px] w-[640px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgb(220 252 231 / 0.7), transparent 65%)',
          y: reduceMotion ? 0 : glowSideY,
        }}
      />

      <motion.div
        className="absolute inset-x-0 -inset-y-24"
        style={{
          backgroundImage: 'radial-gradient(rgb(5 46 22 / 0.08) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          y: reduceMotion ? 0 : gridY,
        }}
      />

      <motion.svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        style={{ opacity: reduceMotion ? 0.35 : artOpacity, y: reduceMotion ? 0 : artY }}
      >
        <defs>
          <linearGradient id="aurora-hero-grad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#16a34a" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#86efac" stopOpacity="0.15" />
          </linearGradient>
          <linearGradient id="aurora-hero-grad2" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#bbf7d0" stopOpacity="0.2" />
          </linearGradient>
          <linearGradient id="aurora-hero-grad3" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#15803d" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#86efac" stopOpacity="0.08" />
          </linearGradient>
        </defs>

        {PATHS.map((path) => (
          <motion.path
            key={path.gradient}
            d={path.d}
            fill="none"
            stroke={`url(#${path.gradient})`}
            strokeWidth={path.strokeWidth}
            strokeLinecap="round"
            initial={reduceMotion ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.8, ease: EASE, delay: path.delay }}
          />
        ))}

        {DOTS.map((dot, index) => (
          <motion.circle
            key={`${dot.cx}-${dot.cy}`}
            cx={dot.cx}
            cy={dot.cy}
            r="3"
            className="text-brand-700"
            fill="currentColor"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 0.45 }}
            transition={{ duration: 0.9, ease: EASE, delay: 0.9 + index * 0.08 }}
          />
        ))}
      </motion.svg>

      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-white via-white/80 to-transparent" />
    </div>
  )
}
