import { Link } from 'react-router-dom'
import { ArrowRight, Building2, Check } from 'lucide-react'
import Footer from '../components/landing/Footer'
import Navbar from '../components/landing/Navbar'
import { Reveal, RevealGroup, RevealItem } from '../components/landing/Reveal'

const STEPS = [
  {
    title: 'Create your account',
    copy: 'Sign up with your email in under a minute. Enter the six-digit code we send you to confirm the address — from then on you can sign in with a password or with a fresh emailed code, whichever you prefer.',
    points: ['One account for you and your family', 'No card, no waiting room', 'Confirm your email to unlock booking'],
  },
  {
    title: 'Find the right hospital',
    copy: 'Search by city, area, or specialty, and compare verified hospitals with ratings and reviews from real visits. Not sure what you need? Describe the problem and Aurora suggests the right kind of department.',
    points: ['Verified hospitals only', 'Filter by specialty, area, and city', 'Ratings and reviews before you choose'],
  },
  {
    title: 'Book your appointment',
    copy: 'Open a hospital page, pick a doctor and a free slot, and send the request. The hospital confirms it from its own queue — your visit then lives on one calendar you can check any time.',
    points: ['Slots from 09:00 to 17:00', 'Request, confirm, and reschedule in one place', 'Walk-in bookings recorded by the desk'],
  },
  {
    title: 'Keep your health in one place',
    copy: 'Records, prescriptions, lab reports, and vitals stay together in your account. Lab results arrive parameter by parameter, with the reference range and a flag when something sits outside it — released by the doctor who ordered the test.',
    points: ['Lab reports with reference ranges', 'Vitals tracked over time', 'A medical card that travels with you'],
  },
  {
    title: 'Ask Aurora',
    copy: 'Talk to an AI doctor by specialty, or open the therapy room for a private conversation. Aurora remembers what helps next time, and every memory is yours to read and delete.',
    points: ['AI doctors across specialties', 'A private therapy room', 'Memories you can review or remove'],
  },
  {
    title: 'Emergency support',
    copy: 'When something is urgent, one tap raises an SOS or an ambulance request with your location attached. The nearest hospital is alerted, your emergency contact is told, and your family can follow the ambulance live.',
    points: ['SOS and ambulance requests', 'Live ambulance tracking', 'Emergency status visible on your dashboard'],
  },
]

const PRIMARY_CTA =
  'btn-shine inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full bg-brand-700 px-8 py-4 text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-brand-900/20 hover:-translate-y-0.5 hover:bg-brand-800 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2'

const SECONDARY_CTA =
  'inline-flex items-center justify-center whitespace-nowrap rounded-full border border-line px-8 py-4 text-xs font-bold uppercase tracking-widest text-body transition duration-300 hover:-translate-y-0.5 hover:border-brand-300 hover:bg-brand-50 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2'

const DEEP_PRIMARY_CTA =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full bg-white px-8 py-4 text-xs font-bold uppercase tracking-widest text-ink transition duration-300 hover:-translate-y-0.5 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-950'

const DEEP_SECONDARY_CTA =
  'inline-flex items-center justify-center whitespace-nowrap rounded-full border border-white/20 px-8 py-4 text-xs font-bold uppercase tracking-widest text-white transition duration-300 hover:-translate-y-0.5 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-950'

export default function HowItWorksPage() {
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
                How it works
              </p>
              <h1 className="mt-3 text-3xl font-extrabold tracking-[-0.03em] text-balance text-ink sm:text-4xl md:text-5xl">
                From sign-up
                <br />
                <span className="text-brand-600">to follow-up.</span>
              </h1>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-body">
                Six steps take a patient from a first account to live emergency support — and every
                one of them writes to the same record.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link to="/signup" className={PRIMARY_CTA}>
                  Create your account
                  <ArrowRight size={14} strokeWidth={2.5} />
                </Link>
                <Link to="/features" className={SECONDARY_CTA}>
                  See all features
                </Link>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="bg-white py-16 md:py-24">
          <div className="page-container">
            <Reveal className="max-w-2xl">
              <p className="text-xs font-bold tracking-widest text-brand-700 uppercase">
                The journey
              </p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-[-0.02em] text-ink md:text-4xl">
                What happens, step by step
              </h2>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-body">
                Nothing here is a demo shortcut — each step is the actual flow a patient walks
                through on Aurora.
              </p>
            </Reveal>

            <RevealGroup className="relative mt-12 space-y-10">
              <span aria-hidden="true" className="absolute top-3 bottom-3 left-6 w-px bg-line" />

              {STEPS.map((step, index) => (
                <RevealItem key={step.title} className="relative flex gap-6">
                  <span className="relative z-10 grid h-12 w-12 shrink-0 place-items-center rounded-full border border-brand-200 bg-white text-sm font-bold text-brand-700 shadow-soft">
                    {String(index + 1).padStart(2, '0')}
                  </span>

                  <div className="min-w-0 pt-1">
                    <h3 className="text-xl font-semibold text-ink">{step.title}</h3>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-body">{step.copy}</p>
                    <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
                      {step.points.map((point) => (
                        <li key={point} className="flex items-center gap-2 text-xs text-mist">
                          <Check size={13} strokeWidth={3} className="shrink-0 text-brand-700" />
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                </RevealItem>
              ))}
            </RevealGroup>
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
                    Start with step one
                  </p>
                  <h2 className="mt-3 text-3xl font-extrabold tracking-[-0.02em] text-white md:text-4xl">
                    Your first appointment is a minute away
                  </h2>
                  <p className="mt-4 max-w-xl text-base leading-relaxed text-white/70">
                    Create a patient account, or browse the directory first if you would rather look
                    around before signing up.
                  </p>
                  <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                    <Link to="/signup" className={DEEP_PRIMARY_CTA}>
                      Get started
                      <ArrowRight size={14} strokeWidth={2.5} />
                    </Link>
                    <Link to="/explore" className={DEEP_SECONDARY_CTA}>
                      Explore hospitals
                    </Link>
                  </div>
                  <p className="mt-6 flex items-start gap-2.5 text-xs leading-relaxed text-white/60">
                    <Building2 size={14} className="mt-0.5 shrink-0 text-brand-400" />
                    On the hospital side, onboarding runs apply → review → portal. That flow is on
                    the hospital page.
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
