import { Link, Outlet, useNavigate } from 'react-router-dom'
import {
  Activity,
  Brain,
  Building2,
  CalendarCheck,
  ClipboardList,
  FlaskConical,
  HeartHandshake,
  HeartPulse,
  LayoutDashboard,
  Settings,
  Siren,
  Syringe,
  Wallet,
} from 'lucide-react'
import DashboardShell from '../../components/shell/DashboardShell'
import { useAuth } from '../../context/auth-context'

const NAV = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/explore', label: 'Hospitals', icon: Building2 },
  { to: '/dashboard/appointments', label: 'Appointments', icon: CalendarCheck },
  { to: '/dashboard/lab', label: 'Lab results', icon: FlaskConical },
  { to: '/dashboard/vitals', label: 'Vitals', icon: Activity },
  { to: '/dashboard/emergency', label: 'Emergency SOS', icon: Siren },
  { to: '/dashboard/medical-card', label: 'Medical card', icon: HeartPulse },
  { to: '/dashboard/care-plans', label: 'Care plans', icon: ClipboardList },
  { to: '/dashboard/vaccinations', label: 'Vaccinations', icon: Syringe },
  { to: '/dashboard/pay', label: 'Pay with Binance', icon: Wallet },
  {
    label: 'Aurora AI',
    icon: Brain,
    items: [
      { to: '/dashboard/ai-doctors', label: 'AI doctors', icon: Brain },
      { to: '/dashboard/therapy', label: 'Therapy', icon: HeartHandshake },
    ],
  },
  { to: '/dashboard/settings', label: 'Settings', icon: Settings },
]

export default function PatientLayout() {
  const { user, signout } = useAuth()
  const navigate = useNavigate()

  async function handleSignout() {
    await signout()
    navigate('/', { replace: true })
  }

  return (
    <DashboardShell
      nav={NAV}
      brandChip="Patient"
      storageKey="patient"
      userEmail={user?.email ?? ''}
      onSignout={handleSignout}
      topbarExtra={
        user && !user.emailVerifiedAt ? (
          <Link
            to="/verify-email"
            className="hidden items-center rounded-full border border-brand-200 bg-brand-50 px-4 py-2 text-xs font-bold uppercase tracking-widest text-brand-700 transition-colors hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 sm:inline-flex"
          >
            Verify email
          </Link>
        ) : null
      }
    >
      <Outlet />
    </DashboardShell>
  )
}
