import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import AccessDenied from '../../pages/AccessDenied'

export default function ProtectedRoute({ children, permission }) {
  const { isAuthenticated, hasPermission, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#F0F4FF]">
        <div className="w-8 h-8 border-2 border-[#0A3D91]/20 border-t-[#0A3D91] rounded-full animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />

  if (permission && !hasPermission(permission)) return <AccessDenied />

  return children
}
