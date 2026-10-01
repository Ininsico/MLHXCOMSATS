import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Clock, Loader2, ShieldAlert } from 'lucide-react'
import { useAuth } from '../context/auth-context'
import VerifyEmailCard from '../components/VerifyEmailCard'
import { api } from '../lib/api'
import { homeFor } from '../lib/roles'

const STEPS = ['Submitted', 'Under review', 'Approved']

function StatusIcon({ status }) {
  if (status === 'suspended') {
    return (
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-danger-bg text-danger">
        <ShieldAlert size={22} />
      </span>
    )
  }

  return (
    <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700">
      <Clock size={22} />
    </span>
  )
}

function Timeline({ status }) {
  const activeIndex = status === 'pending' ? 1 : 0

  return (
    <ol className="mt-8 space-y-4">
      {STEPS.map((step, index) => {
        const done = index < activeIndex
        const active = index === activeIndex && status !== 'suspended'

        return (
          <li key={step} className="flex items-center gap-3">
            <span
              className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
                done
                  ? 'border-brand-200 bg-brand-50 text-brand-700'
                  : active
                    ? 'border-brand-700 bg-brand-700 text-white'
                    : 'border-line bg-white text-mist'
              }`}
            >
              {done ? <Check size={13} strokeWidth={3} /> : index + 1}
            </span>
            <span
              className={`text-sm font-semibold ${
                active ? 'text-ink' : done ? 'text-body' : 'text-mist'
              }`}
            >
              {step}
            </span>
            {active ? (
              <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium text-brand-700">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-600" />
                In progress
              </span>
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}

export default function HospitalPendingPage() {
  const { user, loading, refresh, signout } = useAuth()
  const navigate = useNavigate()
  const [hospital, setHospital] = useState(null)
  const [checking, setChecking] = useState(false)
  const [note, setNote] = useState('')

  useEffect(() => {
    if (loading) return

    if (!user) {
      navigate('/signin', { replace: true })
      return
    }
    if (user.role !== 'hospital') {
      navigate(homeFor(user.role), { replace: true })
      return
    }
    if (user.status === 'active') {
      navigate('/hospital', { replace: true })
    }
  }, [loading, user, navigate])

  useEffect(() => {
    let cancelled = false

    api.hospitals
      .mine()
      .then((data) => {
        if (!cancelled) setHospital(data?.hospital ?? null)
      })
      .catch(() => {
        if (!cancelled) setHospital(null)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (user?.status !== 'pending') return undefined

    const timer = setInterval(() => {
      refresh().catch(() => {})
    }, 20000)

    return () => clearInterval(timer)
  }, [user?.status, refresh])

  const handleCheck = useCallback(async () => {
    setChecking(true)
    setNote('')

    try {
      const account = await refresh()

      if (account?.role === 'hospital' && account.status === 'active') {
        navigate('/hospital', { replace: true })
        return
      }
      setNote('Still under review — we will email you the moment a decision is made.')
    } catch {
      setNote('We could not check right now. Try again in a moment.')
    } finally {
      setChecking(false)
    }
  }, [refresh, navigate])

  async function handleSignout() {
    await signout()
    navigate('/', { replace: true })
  }

  if (loading || !user || user.role !== 'hospital') {
    return (
      <div className="grid min-h-screen place-items-center bg-white text-sm text-mist">
        Loading your application…
      </div>
    )
  }

  const suspended = user.status === 'suspended'

  return (
    <div className="grid min-h-screen place-items-center bg-white px-6 py-16">
      <div className="w-full max-w-lg rounded-2xl border border-line bg-white p-8 shadow-soft">
        <StatusIcon status={user.status} />

        <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-ink">
          {suspended ? 'Your application was not approved' : 'Your application is being processed'}
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-body">
          {suspended
            ? 'After review, we could not approve this hospital for Aurora. Reply to the email we sent you if you believe this is a mistake or your details have changed.'
            : `Thanks for registering${hospital?.name ? ` ${hospital.name}` : ' your hospital'}. Our team reviews every hospital before it appears in search, so patients only find verified care.`}
        </p>

        {suspended ? null : (
          <>
            <Timeline status={user.status} />
            <p className="mt-6 rounded-lg border border-line bg-surface px-4 py-3 text-xs leading-relaxed text-body">
              You will get an email at{' '}
              <span className="font-semibold text-ink">{user.email}</span> as soon as your
              application is approved. You can also check back here any time.
            </p>
          </>
        )}

        {user.emailVerifiedAt ? null : (
          <div className="mt-6">
            <VerifyEmailCard />
          </div>
        )}

        {note ? <p className="mt-4 text-sm font-medium text-brand-700">{note}</p> : null}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          {suspended ? null : (
            <button
              type="button"
              onClick={handleCheck}
              disabled={checking}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand-700 px-6 text-sm font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-60"
            >
              {checking ? <Loader2 size={15} className="animate-spin" /> : null}
              {checking ? 'Checking…' : 'Check status'}
            </button>
          )}

          <button
            type="button"
            onClick={handleSignout}
            className="inline-flex h-11 items-center justify-center rounded-lg border border-line px-6 text-sm font-semibold text-body transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
