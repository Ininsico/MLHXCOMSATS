import { Link } from 'react-router-dom'
import {
  Activity,
  ArrowRight,
  Brain,
  Building2,
  CalendarCheck,
  Check,
  FileText,
  FlaskConical,
  HeartHandshake,
  Search,
  Siren,
  Sparkles,
} from 'lucide-react'
import Footer from '../components/landing/Footer'
import Navbar from '../components/landing/Navbar'
import { Reveal, RevealGroup, RevealItem } from '../components/landing/Reveal'

const CAPABILITIES = [
  {
    icon: Search,
    title: 'Hospital discovery',
    copy: 'Search verified hospitals by city, area, and specialty, then compare ratings and reviews from real visits.',
  },
  {
    icon: CalendarCheck,
    title: 'Appointments',
    copy: 'Request a slot, get it confirmed, and keep every visit — yours or your family’s — on one calendar.',
  },
  {
    icon: FileText,
    title: 'Medical records',
    copy: 'History, notes, and prescriptions organised per patient and readable by the care team that needs them.',
  },
  {
    icon: FlaskConical,
    title: 'Lab results',
    copy: 'Reports arrive per parameter with reference ranges and out-of-range flags, released by the doctor who ordered them.',
  },
  {
    icon: Activity,
    title: 'Vitals',
    copy: 'Blood pressure, sugar, and weight tracked over time, so a trend is obvious before it becomes a problem.',
  },
  {
    icon: Siren,
    title: 'Emergency SOS',
    copy: 'One tap alerts the nearest hospital with your location and tells your emergency contact — family can follow the ambulance live.',
  },
  {
    icon: Brain,
    title: 'AI doctors',
    copy: 'Talk to an in-house assistant by specialty, grounded in your own history — the clinical model runs locally, not on a foreign API.',
  },
  {
    icon: HeartHandshake,
    title: 'Therapy',
    copy: 'A private room for a hard day or a long week, with memories you can read and delete at any time.',
  },
  {
    icon: Sparkles,
    title: 'Care navigation',
    copy: 'Describe what is going on in your own words and Aurora points you to the right kind of department.',
  },
]

const PATIENT_SIDE = [
  'Find and compare verified hospitals near you',
  'Book, track, and follow up on every appointment',
  'Read your own lab reports the moment they are released',
  'Reach AI care and therapy from the same account',
]

const HOSPITAL_SIDE = [
  'One queue instead of five registers and a phone',
  'Staff, laboratory, and inventory in the same console',
  'Emergency requests dispatched with live tracking',
  'A public profile patients can find and trust',
]

const PRIMARY_CTA =
  'btn-shine inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full bg-brand-700 px-8 py-4 text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-brand-900/20 hover:-translate-y-0.5 hover:bg-brand-800 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2'

const SECONDARY_CTA =
  'inline-flex items-center justify-center whitespace-nowrap rounded-full border border-line px-8 py-4 text-xs font-bold uppercase tracking-widest text-body transition duration-300 hover:-translate-y-0.5 hover:border-brand-300 hover:bg-brand-50 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2'

const DEEP_PRIMARY_CTA =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full bg-white px-8 py-4 text-xs font-bold uppercase tracking-widest text-ink transition duration-300 hover:-translate-y-0.5 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-950'

const DEEP_SECONDARY_CTA =
  'inline-flex items-center justify-center whitespace-nowrap rounded-full border border-white/20 px-8 py-4 text-xs font-bold uppercase tracking-widest text-white transition duration-300 hover:-translate-y-0.5 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-950'

export default function FeaturesPage() {
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
              <p className="text-xs font-bold tracking-widest text-brand-700 uppercase">Features</p>
              <h1 className="mt-3 text-3xl font-extrabold tracking-[-0.03em] text-balance text-ink sm:text-4xl md:text-5xl">
                Everything care touches,
                <br />
                <span className="text-brand-600">in one calm platform.</span>
              </h1>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-body">
                Discovery, appointments, records, labs, vitals, emergency support, and AI care —
                built to work together instead of in five separate tabs.
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

        <section className="bg-white py-16 md:py-24">
          <div className="page-container">
            <Reveal className="max-w-2xl">
              <p className="text-xs font-bold tracking-widest text-brand-700 uppercase">
                Capabilities
              </p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-[-0.02em] text-ink md:text-4xl">
                One platform for every step of care
              </h2>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-body">
                Every capability below lives in the same account, reads the same records, and is
                available to the people allowed to see it.
              </p>
            </Reveal>

            <RevealGroup className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {CAPABILITIES.map(({ icon: Icon, title, copy }) => (
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

        <section className="bg-white py-16 md:py-24">
          <div className="page-container">
            <Reveal className="max-w-2xl">
              <p className="text-xs font-bold tracking-widest text-brand-700 uppercase">
                Both sides of the desk
              </p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-[-0.02em] text-ink md:text-4xl">
                Patients and hospitals, on the same records
              </h2>
            </Reveal>

            <div className="mt-12 grid gap-6 md:grid-cols-2">
              <Reveal>
                <article className="h-full rounded-2xl border border-line bg-white p-6 shadow-soft md:p-8">
                  <h3 className="text-xl font-semibold text-ink">For patients</h3>
                  <ul className="mt-5 space-y-4">
                    {PATIENT_SIDE.map((point) => (
                      <li key={point} className="flex items-start gap-3">
                        <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                          <Check size={12} strokeWidth={3} />
                        </span>
                        <span className="text-sm leading-relaxed text-body">{point}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    to="/explore"
                    className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-brand-700 transition-colors hover:text-brand-800"
                  >
                    Explore hospitals
                    <ArrowRight size={14} strokeWidth={2.5} />
                  </Link>
                </article>
              </Reveal>

              <Reveal delay={0.1}>
                <article className="h-full rounded-2xl border border-line bg-white p-6 shadow-soft md:p-8">
                  <h3 className="text-xl font-semibold text-ink">For hospitals</h3>
                  <ul className="mt-5 space-y-4">
                    {HOSPITAL_SIDE.map((point) => (
                      <li key={point} className="flex items-start gap-3">
                        <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                          <Check size={12} strokeWidth={3} />
                        </span>
                        <span className="text-sm leading-relaxed text-body">{point}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    to="/for-hospitals"
                    className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-brand-700 transition-colors hover:text-brand-800"
                  >
                    See the hospital console
                    <ArrowRight size={14} strokeWidth={2.5} />
                  </Link>
                </article>
              </Reveal>
            </div>
          </div>
        </section>

        <section className="bg-white py-16 md:py-24">
          <div className="page-container">
            <div className="relative overflow-hidden rounded-2xl bg-brand-950 px-8 py-14 md:px-16 md:py-20">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-32 -right-32 h-[420px] w-[420px] rounded-full"
                style={{
                  background: 'radial-gradient(circle, rgb(74 222 128 / 0.18), transparent 65%)',
                }}
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-40 -left-24 h-[380px] w-[380px] rounded-full"
                style={{
                  background: 'radial-gradient(circle, rgb(134 239 172 / 0.14), transparent 65%)',
                }}
              />

              <div className="relative max-w-2xl">
                <Reveal>
                  <p className="text-xs font-bold tracking-widest text-brand-300 uppercase">
                    Start here
                  </p>
                  <h2 className="mt-3 text-3xl font-extrabold tracking-[-0.02em] text-white md:text-4xl">
                    See Aurora with your own account
                  </h2>
                  <p className="mt-4 max-w-xl text-base leading-relaxed text-white/70">
                    Create a patient account, browse the hospital directory, or try the one-click
                    demo on the sign-in page.
                  </p>
                  <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                    <Link to="/signup" className={DEEP_PRIMARY_CTA}>
                      Get started
                      <ArrowRight size={14} strokeWidth={2.5} />
                    </Link>
                    <Link to="/how-it-works" className={DEEP_SECONDARY_CTA}>
                      See how it works
                    </Link>
                  </div>
                  <p className="mt-6 flex items-start gap-2.5 text-xs leading-relaxed text-white/60">
                    <Building2 size={14} className="mt-0.5 shrink-0 text-brand-400" />
                    Running a hospital? See the console, onboarding, and verification on the
                    hospital page.
                  </p>
                </Reveal>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
