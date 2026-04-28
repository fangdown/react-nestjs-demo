import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

export function ProtectedLayout() {
  const { loading, accessToken } = useAuth()

  if (loading) {
    return (
      <div className="shell">
        <p className="muted">载入会话…</p>
      </div>
    )
  }

  if (!accessToken) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
