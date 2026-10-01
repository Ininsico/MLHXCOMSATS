import { useOutletContext } from 'react-router-dom'
import StatusChip from '../../components/StatusChip'

export default function AdminHospitalsPage() {
  const { hospitals, dataState, busyId, setStatus } = useOutletContext()

  if (dataState === 'idle' || dataState === 'loading') {
    return <p className="text-sm text-mist">Loading hospitals…</p>
  }

  return (
    <>
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">All hospitals</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-mist">
          Every hospital record on Aurora, whatever its status. Suspending hides the profile from
          patients and locks the portal.
        </p>
      </div>

      <div className="mt-8 overflow-x-auto rounded-2xl border border-line shadow-soft">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-surface">
            <tr>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-mist">
                Name
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-mist">
                City
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-mist">
                Contact
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-mist">
                Rating
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-mist">
                Status
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-mist">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {hospitals.map((hospital) => {
              const id = hospital.id ?? hospital._id
              const busy = busyId === id

              return (
                <tr key={id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 font-medium text-ink">{hospital.name}</td>
                  <td className="px-4 py-3 text-body">{hospital.city}</td>
                  <td className="px-4 py-3 text-body">{hospital.owner?.email ?? '—'}</td>
                  <td className="px-4 py-3 text-body">{hospital.rating?.toFixed(1)}</td>
                  <td className="px-4 py-3">
                    <StatusChip status={hospital.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {hospital.status !== 'approved' ? (
                        <button
                          type="button"
                          onClick={() => setStatus(id, 'approved')}
                          disabled={busy}
                          className="text-xs font-semibold text-brand-700 transition-colors hover:text-brand-800 disabled:opacity-60"
                        >
                          Approve
                        </button>
                      ) : null}
                      {hospital.status !== 'suspended' ? (
                        <button
                          type="button"
                          onClick={() => setStatus(id, 'suspended')}
                          disabled={busy}
                          className="text-xs font-semibold text-mist transition-colors hover:text-danger disabled:opacity-60"
                        >
                          Suspend
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
