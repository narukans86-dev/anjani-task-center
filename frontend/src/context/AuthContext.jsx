import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { login as authLogin, logout as authLogout, getCurrentUser } from '../services/auth'
import { hasPermission as checkPermission } from '../services/permissions'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    setUser(getCurrentUser())
    setLoading(false)
  }, [])

  const login = useCallback(async (username, password) => {
    const result = authLogin(username, password)
    if (result.success) setUser(result.user)
    return result
  }, [])

  const logout = useCallback(() => {
    authLogout()
    setUser(null)
    navigate('/login', { replace: true })
  }, [navigate])

  const hasPermission = useCallback(
    (permission) => checkPermission(user, permission),
    [user],
  )

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        isAuthenticated: user !== null,
        hasPermission,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
