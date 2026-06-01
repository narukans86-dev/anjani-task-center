import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { createAuditLog } from '../services/api'
import BrandLogo from '../components/BrandLogo'

// ── Force Change Password modal ────────────────────────────────────────────

function ForceChangePasswordModal({ onDone, onSkip, canSkip }) {
  const { changePassword } = useAuth()
  const [oldPwd,  setOldPwd]  = useState('')
  const [newPwd,  setNewPwd]  = useState('')
  const [conf,    setConf]    = useState('')
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (newPwd.length < 6)         return setError('New password must be at least 6 characters.')
    if (newPwd !== conf)           return setError('Passwords do not match.')
    if (newPwd === oldPwd)         return setError('New password must be different from the current one.')
    setLoading(true)
    const result = await changePassword(oldPwd, newPwd)
    setLoading(false)
    if (result.success) {
      onDone()
    } else {
      setError(result.error)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#D1DCF0] w-full max-w-md p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div>
            <h2 className="text-[#111827] font-bold text-base">Change Your Password</h2>
            <p className="text-slate-500 text-xs mt-0.5">You must set a new password before continuing.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Current password */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Current Password</label>
            <div className="relative">
              <input type={showOld ? 'text' : 'password'} value={oldPwd} onChange={e => setOldPwd(e.target.value)}
                required placeholder="Enter current password"
                className="w-full border border-[#D1DCF0] rounded-xl px-4 py-2.5 pr-10 text-sm text-[#111827] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0A3D91]/20 focus:border-[#0A3D91]" />
              <button type="button" onClick={() => setShowOld(v => !v)}
                className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600">
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                  {showOld
                    ? <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    : <><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></>}
                </svg>
              </button>
            </div>
          </div>
          {/* New password */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">New Password</label>
            <div className="relative">
              <input type={showNew ? 'text' : 'password'} value={newPwd} onChange={e => setNewPwd(e.target.value)}
                required minLength={6} placeholder="At least 6 characters"
                className="w-full border border-[#D1DCF0] rounded-xl px-4 py-2.5 pr-10 text-sm text-[#111827] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0A3D91]/20 focus:border-[#0A3D91]" />
              <button type="button" onClick={() => setShowNew(v => !v)}
                className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600">
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                  {showNew
                    ? <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    : <><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></>}
                </svg>
              </button>
            </div>
          </div>
          {/* Confirm */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Confirm New Password</label>
            <input type="password" value={conf} onChange={e => setConf(e.target.value)}
              required placeholder="Repeat new password"
              className="w-full border border-[#D1DCF0] rounded-xl px-4 py-2.5 text-sm text-[#111827] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0A3D91]/20 focus:border-[#0A3D91]" />
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-600 text-xs">
              <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01"/></svg>
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={loading}
              className="flex-1 bg-[#0A3D91] hover:bg-[#0057D9] disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition-all">
              {loading ? 'Saving…' : 'Set New Password'}
            </button>
            {canSkip && (
              <button type="button" onClick={onSkip}
                className="px-4 py-2.5 rounded-xl border border-[#D1DCF0] text-slate-600 text-sm hover:bg-slate-50 transition-all">
                Skip
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Login() {
  const { login, isAuthenticated, mustChangePassword, user } = useAuth()
  const navigate = useNavigate()

  const [username,       setUsername]       = useState('')
  const [password,       setPassword]       = useState('')
  const [showPwd,        setShowPwd]        = useState(false)
  const [error,          setError]          = useState('')
  const [loading,        setLoading]        = useState(false)
  const [showChangePwd,  setShowChangePwd]  = useState(false)

  useEffect(() => {
    if (isAuthenticated && !mustChangePassword) navigate('/dashboard', { replace: true })
    if (isAuthenticated && mustChangePassword)  setShowChangePwd(true)
  }, [isAuthenticated, mustChangePassword, navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await login(username.trim(), password)
    setLoading(false)
    if (result.success) {
      // audit log is written by the backend; navigate is handled by the useEffect above
      if (!result.user.mustChangePassword) {
        navigate('/dashboard', { replace: true })
      } else {
        setShowChangePwd(true)
      }
    } else {
      setError(result.error)
    }
  }

  return (
    <>
    {showChangePwd && (
      <ForceChangePasswordModal
        canSkip={user?.role === 'admin'}
        onDone={() => { setShowChangePwd(false); navigate('/dashboard', { replace: true }) }}
        onSkip={() => { setShowChangePwd(false); navigate('/dashboard', { replace: true }) }}
      />
    )}
    <div className="min-h-screen bg-premium-login flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white/95 backdrop-blur rounded-2xl p-8 shadow-xl border border-[#D1DCF0]">

          {/* Brand */}
          <div className="flex flex-col items-center mb-8">
            <div className="mb-4 rounded-2xl bg-white px-5 py-3 shadow-sm border border-blue-100">
              <BrandLogo className="h-14 max-w-[260px]" fallbackClassName="text-xl" />
            </div>
            <h1 className="text-[#111827] text-xl font-bold tracking-tight">
              Daily Operations Command Center
            </h1>
            <p className="text-slate-500 text-sm mt-1">Sign in to continue</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div>
              <label className="block text-slate-600 text-xs font-semibold mb-1.5 tracking-wide uppercase">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                autoComplete="username"
                required
                className="w-full bg-white border border-[#D1DCF0] rounded-xl px-4 py-3 text-[#111827] text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0A3D91]/20 focus:border-[#0A3D91] transition-all"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-slate-600 text-xs font-semibold mb-1.5 tracking-wide uppercase">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                  className="w-full bg-white border border-[#D1DCF0] rounded-xl px-4 py-3 pr-11 text-[#111827] text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0A3D91]/20 focus:border-[#0A3D91] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                  tabIndex={-1}
                >
                  {showPwd ? (
                    <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
                <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01" />
                </svg>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0A3D91] hover:bg-[#0057D9] disabled:bg-[#0A3D91]/50 text-white font-semibold py-3 rounded-xl transition-all duration-150 flex items-center justify-center gap-2 mt-2 shadow-sm"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in…
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Hint */}
          <p className="text-slate-400 text-[11px] text-center mt-6">
            Local authentication · Anjani Medical Internal System
          </p>
        </div>
      </div>
    </div>
    </>
  )
}
