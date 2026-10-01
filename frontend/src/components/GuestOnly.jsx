import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/auth-context'
import { homeFor } from '../lib/roles'

export default function GuestOnly({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-white text-sm text-mist">
        Loading…
      </div>
    )
  }

  if (user) {
    return <Navigate to={homeFor(user.role)} replace />
  }

  return children
}
