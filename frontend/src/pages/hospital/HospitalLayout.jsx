import { useCallback, useEffect, useState } from 'react'
import {
  Activity,
  Ambulance,
  Boxes,
  Building2,
  CalendarCheck,
  FlaskConical,
  LayoutDashboard,
  Palette,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Store,
  Stethoscope,
  Users,
} from 'lucide-react'
import { Outlet, useNavigate } from 'react-router-dom'
import DashboardShell from '../../components/shell/DashboardShell'
import StatusChip from '../../components/StatusChip'
import { useAuth } from '../../context/auth-context'
import { api } from '../../lib/api'

export default function HospitalLayout() {
  const { user, signout } = useAuth()
  const navigate = useNavigate()

  const [hospital, setHospital] = useState(null)
  const [appointments, setAppointments] = useState([])
  const [inventory, setInventory] = useState([])
  const [labOrders, setLabOrders] = useState([])
  const [labTests, setLabTests] = useState([])
  const [staff, setStaff] = useState([])
  const [state, setState] = useState('loading')

  const load = useCallback(async () => {
    const [hospitalData, appointmentsData, inventoryData, ordersData, testsData, staffData] =
      await Promise.all([
        api.hospitals.mine(),
        api.appointments.list(),
        api.inventory.list(),
        api.lab.orders(),
        api.lab.tests(),
        api.staff.list(),
      ])

    setHospital(hospitalData?.hospital ?? null)
    setAppointments(appointmentsData ?? [])
    setInventory(inventoryData ?? [])
    setLabOrders(ordersData ?? [])
    setLabTests(testsData ?? [])
    setStaff(staffData ?? [])
    setState('ready')
  }, [])

  useEffect(() => {
    let cancelled = false

    Promise.all([
      api.hospitals.mine(),
      api.appointments.list(),
      api.inventory.list(),
      api.lab.orders(),
      api.lab.tests(),
      api.staff.list(),
    ])
      .then(([hospitalData, appointmentsData, inventoryData, ordersData, testsData, staffData]) => {
        if (cancelled) return
        setHospital(hospitalData?.hospital ?? null)
        setAppointments(appointmentsData ?? [])
        setInventory(inventoryData ?? [])
        setLabOrders(ordersData ?? [])
        setLabTests(testsData ?? [])
        setStaff(staffData ?? [])
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

  async function handleSave(patch) {
    const data = await api.hospitals.updateMine(patch)
    setHospital(data?.hospital ?? null)
    return data?.hospital ?? null
  }

  async function handleSignout() {
    await signout()
    navigate('/', { replace: true })
  }

  const requested = appointments.filter((item) => item.status === 'requested').length
  const lowStock = inventory.filter((item) => item.quantity <= item.reorderLevel).length
  const openLabs = labOrders.filter((item) =>
    ['requested', 'collected', 'processing'].includes(item.status),
  ).length
  const verification = hospital?.verification?.status

  const nav = [
    { to: '/hospital', label: 'Overview', icon: LayoutDashboard, end: true },
    {
      label: 'Clinical',
      icon: Stethoscope,
      items: [
        { to: '/hospital/appointments', label: 'Appointments', icon: CalendarCheck, badge: requested },
        { to: '/hospital/doctors', label: 'Doctors & staff', icon: Users },
        { to: '/hospital/lab', label: 'Laboratory', icon: FlaskConical, badge: openLabs },
      ],
    },
    {
      label: 'Operations',
      icon: Boxes,
      items: [
        { to: '/hospital/inventory', label: 'Inventory', icon: Boxes, badge: lowStock },
        { to: '/hospital/marketplace', label: 'Marketplace', icon: ShoppingBag },
        { to: '/hospital/fleet', label: 'Ambulance & SOS', icon: Ambulance },
        { to: '/hospital/operations', label: 'Analytics & ward', icon: Activity },
        {
          to: '/hospital/verification',
          label: 'Verification',
          icon: ShieldCheck,
          badge: verification === 'rejected' ? 1 : 0,
        },
      ],
    },
    {
      label: 'Listing',
      icon: Store,
      items: [
        { to: '/hospital/profile', label: 'Profile', icon: Building2 },
        { to: '/hospital/public-page', label: 'Page & plan', icon: Palette },
      ],
    },
    { to: '/hospital/settings', label: 'Settings', icon: Settings },
  ]

  return (
    <DashboardShell
      nav={nav}
      brandChip="Hospital"
      storageKey="hospital"
      userEmail={user?.email ?? ''}
      onSignout={handleSignout}
      topbarExtra={hospital ? <StatusChip status={hospital.status} /> : null}
    >
      {state === 'error' ? (
        <p className="mb-6 text-sm text-danger">
          Couldn't load your hospital right now. Refresh to try again.
        </p>
      ) : null}

      {state === 'not-linked' ? (
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-6 shadow-soft">
          <h1 className="text-xl font-semibold text-ink">No hospital linked yet</h1>
          <p className="mt-2 text-sm leading-relaxed text-body">
            This account isn't linked to a hospital record. Contact the Aurora administrator to
            get set up.
          </p>
        </div>
      ) : (
        <Outlet
          context={{
            hospital,
            appointments,
            inventory,
            labOrders,
            labTests,
            staff,
            state,
            reload: load,
            save: handleSave,
          }}
        />
      )}
    </DashboardShell>
  )
}
