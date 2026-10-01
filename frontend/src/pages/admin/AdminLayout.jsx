import { useCallback, useEffect, useState } from 'react'
import { Link, Outlet, useNavigate } from 'react-router-dom'
import {
  BrainCircuit,
  Coins,
  Building2,
  ClipboardList,
  LayoutDashboard,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react'
import DashboardShell from '../../components/shell/DashboardShell'
import { PasswordField, TextField } from '../../components/FormFields'
import { useAuth } from '../../context/auth-context'
import { api } from '../../lib/api'

const SUBMIT_CLASS =
  'h-11 w-full rounded-lg bg-brand-700 text-sm font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-60'

function AdminSignInForm() {
  const { signin, verifyOtp, signout } = useAuth()
  const [mode, setMode] = useState('password')
  const [step, setStep] = useState('email')
  const [form, setForm] = useState({ email: '', password: '', code: '' })
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function handleChange(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  function switchMode(next) {
    setMode(next)
    setStep('email')
    setNotice('')
    setError('')
  }

  async function handlePassword(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const account = await signin({ email: form.email, password: form.password })

      if (account?.role !== 'admin') {
        await signout()
        setError('This account does not have admin access.')
      }
    } catch (err) {
      setError(err.message || 'Unable to sign in.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRequest(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const data = await api.otp.request({ email: form.email })
      setNotice(
        `We emailed a ${data?.expiresInMinutes ?? 10}-minute code to ${form.email.trim()}.`,
      )
      setStep('code')
    } catch (err) {
      setError(err.message || 'We could not send the code.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleVerify(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const account = await verifyOtp({ email: form.email, code: form.code })

      if (account?.role !== 'admin') {
        await signout()
        setError('This account does not have admin access.')
      }
    } catch (err) {
      setError(err.message || 'That code could not be verified.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="inline-flex rounded-full border border-line bg-surface p-1">
        {[
          { id: 'password', label: 'Password' },
          { id: 'code', label: 'Email code' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => switchMode(tab.id)}
            aria-pressed={mode === tab.id}
            className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 ${
              mode === tab.id ? 'bg-white text-ink shadow-soft' : 'text-mist hover:text-ink'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {mode === 'password' ? (
        <form onSubmit={handlePassword} className="space-y-4">
          <TextField
            id="admin-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={handleChange}
            label="Email"
          />

          <PasswordField
            id="admin-password"
            name="password"
            autoComplete="current-password"
            required
            value={form.password}
            onChange={handleChange}
            label="Password"
          />

          {error ? <p className="text-sm font-medium text-danger">{error}</p> : null}

          <button type="submit" disabled={submitting} className={SUBMIT_CLASS}>
            {submitting ? 'Signing in…' : 'Enter console'}
          </button>

          <p className="text-xs text-mist">
            Forgot your password?{' '}
            <Link
              to="/forgot-password"
              className="font-semibold text-brand-700 transition-colors hover:text-brand-800"
            >
              Reset it with an email code
            </Link>
          </p>
        </form>
      ) : (
        <form onSubmit={step === 'email' ? handleRequest : handleVerify} className="space-y-4">
          <p className="text-sm text-mist">
            We email a one-time code to the administrator address — no password needed.
          </p>

          <TextField
            id="admin-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={handleChange}
            label="Email"
            disabled={step === 'code'}
          />

          {step === 'code' ? (
            <TextField
              id="admin-code"
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              value={form.code}
              onChange={handleChange}
              label="Six-digit code"
            />
          ) : null}

          {notice ? <p className="text-sm font-medium text-brand-700">{notice}</p> : null}
          {error ? <p className="text-sm font-medium text-danger">{error}</p> : null}

          <button type="submit" disabled={submitting} className={SUBMIT_CLASS}>
            {submitting ? 'Checking…' : step === 'email' ? 'Email me a code' : 'Enter console'}
          </button>

          {step === 'code' ? (
            <button
              type="button"
              onClick={() => {
                setStep('email')
                setNotice('')
                setError('')
                setForm((current) => ({ ...current, code: '' }))
              }}
              className="text-xs font-semibold text-mist transition-colors hover:text-ink"
            >
              Use a different email
            </button>
          ) : null}
        </form>
      )}
    </div>
  )
}

function AdminFrame({ children }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-brand-950 px-6 py-16">
      <div
        className="absolute -top-32 right-[-10%] h-96 w-96 rounded-full"
        style={{ background: 'radial-gradient(circle, rgb(74 222 128 / 0.2), transparent 65%)' }}
      />
      <div
        className="absolute -bottom-32 left-[-10%] h-96 w-96 rounded-full"
        style={{ background: 'radial-gradient(circle, rgb(134 239 172 / 0.14), transparent 65%)' }}
      />

      <div className="relative w-full max-w-md rounded-2xl bg-white p-8 shadow-lift">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-700">Aurora</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink">Admin console</h1>
        <div className="mt-6">{children}</div>
      </div>

      <p className="relative mt-6 text-xs text-white/30">
        Restricted area — authorised personnel only.
      </p>
    </div>
  )
}

export default function AdminLayout() {
  const { user, loading, signout } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState([])
  const [hospitals, setHospitals] = useState([])
  const [dataState, setDataState] = useState('idle')
  const [dataError, setDataError] = useState('')
  const [busyId, setBusyId] = useState(null)

  const isAdmin = user?.role === 'admin'

  const loadData = useCallback(async () => {
    const [statsData, usersData, hospitalsData] = await Promise.all([
      api.admin.stats(),
      api.admin.users(),
      api.admin.hospitals(),
    ])

    setStats(statsData)
    setUsers(usersData ?? [])
    setHospitals(hospitalsData ?? [])
    setDataState('ready')
  }, [])

  useEffect(() => {
    if (!isAdmin) return undefined

    let cancelled = false

    Promise.all([api.admin.stats(), api.admin.users(), api.admin.hospitals()])
      .then(([statsData, usersData, hospitalsData]) => {
        if (cancelled) return
        setStats(statsData)
        setUsers(usersData ?? [])
        setHospitals(hospitalsData ?? [])
        setDataState('ready')
      })
      .catch((err) => {
        if (cancelled) return
        setDataError(err.message || 'Unable to load admin data.')
        setDataState('error')
      })

    return () => {
      cancelled = true
    }
  }, [isAdmin])

  async function handleStatus(hospitalId, status) {
    setBusyId(hospitalId)
    setDataError('')

    try {
      await api.admin.setHospitalStatus(hospitalId, status)
      await loadData()
    } catch (err) {
      setDataError(err.message || 'That action could not be completed.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleSignout() {
    await signout()
    navigate('/', { replace: true })
  }

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-brand-950 text-sm text-white/50">
        Loading…
      </div>
    )
  }

  if (!user) {
    return (
      <AdminFrame>
        <AdminSignInForm />
      </AdminFrame>
    )
  }

  if (!isAdmin) {
    return (
      <AdminFrame>
        <p className="text-sm text-body">This account doesn't have admin access.</p>
        <button
          type="button"
          onClick={handleSignout}
          className="mt-4 text-sm font-semibold text-brand-700 transition-colors hover:text-brand-800"
        >
          Sign out
        </button>
      </AdminFrame>
    )
  }

  const nav = [
    { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
    {
      to: '/admin/applications',
      label: 'Applications',
      icon: ClipboardList,
      badge: stats?.pending ?? 0,
    },
    {
      to: '/admin/verification',
      label: 'Verification',
      icon: ShieldCheck,
      badge: stats?.verificationPending ?? 0,
    },
    { to: '/admin/hospitals', label: 'Hospitals', icon: Building2 },
    { to: '/admin/subscriptions', label: 'Themes & plans', icon: Sparkles },
    { to: '/admin/ai', label: 'AI assistant', icon: BrainCircuit },
    { to: '/admin/platform', label: 'Metering & billing', icon: Coins },
    { to: '/admin/accounts', label: 'Accounts', icon: Users },
  ]

  return (
    <DashboardShell
      nav={nav}
      brandChip="Admin"
      storageKey="admin"
      userEmail={user.email}
      onSignout={handleSignout}
    >
      {dataError ? <p className="mb-6 text-sm text-danger">{dataError}</p> : null}

      <Outlet
        context={{
          stats,
          users,
          hospitals,
          dataState,
          reload: loadData,
          busyId,
          setStatus: handleStatus,
        }}
      />
    </DashboardShell>
  )
}
