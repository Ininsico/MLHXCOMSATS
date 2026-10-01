import { Link, useOutletContext } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import ApplicationCard from '../../components/admin/ApplicationCard'
import AreaChart from '../../components/admin/charts/AreaChart'
import BarChart from '../../components/admin/charts/BarChart'
import DonutChart from '../../components/admin/charts/DonutChart'

const SIGNUP_SERIES = [
  { key: 'patients', name: 'Patients', className: 'text-brand-700', dotClassName: 'bg-brand-700' },
  { key: 'hospitals', name: 'Hospitals', className: 'text-brand-500', dotClassName: 'bg-brand-500' },
]

function ChartCard({ title, subtitle, className = '', children }) {
  return (
    <section className={`rounded-2xl border border-line bg-white p-6 shadow-soft ${className}`}>
      <div className="mb-5">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {subtitle ? <p className="mt-1 text-xs text-mist">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  )
}

export default function AdminOverviewPage() {
  const { stats, users, hospitals, dataState, busyId, setStatus } = useOutletContext()

  if (dataState === 'idle' || dataState === 'loading') {
    return <p className="text-sm text-mist">Loading application data…</p>
  }

  if (dataState === 'error' || !stats) {
    return (
      <p className="text-sm text-danger">Couldn't load the console data. Refresh to try again.</p>
    )
  }

  const pipeline = [
    { label: 'Approved', value: stats.approved, className: 'text-brand-700', dotClassName: 'bg-brand-700' },
    { label: 'Pending', value: stats.pending, className: 'text-brand-400', dotClassName: 'bg-brand-400' },
    { label: 'Suspended', value: stats.suspended, className: 'text-danger', dotClassName: 'bg-danger' },
  ]

  const roles = [
    { label: 'Patients', value: stats.patients, barClassName: 'bg-brand-700' },
    { label: 'Hospitals', value: stats.hospitals, barClassName: 'bg-brand-400' },
    { label: 'Admins', value: stats.admins, barClassName: 'bg-brand-950' },
  ]

  const verification = [
    { label: 'Confirmed', value: stats.verified, className: 'text-brand-700', dotClassName: 'bg-brand-700' },
    { label: 'Not yet', value: stats.unverified, className: 'text-brand-300', dotClassName: 'bg-brand-300' },
  ]

  const pending = hospitals.filter((hospital) => hospital.status === 'pending')

  return (
    <>
      <div className="grid gap-6 xl:grid-cols-3">
        <ChartCard
          title="New accounts"
          subtitle="Patients and hospitals, last 14 days"
          className="xl:col-span-2"
        >
          {stats.signups?.length ? (
            <AreaChart
              data={stats.signups}
              series={SIGNUP_SERIES}
              ariaLabel="New patient and hospital accounts over the last 14 days"
            />
          ) : (
            <p className="text-sm text-mist">No signups recorded yet.</p>
          )}
        </ChartCard>

        <ChartCard title="Hospital pipeline" subtitle="Every hospital by status">
          <DonutChart
            data={pipeline}
            centerValue={stats.hospitals}
            centerLabel="Hospitals"
            ariaLabel="Hospitals by approval status"
          />
        </ChartCard>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <ChartCard
          title="Accounts by role"
          subtitle="All registered accounts"
          className="xl:col-span-2"
        >
          <BarChart data={roles} ariaLabel="Accounts by role" />
        </ChartCard>

        <ChartCard title="Email confirmation" subtitle="Accounts that confirmed their address">
          <DonutChart
            data={verification}
            centerValue={stats.users}
            centerLabel="Accounts"
            ariaLabel="Accounts confirmed versus unconfirmed"
          />
        </ChartCard>
      </div>

      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">Needs review</h2>
            <p className="mt-1 text-sm text-mist">
              Hospital applications waiting for a decision.
            </p>
          </div>
          <Link
            to="/admin/applications"
            className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 transition-colors hover:text-brand-800"
          >
            All applications
            <ArrowRight size={14} />
          </Link>
        </div>

        {pending.length ? (
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            {pending.slice(0, 2).map((hospital) => {
              const id = hospital.id ?? hospital._id

              return (
                <ApplicationCard
                  key={id}
                  hospital={hospital}
                  busy={busyId === id}
                  onDecide={setStatus}
                />
              )
            })}
          </div>
        ) : (
          <p className="mt-5 rounded-2xl border border-line bg-surface px-6 py-8 text-sm text-mist">
            No applications waiting — new hospital requests will appear here.
          </p>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-ink">Recent accounts</h2>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-line shadow-soft">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-surface">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-mist">
                  Name
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-mist">
                  Email
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-mist">
                  Role
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-mist">
                  Joined
                </th>
              </tr>
            </thead>
            <tbody>
              {users.slice(0, 5).map((account) => (
                <tr key={account.id ?? account._id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 font-medium text-ink">{account.name}</td>
                  <td className="px-4 py-3 text-body">{account.email}</td>
                  <td className="px-4 py-3 text-body">{account.role}</td>
                  <td className="px-4 py-3 text-body">
                    {new Date(account.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
