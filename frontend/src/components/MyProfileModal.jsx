'use strict'
import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

const NOTIF_PREFS = ['App', 'WhatsApp', 'Email', 'SMS', 'None']

function inputCls(extra = '') {
  return `w-full bg-white border border-[#D1DCF0] rounded-xl px-4 py-2.5 text-sm text-[#111827] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0A3D91]/20 focus:border-[#0A3D91] transition-all ${extra}`
}

function Label({ children }) {
  return (
    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
      {children}
    </label>
  )
}

function ErrorBox({ message }) {
  if (!message) return null
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-600 text-xs">
      <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01" />
      </svg>
      {message}
    </div>
  )
}

function SuccessBox({ message }) {
  if (!message) return null
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs">
      <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
      {message}
    </div>
  )
}

export default function MyProfileModal({ onClose }) {
  const { user, updateProfile, changePassword } = useAuth()

  // Profile fields
  const [displayName,         setDisplayName]         = useState(user?.display_name || user?.name || '')
  const [mobile,              setMobile]              = useState(user?.mobile_number || '')
  const [whatsapp,            setWhatsapp]            = useState(user?.whatsapp_number || '')
  const [email,               setEmail]               = useState(user?.email || '')
  const [notifPref,           setNotifPref]           = useState(user?.notification_preference || 'App')
  const [profileSaving,       setProfileSaving]       = useState(false)
  const [profileError,        setProfileError]        = useState('')
  const [profileSuccess,      setProfileSuccess]      = useState('')

  // Password fields
  const [oldPwd,     setOldPwd]     = useState('')
  const [newPwd,     setNewPwd]     = useState('')
  const [confPwd,    setConfPwd]    = useState('')
  const [showOld,    setShowOld]    = useState(false)
  const [showNew,    setShowNew]    = useState(false)
  const [pwdSaving,  setPwdSaving]  = useState(false)
  const [pwdError,   setPwdError]   = useState('')
  const [pwdSuccess, setPwdSuccess] = useState('')

  // Sync if user prop changes
  useEffect(() => {
    if (user) {
      setDisplayName(user.display_name || user.name || '')
      setMobile(user.mobile_number || '')
      setWhatsapp(user.whatsapp_number || '')
      setEmail(user.email || '')
      setNotifPref(user.notification_preference || 'App')
    }
  }, [user])

  async function handleProfileSave(e) {
    e.preventDefault()
    setProfileError('')
    setProfileSuccess('')
    if (!displayName.trim()) return setProfileError('Display name is required.')
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return setProfileError('Please enter a valid email address.')
    }
    if (mobile.trim() && !/^[6-9]\d{9}$/.test(mobile.replace(/\s/g, ''))) {
      return setProfileError('Mobile number must be a valid 10-digit Indian number.')
    }
    setProfileSaving(true)
    const result = await updateProfile({
      display_name: displayName.trim(),
      mobile_number: mobile.trim() || null,
      whatsapp_number: whatsapp.trim() || null,
      email: email.trim() || null,
      notification_preference: notifPref,
    })
    setProfileSaving(false)
    if (result.success) {
      setProfileSuccess('Profile updated successfully.')
    } else {
      setProfileError(result.error || 'Failed to update profile.')
    }
  }

  async function handlePasswordSave(e) {
    e.preventDefault()
    setPwdError('')
    setPwdSuccess('')
    if (!oldPwd) return setPwdError('Current password is required.')
    if (newPwd.length < 8) return setPwdError('New password must be at least 8 characters.')
    if (newPwd !== confPwd) return setPwdError('Passwords do not match.')
    if (newPwd === oldPwd) return setPwdError('New password must be different from the current one.')
    setPwdSaving(true)
    const result = await changePassword(oldPwd, newPwd)
    setPwdSaving(false)
    if (result.success) {
      setPwdSuccess('Password changed successfully.')
      setOldPwd('')
      setNewPwd('')
      setConfPwd('')
    } else {
      setPwdError(result.error || 'Failed to change password.')
    }
  }

  function initials(name = '') {
    return name.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  }

  const ROLE_LABEL = { admin: 'Administrator', manager: 'Manager', staff: 'Staff', viewer: 'Viewer' }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-[#D1DCF0] w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#D1DCF0]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-50 border border-[#D1DCF0] flex items-center justify-center text-sm font-bold text-[#0A3D91]">
              {initials(user?.name || '')}
            </div>
            <div>
              <h2 className="text-[#111827] font-bold text-base leading-tight">My Profile</h2>
              <p className="text-slate-400 text-[11px]">{ROLE_LABEL[user?.role] ?? user?.role} · @{user?.username}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* ── Profile Details ── */}
          <form onSubmit={handleProfileSave}>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-4">Profile Details</p>
            <div className="space-y-3">
              <div>
                <Label>Display Name *</Label>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your full name"
                  className={inputCls()}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Mobile Number</Label>
                  <input
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="10-digit Indian number"
                    maxLength={10}
                    className={inputCls()}
                  />
                </div>
                <div>
                  <Label>WhatsApp Number</Label>
                  <input
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="WhatsApp number"
                    maxLength={10}
                    className={inputCls()}
                  />
                </div>
              </div>
              <div>
                <Label>Email</Label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className={inputCls()}
                />
              </div>
              <div>
                <Label>Notification Preference</Label>
                <select
                  value={notifPref}
                  onChange={(e) => setNotifPref(e.target.value)}
                  className={inputCls('appearance-none')}
                >
                  {NOTIF_PREFS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>

            {profileError  && <div className="mt-3"><ErrorBox   message={profileError}  /></div>}
            {profileSuccess && <div className="mt-3"><SuccessBox message={profileSuccess} /></div>}

            <button
              type="submit"
              disabled={profileSaving}
              className="mt-4 w-full bg-[#0A3D91] hover:bg-[#0057D9] disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition-all"
            >
              {profileSaving ? 'Saving…' : 'Save Profile'}
            </button>
          </form>

          <div className="border-t border-[#D1DCF0]" />

          {/* ── Change Password ── */}
          <form onSubmit={handlePasswordSave}>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-4">Change Password</p>
            <div className="space-y-3">
              <div>
                <Label>Current Password</Label>
                <div className="relative">
                  <input
                    type={showOld ? 'text' : 'password'}
                    value={oldPwd}
                    onChange={(e) => setOldPwd(e.target.value)}
                    placeholder="Current password"
                    className={inputCls('pr-10')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowOld((v) => !v)}
                    className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600"
                    tabIndex={-1}
                  >
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                      {showOld
                        ? <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        : <><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></>
                      }
                    </svg>
                  </button>
                </div>
              </div>
              <div>
                <Label>New Password (min 8 chars)</Label>
                <div className="relative">
                  <input
                    type={showNew ? 'text' : 'password'}
                    value={newPwd}
                    onChange={(e) => setNewPwd(e.target.value)}
                    placeholder="At least 8 characters"
                    className={inputCls('pr-10')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew((v) => !v)}
                    className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600"
                    tabIndex={-1}
                  >
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                      {showNew
                        ? <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        : <><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></>
                      }
                    </svg>
                  </button>
                </div>
              </div>
              <div>
                <Label>Confirm New Password</Label>
                <input
                  type="password"
                  value={confPwd}
                  onChange={(e) => setConfPwd(e.target.value)}
                  placeholder="Repeat new password"
                  className={inputCls()}
                />
              </div>
            </div>

            {pwdError   && <div className="mt-3"><ErrorBox   message={pwdError}   /></div>}
            {pwdSuccess && <div className="mt-3"><SuccessBox message={pwdSuccess} /></div>}

            <button
              type="submit"
              disabled={pwdSaving}
              className="mt-4 w-full bg-slate-700 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition-all"
            >
              {pwdSaving ? 'Changing…' : 'Change Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
