import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Check,
  ChevronDown,
  Clock,
  Mail,
  MailCheck,
  MapPin,
  Phone,
  Send,
} from 'lucide-react'
import Footer from '../components/landing/Footer'
import Navbar from '../components/landing/Navbar'
import { Reveal, RevealGroup, RevealItem } from '../components/landing/Reveal'
import { TextField } from '../components/FormFields'

const SUPPORT_PHONE = '+92 300 1122334'
const SUPPORT_EMAIL = 'support@aurora.local'

const DETAILS = [
  {
    icon: Mail,
    label: 'Email',
    value: SUPPORT_EMAIL,
    href: `mailto:${SUPPORT_EMAIL}`,
    hint: 'Best for account, appointment, and hospital questions.',
  },
  {
    icon: Phone,
    label: 'Phone',
    value: SUPPORT_PHONE,
    href: 'tel:+923001122334',
    hint: 'Answered during support hours only.',
  },
  {
    icon: MapPin,
    label: 'Location',
    value: 'Abbottabad, Pakistan',
    hint: 'Our team is remote — we do not take walk-in visits.',
  },
  {
    icon: Clock,
    label: 'Support hours',
    value: 'Monday to Saturday, 9:00 – 18:00 PKT',
    hint: 'Closed on Sundays and public holidays.',
  },
]

const FAQS = [
  {
    id: 'account',
    question: 'How do I create a patient account?',
    answer: (
      <>
        Sign up with your email address, then enter the six-digit code we send you to confirm it.
        After that you can book appointments, read released lab reports, and manage your details
        from the patient dashboard.{' '}
        <Link
          to="/signup"
          className="font-semibold text-brand-700 transition-colors hover:text-brand-800"
        >
          Create a patient account
        </Link>
        . Prefer no password? Sign in with a one-time email code instead.
      </>
    ),
  },
  {
    id: 'appointments',
    question: 'Can I book or change an appointment myself?',
    answer: (
      <>
        Yes for booking — search for a hospital, pick a specialty and a free slot, then confirm.
        Your request lands on the hospital’s queue for approval. To move or cancel an existing
        booking, call the hospital directly; its number is on the hospital page.
      </>
    ),
  },
  {
    id: 'signin',
    question: 'I can’t sign in, or my email is not confirmed yet.',
    answer: (
      <>
        On the sign-in page choose “Email code” and we will send a six-digit code that works for ten
        minutes. Forgot your password? Reset it with the same email code. If your address is still
        unconfirmed, enter the code from your signup email — you can keep browsing in the meantime.
      </>
    ),
  },
  {
    id: 'hospital',
    question: 'I run a hospital — how do we join Aurora?',
    answer: (
      <>
        Register your hospital from the hospital portal. Our team reviews every application before
        the profile appears in patient search, and you can follow the status on the same page.{' '}
        <Link
          to="/hospital/apply"
          className="font-semibold text-brand-700 transition-colors hover:text-brand-800"
        >
          Register your hospital
        </Link>
        .
      </>
    ),
  },
]

const TRUST = [
  'Every hospital is reviewed by our team before it appears in patient search.',
  'Patients, doctors, and hospitals each see only what their role allows.',
  'Appointments, records, labs, and billing in one calm platform.',
]

const PRIMARY_CTA =
  'btn-shine inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full bg-brand-700 px-8 py-4 text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-brand-900/20 hover:-translate-y-0.5 hover:bg-brand-800 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2'

const DEEP_PRIMARY_CTA =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full bg-white px-8 py-4 text-xs font-bold uppercase tracking-widest text-ink transition duration-300 hover:-translate-y-0.5 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-950'

const DEEP_SECONDARY_CTA =
  'inline-flex items-center justify-center whitespace-nowrap rounded-full border border-white/20 px-8 py-4 text-xs font-bold uppercase tracking-widest text-white transition duration-300 hover:-translate-y-0.5 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-950'

const CALM_BUTTON =
  'inline-flex items-center justify-center whitespace-nowrap rounded-full border border-line px-6 py-3 text-xs font-bold uppercase tracking-widest text-body transition duration-300 hover:-translate-y-0.5 hover:border-brand-300 hover:bg-brand-50 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2'

const FIELD_CLASS =
  'mt-2 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30'

const EMPTY_FORM = { name: '', email: '', subject: '', message: '' }

export default function ContactPage() {
  const [form, setForm] = useState(EMPTY_FORM)
  const [sentTo, setSentTo] = useState('')
  const [openFaq, setOpenFaq] = useState('account')

  function handleChange(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    setSentTo(form.name.trim())
  }

  function startOver() {
    setForm(EMPTY_FORM)
    setSentTo('')
  }

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
                Contact us
              </p>
              <h1 className="mt-3 text-3xl font-extrabold tracking-[-0.03em] text-balance text-ink sm:text-4xl md:text-5xl">
                We’re here to help
              </h1>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-body">
                Have a question, need assistance, or want to learn more about our healthcare
                platform? Our team is ready to help.
              </p>
            </Reveal>
          </div>
        </section>

        <section className="bg-white py-16 md:py-24">
          <div className="page-container">
            <RevealGroup className="grid gap-12 lg:grid-cols-5">
              <RevealItem className="lg:col-span-2">
                <h2 className="text-2xl font-bold tracking-[-0.01em] text-ink">
                  Contact information
                </h2>
                <p className="mt-3 max-w-sm text-sm leading-relaxed text-body">
                  Write to a team that reads every message — or call us during support hours.
                </p>

                <div className="mt-8 rounded-2xl border border-line bg-white p-6 shadow-soft">
                  <ul className="divide-y divide-line">
                    {DETAILS.map(({ icon: Icon, label, value, href, hint }) => (
                      <li key={label} className="flex items-start gap-4 py-5 first:pt-0 last:pb-0">
                        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                          <Icon size={20} strokeWidth={2} />
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold tracking-widest text-mist uppercase">
                            {label}
                          </p>
                          {href ? (
                            <a
                              href={href}
                              className="mt-1 block truncate text-sm font-semibold text-brand-700 transition-colors hover:text-brand-800"
                            >
                              {value}
                            </a>
                          ) : (
                            <p className="mt-1 text-sm font-semibold text-ink">{value}</p>
                          )}
                          <p className="mt-1 text-xs leading-relaxed text-mist">{hint}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </RevealItem>

              <RevealItem className="lg:col-span-3">
                <div className="rounded-2xl border border-line bg-white p-6 shadow-soft md:p-8">
                  {sentTo ? (
                    <>
                      <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                        <MailCheck size={22} strokeWidth={2} />
                      </span>
                      <h2 className="mt-5 text-2xl font-bold tracking-[-0.01em] text-ink">
                        Thanks, {sentTo} — your message is with our team.
                      </h2>
                      <p className="mt-3 text-sm leading-relaxed text-body">
                        We usually reply within one business day. If you need us sooner, call{' '}
                        <a
                          href="tel:+923001122334"
                          className="font-semibold text-brand-700 transition-colors hover:text-brand-800"
                        >
                          {SUPPORT_PHONE}
                        </a>{' '}
                        during support hours.
                      </p>
                      <p className="mt-4 text-xs leading-relaxed text-mist">
                        This is a demo environment, so the form does not send email yet. You can
                        also write to{' '}
                        <a
                          href={`mailto:${SUPPORT_EMAIL}`}
                          className="font-semibold text-brand-700 transition-colors hover:text-brand-800"
                        >
                          {SUPPORT_EMAIL}
                        </a>
                        .
                      </p>
                      <button type="button" onClick={startOver} className={`mt-6 ${CALM_BUTTON}`}>
                        Send another message
                      </button>
                    </>
                  ) : (
                    <>
                      <h2 className="text-2xl font-bold tracking-[-0.01em] text-ink">
                        Send us a message
                      </h2>
                      <p className="mt-3 text-sm leading-relaxed text-body">
                        Tell us what you need — the right person picks it up from here.
                      </p>

                      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                        <div className="grid gap-5 sm:grid-cols-2">
                          <TextField
                            id="contact-name"
                            name="name"
                            type="text"
                            autoComplete="name"
                            required
                            minLength={2}
                            value={form.name}
                            onChange={handleChange}
                            label="Full name"
                            placeholder="Ayesha Khan"
                          />
                          <TextField
                            id="contact-email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            required
                            value={form.email}
                            onChange={handleChange}
                            label="Email address"
                            placeholder="you@example.com"
                          />
                        </div>

                        <TextField
                          id="contact-subject"
                          name="subject"
                          type="text"
                          required
                          minLength={3}
                          maxLength={120}
                          value={form.subject}
                          onChange={handleChange}
                          label="Subject"
                          placeholder="Help with a lab report"
                        />

                        <div>
                          <label
                            htmlFor="contact-message"
                            className="text-sm font-semibold text-ink"
                          >
                            Message
                          </label>
                          <textarea
                            id="contact-message"
                            name="message"
                            rows={5}
                            required
                            minLength={20}
                            maxLength={1200}
                            value={form.message}
                            onChange={handleChange}
                            placeholder="Tell us what happened, and what you have already tried."
                            className={FIELD_CLASS}
                          />
                          <p className="mt-1.5 text-xs leading-relaxed text-mist">
                            Please keep medical details out of this form — we will ask for anything
                            we need through your account.
                          </p>
                        </div>

                        <button type="submit" className={`w-full ${PRIMARY_CTA}`}>
                          Send message
                          <Send size={14} strokeWidth={2.5} />
                        </button>

                        <p className="text-xs leading-relaxed text-mist">
                          We typically reply within one business day. Urgent? Call {SUPPORT_PHONE}{' '}
                          Monday to Saturday, 9:00 – 18:00 PKT.
                        </p>
                      </form>
                    </>
                  )}
                </div>
              </RevealItem>
            </RevealGroup>
          </div>
        </section>

        <section className="bg-white py-16 md:py-24">
          <div className="page-container">
            <Reveal className="max-w-2xl">
              <p className="text-xs font-bold tracking-widest text-brand-700 uppercase">
                Quick help
              </p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-[-0.02em] text-ink md:text-4xl">
                Answers before you write
              </h2>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-body">
                The questions our support team hears most, answered the short way.
              </p>
            </Reveal>

            <Reveal delay={0.1} className="mt-12">
              <div className="divide-y divide-line rounded-2xl border border-line bg-white shadow-soft">
                {FAQS.map((faq) => {
                  const open = openFaq === faq.id

                  return (
                    <div key={faq.id}>
                      <h3>
                        <button
                          type="button"
                          id={`faq-trigger-${faq.id}`}
                          onClick={() => setOpenFaq(open ? '' : faq.id)}
                          aria-expanded={open}
                          aria-controls={`faq-panel-${faq.id}`}
                          className="flex w-full items-center justify-between gap-4 rounded-2xl px-6 py-5 text-left transition-colors hover:bg-surface focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 focus-visible:outline-none"
                        >
                          <span className="text-base font-semibold text-ink">{faq.question}</span>
                          <ChevronDown
                            size={18}
                            strokeWidth={2.5}
                            className={`shrink-0 text-brand-700 transition-transform duration-200 ${
                              open ? 'rotate-180' : ''
                            }`}
                          />
                        </button>
                      </h3>
                      {open ? (
                        <div
                          id={`faq-panel-${faq.id}`}
                          role="region"
                          aria-labelledby={`faq-trigger-${faq.id}`}
                          className="px-6 pb-6"
                        >
                          <p className="max-w-3xl text-sm leading-relaxed text-body">{faq.answer}</p>
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </Reveal>
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
                    Why teams trust Aurora
                  </p>
                  <h2 className="mt-3 text-3xl font-extrabold tracking-[-0.02em] text-white md:text-4xl">
                    Care, with real people behind it
                  </h2>
                  <p className="mt-4 max-w-xl text-base leading-relaxed text-white/70">
                    Aurora keeps appointments, records, labs, and billing in one place — and when
                    something needs a human, our team is one message away.
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
                </Reveal>

                <Reveal delay={0.1}>
                  <ul className="space-y-4">
                    {TRUST.map((point) => (
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
