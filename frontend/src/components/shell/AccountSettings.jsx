import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'
import { PasswordField } from '../FormFields'
import { useAuth } from '../../context/auth-context'

const FIELD_CLASS =
  'mt-2 h-11 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none transition-colors focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30'

const SUBMIT_CLASS =
  'inline-flex h-11 items-center justify-center rounded-lg bg-brand-700 px-6 text-sm font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-60'

export default function AccountSettings({ eyebrow, title, subtitle }) {
  const { user, updateProfile, changePassword } = useAuth()

  const [name, setName] = useState(user?.name ?? '')
  const [profileState, setProfileState] = useState('idle')
  const [profileError, setProfileError] = useState('')

  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' })
  const [passwordState, setPasswordState] = useState('idle')
  const [passwordError, setPasswordError] = useState('')

  async function handleProfile(event) {
    event.preventDefault()
    setProfileError('')
    setProfileState('saving')

    try {
      await updateProfile({ name })
      setProfileState('saved')
    } catch (err) {
      setProfileError(err.message || 'Your profile could not be saved.')
      setProfileState('error')
    }
  }

  async function handlePassword(event) {
    event.preventDefault()
    setPasswordError('')
    setPasswordState('saving')

    try {
      await changePassword(passwords)
      setPasswords({ currentPassword: '', newPassword: '' })
      setPasswordState('saved')
    } catch (err) {
      setPasswordError(err.message || 'Your password could not be changed.')
      setPasswordState('error')
    }
  }

  return (
    <>
      <header>
        {eyebrow ? (
          <p className="text-xs font-bold uppercase tracking-widest text-brand-700">{eyebrow}</p>
        ) : null}
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink">{title}</h1>
        {subtitle ? (
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-mist">{subtitle}</p>
        ) : null}
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-white p-6 shadow-soft">
          <h2 className="text-lg font-semibold text-ink">Profile</h2>
          <p className="mt-1 text-sm text-mist">Your name appears on your account.</p>

          <form onSubmit={handleProfile} className="mt-5 space-y-5">
            <div>
              <label htmlFor="name" className="text-sm font-semibold text-ink">
                Full name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                minLength={2}
                maxLength={80}
                value={name}
                onChange={(event) => {
                  setName(event.target.value)
                  setProfileState('idle')
                }}
                className={FIELD_CLASS}
              />
            </div>

            <div>
              <span className="text-sm font-semibold text-ink">Email</span>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <span className="text-sm text-body">{user?.email}</span>
                {user?.emailVerifiedAt ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-800">
                    <Check size={12} strokeWidth={3} />
                    Confirmed
                  </span>
                ) : (
                  <Link
                    to="/verify-email"
                    className="text-xs font-semibold text-brand-700 transition-colors hover:text-brand-800"
                  >
                    Confirm this address
                  </Link>
                )}
              </div>
            </div>

            {profileError ? (
              <p className="text-sm font-medium text-danger">{profileError}</p>
            ) : null}

            <div className="flex items-center gap-4">
              <button type="submit" disabled={profileState === 'saving'} className={SUBMIT_CLASS}>
                {profileState === 'saving' ? 'Saving…' : 'Save changes'}
              </button>
              {profileState === 'saved' ? (
                <span className="text-sm font-medium text-brand-700">Saved.</span>
              ) : null}
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-line bg-white p-6 shadow-soft">
          <h2 className="text-lg font-semibold text-ink">Password</h2>
          <p className="mt-1 text-sm text-mist">
            You can always sign in with an emailed code instead.
          </p>

          <form onSubmit={handlePassword} className="mt-5 space-y-5">
            <PasswordField
              id="currentPassword"
              name="currentPassword"
              label="Current password"
              autoComplete="current-password"
              value={passwords.currentPassword}
              onChange={(event) => {
                setPasswords((current) => ({ ...current, currentPassword: event.target.value }))
                setPasswordState('idle')
              }}
            />

            <PasswordField
              id="newPassword"
              name="newPassword"
              label="New password"
              hint="At least 8 characters."
              autoComplete="new-password"
              required
              minLength={8}
              value={passwords.newPassword}
              onChange={(event) => {
                setPasswords((current) => ({ ...current, newPassword: event.target.value }))
                setPasswordState('idle')
              }}
            />

            {passwordError ? (
              <p className="text-sm font-medium text-danger">{passwordError}</p>
            ) : null}

            <div className="flex items-center gap-4">
              <button type="submit" disabled={passwordState === 'saving'} className={SUBMIT_CLASS}>
                {passwordState === 'saving' ? 'Updating…' : 'Change password'}
              </button>
              {passwordState === 'saved' ? (
                <span className="text-sm font-medium text-brand-700">Password updated.</span>
              ) : null}
            </div>
          </form>
        </section>
      </div>
    </>
  )
}
