import { useOutletContext } from 'react-router-dom'
import StatusChip from '../../components/StatusChip'

export default function AdminAccountsPage() {
  const { users, dataState } = useOutletContext()

  if (dataState === 'idle' || dataState === 'loading') {
    return <p className="text-sm text-mist">Loading accounts…</p>
  }

  return (
    <>
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Accounts</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-mist">
          The twenty most recent accounts, patients and hospitals together.
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
                Email
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-mist">
                Role
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-mist">
                Status
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-mist">
                Email confirmed
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-mist">
                Joined
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((account) => (
              <tr key={account.id ?? account._id} className="border-b border-line last:border-0">
                <td className="px-4 py-3 font-medium text-ink">{account.name}</td>
                <td className="px-4 py-3 text-body">{account.email}</td>
                <td className="px-4 py-3 text-body">{account.role}</td>
                <td className="px-4 py-3">
                  <StatusChip status={account.status} />
                </td>
                <td className="px-4 py-3 text-body">
                  {account.emailVerifiedAt ? 'Yes' : 'Not yet'}
                </td>
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
    </>
  )
}
