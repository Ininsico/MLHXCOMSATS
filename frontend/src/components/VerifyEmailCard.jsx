import { useState } from 'react'
import { Check, Loader2, MailCheck } from 'lucide-react'
import { useAuth } from '../context/auth-context'

const SUBMIT_CLASS =
  'h-11 w-full rounded-lg bg-brand-700 text-sm font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-60'

const INPUT_CLASS =
  'mt-2 h-11 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none transition-colors focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30'

export default function VerifyEmailCard({ onVerified }) {
  const { user, requestEmailVerification, confirmEmailVerification } = useAuth()
  const [sent, setSent] = useState(false)
  const [code, setCode] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (user?.emailVerifiedAt) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50 px-5 py-4">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-700 text-white">
          <Check size={16} strokeWidth={3} />
        </span>
        <p className="text-sm font-medium text-brand-800">
          Your email is confirmed. Thanks for verifying.
        </p>
      </div>
    )
  }

  async function handleRequest() {
    setError('')
    setBusy(true)

    try {
      const data = await requestEmailVerification()
      setNotice(`We emailed a ${data?.expiresInMinutes ?? 10}-minute code to ${data?.sentTo ?? user?.email}.`)
      setSent(true)
    } catch (err) {
      setError(err.message || 'We could not send the code.')
    } finally {
      setBusy(false)
    }
  }

  async function handleConfirm(event) {
    event.preventDefault()
    setError('')
    setBusy(true)

    try {
      const account = await confirmEmailVerification(code)
      setNotice('')
      onVerified?.(account)
    } catch (err) {
      setError(err.message || 'That code could not be verified.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-6 shadow-soft">
      <div className="flex items-start gap-4">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
          <MailCheck size={20} />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-ink">Confirm your email address</h2>
          <p className="mt-1 text-sm leading-relaxed text-body">
            We send a six-digit code to{' '}
            <span className="font-semibold text-ink">{user?.email}</span> so we know it is really
            you. Confirming keeps password resets and sign-in codes reaching the right inbox.
          </p>
        </div>
      </div>

      {sent ? (
        <form onSubmit={handleConfirm} className="mt-5">
          <label htmlFor="verify-code" className="text-sm font-semibold text-ink">
            Six-digit code
          </label>
          <input
            id="verify-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            value={code}
            onChange={(event) => setCode(event.target.value)}
            className={INPUT_CLASS}
          />

          {notice ? <p className="mt-3 text-sm font-medium text-brand-700">{notice}</p> : null}
          {error ? <p className="mt-3 text-sm font-medium text-danger">{error}</p> : null}

          <button type="submit" disabled={busy} className={`${SUBMIT_CLASS} mt-5`}>
            {busy ? 'Confirming…' : 'Confirm email'}
          </button>

          <button
            type="button"
            onClick={handleRequest}
            disabled={busy}
            className="mt-3 text-xs font-semibold text-brand-700 transition-colors hover:text-brand-800 disabled:opacity-60"
          >
            Send a new code
          </button>
        </form>
      ) : (
        <>
          {error ? <p className="mt-4 text-sm font-medium text-danger">{error}</p> : null}

          <button
            type="button"
            onClick={handleRequest}
            disabled={busy}
            className={`${SUBMIT_CLASS} mt-5 inline-flex items-center justify-center gap-2`}
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : null}
            {busy ? 'Sending…' : 'Email me a verification code'}
          </button>
        </>
      )}
    </div>
  )
}
