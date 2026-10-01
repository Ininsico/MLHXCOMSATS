import { useOutletContext } from 'react-router-dom'
import ApplicationCard from '../../components/admin/ApplicationCard'
import StatusChip from '../../components/StatusChip'

export default function AdminApplicationsPage() {
  const { hospitals, dataState, busyId, setStatus } = useOutletContext()

  if (dataState === 'idle' || dataState === 'loading') {
    return <p className="text-sm text-mist">Loading applications…</p>
  }

  const pending = hospitals.filter((hospital) => hospital.status === 'pending')
  const decided = hospitals
    .filter((hospital) => hospital.status !== 'pending')
    .sort((a, b) => new Date(b.updatedAt ?? 0) - new Date(a.updatedAt ?? 0))
    .slice(0, 8)

  return (
    <>
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Hospital applications</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-mist">
          Approve a hospital to make its profile public and unlock its portal. Rejecting keeps
          the account locked on the processing screen.
        </p>
      </div>

      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-ink">Waiting for review</h2>
          <span className="rounded-full bg-surface px-3 py-1 text-xs font-semibold text-body">
            {pending.length} pending
          </span>
        </div>

        {pending.length ? (
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            {pending.map((hospital) => {
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
            Nothing waiting — new hospital requests will appear here.
          </p>
        )}
      </section>

      {decided.length ? (
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-ink">Recently decided</h2>
          <ul className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line shadow-soft">
            {decided.map((hospital) => (
              <li
                key={hospital.id ?? hospital._id}
                className="flex flex-wrap items-center justify-between gap-3 bg-white px-5 py-4"
              >
                <div>
                  <p className="text-sm font-semibold text-ink">{hospital.name}</p>
                  <p className="text-xs text-mist">
                    {hospital.area} · {hospital.city}
                    {hospital.owner?.email ? ` · ${hospital.owner.email}` : ''}
                  </p>
                </div>
                <StatusChip status={hospital.status} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  )
}
