import { Link } from 'react-router-dom'
import {
  Ambulance,
  ArrowRight,
  CalendarCheck,
  Check,
  FlaskConical,
  MapPin,
  Pill,
  ShieldCheck,
  Star,
  Stethoscope,
} from 'lucide-react'
import Footer from '../components/landing/Footer'
import Navbar from '../components/landing/Navbar'
import { Reveal, RevealGroup, RevealItem } from '../components/landing/Reveal'

const ONBOARDING = [
  {
    title: 'Apply',
    copy: 'Tell us about your hospital — name, city, area, specialties, contact details, and a short description patients will read.',
  },
  {
    title: 'Get reviewed',
    copy: 'Our team reads every application before a profile appears in patient search. You can follow the status from your own pending screen.',
  },
  {
    title: 'Open the portal',
    copy: 'Once approved, your console unlocks: appointments, staff, laboratory, inventory, emergency dispatch, and your public page.',
  },
]

const CONSOLE = [
  {
    icon: CalendarCheck,
    title: 'Appointments',
    copy: 'Patient requests land in one queue. Confirm, complete, or cancel, and record walk-ins at the desk.',
  },
  {
    icon: Stethoscope,
    title: 'Doctors & staff',
    copy: 'Register doctors, nurses, receptionists, lab, and admin accounts with specialty, department, and status.',
  },
  {
    icon: FlaskConical,
    title: 'Laboratory',
    copy: 'Build your test catalogue with reference ranges, file results per parameter, and release reports to the patient.',
  },
  {
    icon: Pill,
    title: 'Inventory & pharmacy',
    copy: 'Stock levels with reorder warnings and movement logging, so a shortage is visible before it becomes one.',
  },
  {
    icon: Ambulance,
    title: 'Emergency & fleet',
    copy: 'SOS and ambulance requests arrive with location attached, then move along the dispatch ladder with live tracking.',
  },
  {
    icon: ShieldCheck,
    title: 'Verification',
    copy: 'Submit up to five labelled documents and track the review. Verified hospitals carry a badge patients can see.',
  },
]

const BENEFITS = [
  'Patients find you by specialty, area, and city — with your own public page.',
  'One queue replaces the phone, the register, and the five spreadsheets.',
  'Laboratory results reach the patient the moment your doctor releases them.',
  'Emergency requests arrive with a location, not a description of one.',
  'Stock, staff, and beds are visible before the day starts, not after.',
  'Pick a plan, then a theme for your public page — what you choose is what patients get.',
]

const PRIMARY_CTA =
  'btn-shine inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full bg-brand-700 px-8 py-4 text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-brand-900/20 hover:-translate-y-0.5 hover:bg-brand-800 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2'

const SECONDARY_CTA =
  'inline-flex items-center justify-center whitespace-nowrap rounded-full border border-line px-8 py-4 text-xs font-bold uppercase tracking-widest text-body transition duration-300 hover:-translate-y-0.5 hover:border-brand-300 hover:bg-brand-50 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2'

const DEEP_PRIMARY_CTA =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full bg-white px-8 py-4 text-xs font-bold uppercase tracking-widest text-ink transition duration-300 hover:-translate-y-0.5 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-950'

const DEEP_SECONDARY_CTA =
  'inline-flex items-center justify-center whitespace-nowrap rounded-full border border-white/20 px-8 py-4 text-xs font-bold uppercase tracking-widest text-white transition duration-300 hover:-translate-y-0.5 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-950'

const CHIPS = ['Cardiology', 'Pediatrics', 'Emergency']

export default function ForHospitalsPage() {
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
                For hospitals
              </p>
              <h1 className="mt-3 text-3xl font-extrabold tracking-[-0.03em] text-balance text-ink sm:text-4xl md:text-5xl">
                Run the whole hospital,
                <br />
                <span className="text-brand-600">from one console.</span>
              </h1>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-body">
                Appointments, staff, laboratory, inventory, emergency dispatch, and a public profile
                patients can find and trust — without stitching five systems together.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link to="/hospital/apply" className={PRIMARY_CTA}>
                  Register your hospital
                  <ArrowRight size={14} strokeWidth={2.5} />
                </Link>
                <Link to="/hospital/signin" className={SECONDARY_CTA}>
                  Sign in to the portal
                </Link>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="bg-white py-16 md:py-24">
          <div className="page-container">
            <Reveal className="max-w-2xl">
              <p className="text-xs font-bold tracking-widest text-brand-700 uppercase">
                Onboarding
              </p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-[-0.02em] text-ink md:text-4xl">
                Three steps onto the platform
              </h2>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-body">
                Nothing goes live in patient search until a person on our side has read your
                application.
              </p>
            </Reveal>

            <RevealGroup className="mt-12 grid gap-6 md:grid-cols-3">
              {ONBOARDING.map((step, index) => (
                <RevealItem key={step.title}>
                  <article className="h-full rounded-2xl border border-line bg-white p-6 shadow-soft">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-700">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <h3 className="mt-5 text-lg font-semibold text-ink">{step.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-body">{step.copy}</p>
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
                Inside the console
              </p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-[-0.02em] text-ink md:text-4xl">
                What your team works in every day
              </h2>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-body">
                Every console reads from the same records, so the front desk, the lab, and the ward
                never argue about whose sheet is right.
              </p>
            </Reveal>

            <RevealGroup className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {CONSOLE.map(({ icon: Icon, title, copy }) => (
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
            <div className="grid gap-12 md:grid-cols-2 md:items-center">
              <Reveal>
                <p className="text-xs font-bold tracking-widest text-brand-700 uppercase">
                  Verification & profile
                </p>
                <h2 className="mt-3 text-3xl font-extrabold tracking-[-0.02em] text-ink md:text-4xl">
                  A profile patients can trust
                </h2>
                <p className="mt-4 max-w-xl text-base leading-relaxed text-body">
                  Send up to five labelled documents and track the review from your console. Once
                  verified, your name carries a badge beside it everywhere patients see you.
                </p>
                <p className="mt-4 max-w-xl text-base leading-relaxed text-body">
                  Your public page then carries your logo, address, specialties, photos, and
                  reviews — with a plan and theme you choose, previewed before it goes live.
                </p>
                <Link
                  to="/explore"
                  className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-brand-700 transition-colors hover:text-brand-800"
                >
                  See how hospitals appear to patients
                  <ArrowRight size={14} strokeWidth={2.5} />
                </Link>
              </Reveal>

              <Reveal delay={0.1}>
                <div className="rounded-2xl border border-line bg-white p-6 shadow-lift">
                  <p className="text-xs font-semibold tracking-widest text-mist uppercase">
                    Your public profile
                  </p>
                  <h3 className="mt-3 flex flex-wrap items-center gap-2.5 text-lg font-semibold text-ink">
                    Cedar Valley General Hospital
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-800">
                      <ShieldCheck size={13} />
                      Verified
                    </span>
                  </h3>
                  <p className="mt-1 flex items-center gap-2 text-sm text-mist">
                    <MapPin size={14} />
                    Mandian · Abbottabad
                  </p>

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
                    <Star size={14} fill="currentColor" strokeWidth={0} className="text-brand-500" />
                    <span className="text-sm font-semibold text-ink">4.8</span>
                    <span className="text-xs text-mist">(126 reviews)</span>
                  </div>

                  <p className="mt-5 border-t border-line pt-4 text-xs text-mist">
                    Sample profile — demo data only.
                  </p>
                </div>
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

              <div className="relative grid gap-12 lg:grid-cols-2 lg:items-center">
                <Reveal>
                  <p className="text-xs font-bold tracking-widest text-brand-300 uppercase">
                    Why hospitals join
                  </p>
                  <h2 className="mt-3 text-3xl font-extrabold tracking-[-0.02em] text-white md:text-4xl">
                    Bring your hospital onto Aurora
                  </h2>
                  <p className="mt-4 max-w-xl text-base leading-relaxed text-white/70">
                    Apply in a few minutes. Once the review is done, your console and your public
                    page are ready the same day.
                  </p>
                  <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                    <Link to="/hospital/apply" className={DEEP_PRIMARY_CTA}>
                      Register your hospital
                      <ArrowRight size={14} strokeWidth={2.5} />
                    </Link>
                    <Link to="/hospital/signin" className={DEEP_SECONDARY_CTA}>
                      Sign in to the portal
                    </Link>
                  </div>
                </Reveal>

                <Reveal delay={0.1}>
                  <ul className="space-y-4">
                    {BENEFITS.map((point) => (
                      <li key={point} className="flex items-start gap-3">
                        <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-400/15 text-brand-400">
                          <Check size={12} strokeWidth={3} />
                        </span>
                        <span className="text-sm leading-relaxed text-white/80">{point}</span>
                      </li>
                    ))}
                  </ul>
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
