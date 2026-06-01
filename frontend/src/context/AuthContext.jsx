import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  login as authLogin,
  logout as authLogout,
  getCurrentUser,
  changePassword as authChangePassword,
} from '../services/auth'
import { hasPermission as checkPermission } from '../services/permissions'

const STORAGE_KEY = 'anjani_user'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]                         = useState(null)
  const [loading, setLoading]                   = useState(true)
  const [mustChangePassword, setMustChange]     = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const stored = getCurrentUser()
    if (!stored) {
      setLoading(false)
      return
    }
    // Validate the stored token against the backend before trusting it
    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${stored.token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('session_invalid')
        return res.json()
      })
      .then(({ user: fresh }) => {
        const merged = { ...stored, ...fresh, token: stored.token }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
        setUser(merged)
        setMustChange(merged.mustChangePassword === true)
      })
      .catch(() => {
        localStorage.removeItem(STORAGE_KEY)
        setUser(null)
      })
      .finally(() => setLoading(false))
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

  const updateProfile = useCallback(async (data) => {
    const stored = getCurrentUser()
    if (!stored?.token) return { success: false, error: 'Not authenticated.' }

    try {
      const res = await fetch('/api/auth/me/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${stored.token}`,
        },
        body: JSON.stringify(data),
      })
      const responseData = await res.json()
      if (!res.ok) return { success: false, error: responseData.error || 'Failed to update profile.' }

      const updatedUser = { ...stored, ...responseData.user, token: stored.token }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUser))
      setUser(updatedUser)
      return { success: true, user: updatedUser }
    } catch {
      return { success: false, error: 'Server error. Please try again.' }
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        changePassword,
        updateProfile,
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
