import { useRef } from 'react'
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion'
import { ArrowRight, Building2, Check, Cpu, FileText, Pill, Search, Siren } from 'lucide-react'
import { Link } from 'react-router-dom'
import Footer from '../components/landing/Footer'
import Navbar from '../components/landing/Navbar'
import { Reveal, RevealGroup, RevealItem } from '../components/landing/Reveal'
import { SCROLL_SPRING } from '../lib/motion'

const AREAS = [
  {
    icon: Search,
    title: 'Hospital discovery',
    copy: 'Search verified hospitals by city, area, and specialty — then book, reschedule, and check in from a phone.',
  },
  {
    icon: FileText,
    title: 'Records and results',
    copy: 'One history per patient, with released lab reports, reference ranges, and a medical card that travels.',
  },
  {
    icon: Pill,
    title: 'Safe prescribing',
    copy: 'Every prescription is checked against interactions, allergies, and conditions before it is issued.',
  },
  {
    icon: Building2,
    title: 'Hospital operations',
    copy: 'Beds, admissions, billing, insurance claims, inventory, and a marketplace — in one place.',
  },
  {
    icon: Siren,
    title: 'Emergency and ambulance',
    copy: 'SOS requests, a dispatch ladder, live tracking, and WhatsApp updates for family without an account.',
  },
  {
    icon: Cpu,
    title: 'Clinical AI, locally',
    copy: 'X-ray analysis and a grounded clinical assistant run on the hospital’s own machine, not a foreign API.',
  },
]

const PRACTICE = [
  'Patients see results the moment they are released.',
  'Care teams work from one queue instead of five registers.',
  'Clinical AI helps without patient data leaving the building.',
]

const PRINCIPLES = [
  'Nothing private leaves the building — the clinical model runs on local hardware and prompts carry no identifiers.',
  'Safety is a schema property, not a convention — the knowledge graph refuses malformed clinical claims.',
  'Calm by default — accessible, keyboard-first, and gentle with motion.',
  'Demo data only — every sample record in this environment is obviously fake.',
]

const PRIMARY_CTA =
  'btn-shine inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full bg-brand-700 px-8 py-4 text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-brand-900/20 hover:-translate-y-0.5 hover:bg-brand-800 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2'

const SECONDARY_CTA =
  'inline-flex items-center justify-center whitespace-nowrap rounded-full border border-line px-8 py-4 text-xs font-bold uppercase tracking-widest text-body transition duration-300 hover:-translate-y-0.5 hover:border-brand-300 hover:bg-brand-50 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2'

export default function AboutPage() {
  const principlesRef = useRef(null)
  const reduceMotion = useReducedMotion()
  const { scrollYProgress } = useScroll({
    target: principlesRef,
    offset: ['start end', 'end start'],
  })
  const progress = useSpring(scrollYProgress, SCROLL_SPRING)
  const glowY = useTransform(progress, [0, 1], [70, -70])
  const glowTwoY = useTransform(progress, [0, 1], [30, -30])

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      <main>
        <section className="relative overflow-hidden bg-white pt-32 pb-16 md:pt-40 md:pb-24">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-32 -right-32 h-[520px] w-[520px] rounded-full"
            style={{
              background: 'radial-gradient(circle, rgb(220 252 231 / 0.55), transparent 65%)',
            }}
          />

          <div className="relative page-container">
            <Reveal className="max-w-2xl">
              <p className="text-xs font-bold tracking-widest text-brand-700 uppercase">
                About Aurora
              </p>
              <h1 className="mt-3 text-3xl font-extrabold tracking-[-0.03em] text-balance text-ink sm:text-4xl md:text-5xl">
                From paper registers,
                <br />
                <span className="text-brand-600">to one calm platform.</span>
              </h1>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-body">
                Aurora is a hospital-management platform with a clinical AI layer that runs on the
                hospital’s own machine — built for the MLH × COMSATS Islamabad (Abbottabad)
                hackathon.
              </p>
            </Reveal>
          </div>
        </section>

        <section className="bg-white py-16 md:py-24">
          <div className="page-container">
            <div className="grid gap-12 md:grid-cols-2 md:items-center">
              <Reveal>
                <p className="text-xs font-bold tracking-widest text-brand-700 uppercase">
                  Why we built it
                </p>
                <h2 className="mt-3 text-3xl font-extrabold tracking-[-0.02em] text-ink md:text-4xl">
                  Care still runs on paper in too many hospitals
                </h2>
                <p className="mt-4 max-w-xl text-base leading-relaxed text-body">
                  Small and mid-sized hospitals still run on paper registers, WhatsApp threads, and
                  spreadsheets that never quite meet. Patients cannot see their own results,
                  hospitals cannot see their own numbers, and clinical AI feels out of reach —
                  because it usually means sending patient data to a foreign API.
                </p>
                <p className="mt-4 max-w-xl text-base leading-relaxed text-body">
                  Aurora was built the other way around: one platform for discovery, records, labs,
                  prescriptions, billing, and emergencies, with a clinical model that stays on the
                  hospital’s own machine. It began as a hackathon build for MLH × COMSATS Islamabad
                  (Abbottabad) and grew into the full stack you can walk through today.
                </p>
              </Reveal>

              <Reveal delay={0.1}>
                <div className="rounded-2xl border border-line bg-white p-6 shadow-soft">
                  <p className="text-xs font-bold tracking-widest text-mist uppercase">
                    What that means
                  </p>
                  <ul className="mt-5 space-y-4">
                    {PRACTICE.map((point) => (
                      <li key={point} className="flex items-start gap-3">
                        <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                          <Check size={12} strokeWidth={3} />
                        </span>
                        <span className="text-sm leading-relaxed text-body">{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        <section className="bg-white py-16 md:py-24">
          <div className="page-container">
            <Reveal className="max-w-2xl">
              <p className="text-xs font-bold tracking-widest text-brand-700 uppercase">
                What’s inside
              </p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-[-0.02em] text-ink md:text-4xl">
                One platform for every side of care
              </h2>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-body">
                Patients, doctors, hospitals, and the platform team each get a console — and every
                console reads from the same records.
              </p>
            </Reveal>

            <RevealGroup className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {AREAS.map(({ icon: Icon, title, copy }) => (
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

        <section ref={principlesRef} className="bg-white py-16 md:py-24">
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
                  y: reduceMotion ? 0 : glowTwoY,
                }}
              />

              <div className="relative max-w-2xl">
                <Reveal>
                  <p className="text-xs font-bold tracking-widest text-brand-300 uppercase">
                    What we hold to
                  </p>
                  <h2 className="mt-3 text-3xl font-extrabold tracking-[-0.02em] text-white md:text-4xl">
                    Principles we will not trade away
                  </h2>
                  <p className="mt-4 max-w-xl text-base leading-relaxed text-white/70">
                    The rules behind every screen, endpoint, and safety check.
                  </p>
                  <ul className="mt-8 space-y-4">
                    {PRINCIPLES.map((principle) => (
                      <li key={principle} className="flex items-start gap-3">
                        <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-400/15 text-brand-400">
                          <Check size={12} strokeWidth={3} />
                        </span>
                        <span className="text-sm leading-relaxed text-white/80">{principle}</span>
                      </li>
                    ))}
                  </ul>
                </Reveal>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white py-16 md:py-24">
          <div className="page-container">
            <Reveal className="max-w-2xl">
              <p className="text-xs font-bold tracking-widest text-brand-700 uppercase">
                Start here
              </p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-[-0.02em] text-ink md:text-4xl">
                See Aurora for yourself
              </h2>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-body">
                Create a patient account, browse the hospital directory, or try the one-click demo
                on the sign-in page.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link to="/signup" className={PRIMARY_CTA}>
                  Get started
                  <ArrowRight size={14} strokeWidth={2.5} />
                </Link>
                <Link to="/explore" className={SECONDARY_CTA}>
                  Explore hospitals
                </Link>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
