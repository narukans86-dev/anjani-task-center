import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  login as authLogin,
  logout as authLogout,
  getCurrentUser,
  changePassword as authChangePassword,
} from '../services/auth'
import { hasPermission as checkPermission } from '../services/permissions'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]                         = useState(null)
  const [loading, setLoading]                   = useState(true)
  const [mustChangePassword, setMustChange]     = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const u = getCurrentUser()
    setUser(u)
    setMustChange(u?.mustChangePassword === true)
    setLoading(false)
  }, [])

  const login = useCallback(async (username, password) => {
    const result = await authLogin(username, password)
    if (result.success) {
      setUser(result.user)
      setMustChange(result.user.mustChangePassword === true)
    }
    return result
  }, [])

  const logout = useCallback(() => {
    authLogout()
    setUser(null)
    setMustChange(false)
    navigate('/login', { replace: true })
  }, [navigate])

  const changePassword = useCallback(async (oldPassword, newPassword) => {
    const result = await authChangePassword(oldPassword, newPassword)
    if (result.success) {
      setMustChange(false)
      setUser((prev) => prev ? { ...prev, mustChangePassword: false } : prev)
    }
    return result
  }, [])

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
        changePassword,
        isAuthenticated: user !== null,
        hasPermission,
        loading,
        mustChangePassword,
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
