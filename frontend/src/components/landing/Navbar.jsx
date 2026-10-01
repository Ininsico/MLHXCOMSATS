import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { useAuth } from '../../context/auth-context'
import { homeFor } from '../../lib/roles'

const SECTIONS = [
  { to: '/features', label: 'Features' },
  { to: '/how-it-works', label: 'How it works' },
  { to: '/for-hospitals', label: 'For hospitals' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
]

const NAV_ITEM_CLASS = 'text-sm font-semibold text-body transition-colors hover:text-ink'

const MOBILE_ITEM_CLASS =
  'rounded-lg px-3 py-3 text-sm font-semibold text-body transition-colors hover:bg-surface hover:text-ink'

const CTA_CLASS =
  'btn-shine inline-flex items-center justify-center rounded-full bg-brand-700 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-brand-900/20 transition duration-300 hover:-translate-y-0.5 hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2'

const PORTAL_CLASS =
  'inline-flex items-center justify-center rounded-full border border-line px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-body transition duration-300 hover:-translate-y-0.5 hover:border-brand-300 hover:bg-brand-50 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2'

export default function Navbar() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return undefined

    const handleKey = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open])

  const close = () => setOpen(false)

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-line bg-white/70 backdrop-blur-xl">
      <div className="page-container flex h-20 items-center xl:gap-12">
        <div className="flex flex-1 items-center">
          <Link to="/" aria-label="Aurora home" className="flex items-center">
            <img src="/Aurora.png" alt="Aurora" className="h-9 w-auto" />
          </Link>
        </div>

        <nav className="hidden items-center gap-7 lg:flex xl:gap-8">
          {SECTIONS.map((section) => (
            <Link key={section.to} to={section.to} className={NAV_ITEM_CLASS}>
              {section.label}
            </Link>
          ))}
        </nav>

        <div className="flex flex-1 items-center justify-end gap-4 xl:gap-6">
          {user?.role === 'hospital' ? (
            <Link to={homeFor(user.role)} className={`${PORTAL_CLASS} hidden sm:inline-flex`}>
              Hospital portal
            </Link>
          ) : (
            <Link to="/explore" className={PORTAL_CLASS}>
              Explore
            </Link>
          )}

          {user ? (
            <Link to={homeFor(user.role)} className={CTA_CLASS}>
              Open Aurora
            </Link>
          ) : (
            <>
              <Link
                to="/signin"
                className="hidden text-sm font-semibold text-body transition-colors hover:text-ink sm:block"
              >
                Sign in
              </Link>
              <Link to="/signup" className={CTA_CLASS}>
                Get started
              </Link>
            </>
          )}

          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="landing-mobile-menu"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-line text-body transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 lg:hidden"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {open ? (
        <div
          id="landing-mobile-menu"
          className="border-t border-line bg-white/95 backdrop-blur-xl lg:hidden"
        >
          <nav className="page-container flex flex-col py-3">
            {SECTIONS.map((section) => (
              <Link key={section.to} to={section.to} onClick={close} className={MOBILE_ITEM_CLASS}>
                {section.label}
              </Link>
            ))}

            <Link
              to={user?.role === 'hospital' ? homeFor(user.role) : '/explore'}
              onClick={close}
              className={MOBILE_ITEM_CLASS}
            >
              {user?.role === 'hospital' ? 'Hospital portal' : 'Explore'}
            </Link>

            {user ? null : (
              <Link to="/signin" onClick={close} className={MOBILE_ITEM_CLASS}>
                Sign in
              </Link>
            )}
          </nav>
        </div>
      ) : null}
    </header>
  )
}
