import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/auth-context'
import { homeFor } from '../lib/roles'

export default function RequireRole({ role, roles, children }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  const allowed = roles ?? (role ? [role] : [])

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-white text-sm text-mist">
        Loading your workspace…
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/signin" replace state={{ from: location.pathname }} />
  }

  if (allowed.length && !allowed.includes(user.role)) {
    return <Navigate to={homeFor(user.role)} replace />
  }

  if (user.role === 'hospital' && user.status !== 'active') {
    return <Navigate to="/hospital/pending" replace />
  }

  return children
}
