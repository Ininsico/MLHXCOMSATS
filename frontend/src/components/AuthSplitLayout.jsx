import { ArrowLeft, Quote, Star } from 'lucide-react'
import { Link } from 'react-router-dom'

const REVIEWS = [
  {
    text: 'Aurora cut our front-desk chaos in half within a week. Patients feel the calm the moment they walk in.',
    name: 'Dr. Sana Malik',
    role: 'Medical Director, Cedar Valley General Hospital',
  },
  {
    text: 'We schedule, bill, and follow up from one screen now — the paper registers are gone.',
    name: 'Imran Q.',
    role: 'Operations Lead, Northline Medical Center',
  },
  {
    text: 'Finding a good hospital for my father took two minutes instead of ten phone calls to relatives.',
    name: 'Hira A.',
    role: 'Patient, Abbottabad',
  },
]

function Stars() {
  return (
    <div className="flex items-center gap-0.5 text-brand-400">
      {[0, 1, 2, 3, 4].map((star) => (
        <Star key={star} size={13} fill="currentColor" strokeWidth={0} />
      ))}
    </div>
  )
}

export default function AuthSplitLayout({
  formSide = 'left',
  eyebrow,
  title,
  subtitle,
  children,
  footer,
}) {
  const [featured, ...others] = REVIEWS

  const form = (
    <div className="flex w-full items-center justify-center px-6 py-16 lg:w-1/2">
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-mist transition-colors hover:text-ink"
        >
          <ArrowLeft size={15} />
          Back to home
        </Link>

        {eyebrow ? (
          <p className="text-xs font-bold uppercase tracking-widest text-brand-700">{eyebrow}</p>
        ) : null}
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink">{title}</h1>
        <p className="mt-2 text-sm text-mist">{subtitle}</p>

        <div className="mt-8">{children}</div>

        {footer ? <div className="mt-6 text-sm text-mist">{footer}</div> : null}
      </div>
    </div>
  )

  const reviews = (
    <div className="relative hidden w-1/2 flex-col overflow-hidden bg-brand-950 p-12 lg:flex">
      <div
        className="absolute -right-24 -top-24 h-80 w-80 rounded-full"
        style={{ background: 'radial-gradient(circle, rgb(74 222 128 / 0.22), transparent 65%)' }}
      />
      <div
        className="absolute -bottom-32 -left-20 h-96 w-96 rounded-full"
        style={{ background: 'radial-gradient(circle, rgb(134 239 172 / 0.16), transparent 65%)' }}
      />

      <div className="relative my-auto">
        <Quote size={28} className="text-brand-400" fill="currentColor" strokeWidth={0} />
        <blockquote className="mt-5">
          <p className="text-xl font-semibold leading-relaxed text-white/90">“{featured.text}”</p>
          <footer className="mt-5 flex items-center gap-3">
            <Stars />
            <span className="text-sm text-white/55">
              {featured.name} · {featured.role}
            </span>
          </footer>
        </blockquote>

        <div className="mt-10 space-y-5 border-t border-white/10 pt-8">
          {others.map((review) => (
            <blockquote key={review.name}>
              <p className="text-sm leading-relaxed text-white/60">“{review.text}”</p>
              <footer className="mt-1.5 text-xs text-white/35">
                {review.name} · {review.role}
              </footer>
            </blockquote>
          ))}
        </div>
      </div>

      <p className="relative mt-10 text-xs text-white/35">
        Patients, appointments, records, and billing — one calm platform.
      </p>
    </div>
  )

  return (
    <div className="flex min-h-screen bg-white">
      {formSide === 'left' ? form : reviews}
      {formSide === 'left' ? reviews : form}
    </div>
  )
}
