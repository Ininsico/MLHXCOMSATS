import { useNavigate } from 'react-router-dom'
import VerifyEmailCard from '../components/VerifyEmailCard'
import { useAuth } from '../context/auth-context'
import { homeFor } from '../lib/roles'

export default function VerifyEmailPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const destination = homeFor(user?.role ?? 'patient')

  return (
    <div className="grid min-h-screen place-items-center bg-white px-6 py-16">
      <div className="w-full max-w-lg">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-700">Aurora</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink">
          One quick step
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-mist">
          Confirm your email address to finish setting up your account.
        </p>

        <div className="mt-6">
          <VerifyEmailCard onVerified={() => navigate(destination, { replace: true })} />
        </div>

        <button
          type="button"
          onClick={() => navigate(destination, { replace: true })}
          className="mt-6 text-sm font-semibold text-mist transition-colors hover:text-ink"
        >
          Skip for now
        </button>
      </div>
    </div>
  )
}
