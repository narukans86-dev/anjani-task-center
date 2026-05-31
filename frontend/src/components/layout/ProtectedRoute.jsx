import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import AccessDenied from '../../pages/AccessDenied'

export default function ProtectedRoute({ children, permission }) {
  const { isAuthenticated, hasPermission, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-950">
        <div className="w-8 h-8 border-2 border-slate-700 border-t-teal-400 rounded-full animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />

  if (permission && !hasPermission(permission)) return <AccessDenied />

  return children
}
