import { Link } from 'react-router-dom'

const ROUTES = [
  { to: '/features', label: 'Features' },
  { to: '/how-it-works', label: 'How it works' },
  { to: '/for-hospitals', label: 'For hospitals' },
  { to: '/explore', label: 'Explore' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
  { to: '/signin', label: 'Sign in' },
  { to: '/hospital/apply', label: 'Register your hospital' },
  { to: '/hospital/signin', label: 'Hospital portal' },
  { to: '/admin', label: 'Admin console' },
]

export default function Footer() {
  return (
    <footer className="border-t border-line bg-white">
      <div className="page-container flex flex-col gap-8 py-12 md:flex-row md:items-center md:justify-between">
        <div>
          <img src="/Aurora.png" alt="Aurora" className="h-9 w-auto" />
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-mist">
            Appointments, patient records, prescriptions, and billing in one calm platform.
          </p>
        </div>

        <nav className="flex flex-wrap gap-x-8 gap-y-3">
          {ROUTES.map((route) => (
            <Link
              key={route.to}
              to={route.to}
              className="text-sm font-semibold text-body transition-colors hover:text-ink"
            >
              {route.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="border-t border-line">
        <div className="page-container flex flex-col gap-2 py-6 text-xs text-mist sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} Aurora. Built for the MLH × COMSATS Islamabad hackathon.</span>
          <span>Demo environment — sample data only.</span>
        </div>
      </div>
    </footer>
  )
}
