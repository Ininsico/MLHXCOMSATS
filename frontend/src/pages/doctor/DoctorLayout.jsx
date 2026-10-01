import { useCallback, useEffect, useState } from 'react'
import {
  BrainCircuit,
  ClipboardPlus,
  CalendarCheck,
  CalendarDays,
  FlaskConical,
  LayoutDashboard,
  Settings,
} from 'lucide-react'
import { Outlet, useNavigate } from 'react-router-dom'
import DashboardShell from '../../components/shell/DashboardShell'
import StatusChip from '../../components/StatusChip'
import { useAuth } from '../../context/auth-context'
import { api } from '../../lib/api'

export default function DoctorLayout() {
  const { user, signout } = useAuth()
  const navigate = useNavigate()
  const [staff, setStaff] = useState(null)
  const [appointments, setAppointments] = useState([])
  const [labOrders, setLabOrders] = useState([])
  const [labTests, setLabTests] = useState([])
  const [state, setState] = useState('loading')

  const load = useCallback(async () => {
    const [me, list, orders, tests] = await Promise.all([
      api.doctor.me(),
      api.doctor.appointments(),
      api.doctor.labOrders(),
      api.doctor.labTests(),
    ])

    setStaff(me?.staff ?? null)
    setAppointments(list ?? [])
    setLabOrders(orders ?? [])
    setLabTests(tests ?? [])
  }, [])

  const refresh = useCallback(async () => {
    await load()
  }, [load])

  useEffect(() => {
    let cancelled = false

    Promise.all([
      api.doctor.me(),
      api.doctor.appointments(),
      api.doctor.labOrders(),
      api.doctor.labTests(),
    ])
      .then(([me, list, orders, tests]) => {
        if (cancelled) return
        setStaff(me?.staff ?? null)
        setAppointments(list ?? [])
        setLabOrders(orders ?? [])
        setLabTests(tests ?? [])
        setState('ready')
      })
      .catch((err) => {
        if (cancelled) return
        setState(err.status === 404 ? 'not-linked' : 'error')
      })

    return () => {
      cancelled = true
    }
  }, [])

  async function handleSignout() {
    await signout()
    navigate('/', { replace: true })
  }

  const requested = appointments.filter((item) => item.status === 'requested').length
  const awaitingReview = labOrders.filter((item) => item.status === 'completed').length

  const nav = [
    { to: '/doctor', label: 'Overview', icon: LayoutDashboard, end: true },
    {
      to: '/doctor/appointments',
      label: 'Appointments',
      icon: CalendarCheck,
      badge: requested,
    },
    { to: '/doctor/timetable', label: 'Timetable', icon: CalendarDays },
    { to: '/doctor/lab', label: 'Laboratory', icon: FlaskConical, badge: awaitingReview },
    { to: '/doctor/ai', label: 'AI Assistant', icon: BrainCircuit },
    { to: '/doctor/workspace', label: 'Notes & prescriptions', icon: ClipboardPlus },
    { to: '/doctor/settings', label: 'Settings', icon: Settings },
  ]

  return (
    <DashboardShell
      nav={nav}
      brandChip="Doctor"
      storageKey="doctor"
      userEmail={user?.email ?? ''}
      onSignout={handleSignout}
      topbarExtra={staff ? <StatusChip status={staff.status} /> : null}
    >
      {state === 'error' ? (
        <p className="mb-6 text-sm text-danger">
          Couldn't load your profile right now. Refresh to try again.
        </p>
      ) : null}

      {state === 'not-linked' ? (
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-6 shadow-soft">
          <h1 className="text-xl font-semibold text-ink">No doctor profile linked yet</h1>
          <p className="mt-2 text-sm leading-relaxed text-body">
            Your account is a doctor account, but no hospital has added you to their team yet.
            Ask your hospital administrator to register you with this email address.
          </p>
        </div>
      ) : (
        <Outlet
          context={{ staff, appointments, labOrders, labTests, state, refresh }}
        />
      )}
    </DashboardShell>
  )
}
