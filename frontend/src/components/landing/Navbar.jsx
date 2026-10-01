import { Link } from 'react-router-dom'
import { useAuth } from '../../context/auth-context'
import { homeFor } from '../../lib/roles'

const SECTIONS = [
  { href: '/#features', label: 'Features' },
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/#for-hospitals', label: 'For hospitals' },
]

const CTA_CLASS =
  'btn-shine inline-flex items-center justify-center rounded-full bg-brand-700 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-brand-900/20 transition duration-300 hover:-translate-y-0.5 hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2'

const PORTAL_CLASS =
  'inline-flex items-center justify-center rounded-full border border-line px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-body transition duration-300 hover:-translate-y-0.5 hover:border-brand-300 hover:bg-brand-50 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2'

export default function Navbar() {
  const { user } = useAuth()

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-line bg-white/70 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-6">
        <Link to="/" aria-label="Aurora home" className="flex items-center">
          <img src="/Aurora.png" alt="Aurora" className="h-9 w-auto" />
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {SECTIONS.map((section) => (
            <a
              key={section.href}
              href={section.href}
              className="text-sm font-semibold text-body transition-colors hover:text-ink"
            >
              {section.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-4">
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
        </div>
      </div>
    </header>
  )
}
