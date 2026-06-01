import { useEffect, useState, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getNotifications, getUnreadCount } from '../../services/api'
import NotificationPanel from '../NotificationPanel'
import BrandLogo from '../BrandLogo'

const PAGE_TITLES = {
  '/dashboard': 'Dashboard',
  '/tasks':     "Today's Tasks",
  '/checklist': 'Checklist',
  '/daily-routine': 'Daily Routine',
  '/staff':     'Staff',
  '/calendar':  'Calendar',
  '/reports':   'Reports',
  '/settings':  'Settings',
  '/audit':     'Audit Log',
}

const ROLE_BADGE = {
  admin:   { label: 'Admin',   cls: 'bg-[#0A3D91] text-white' },
  manager: { label: 'Manager', cls: 'bg-teal-600 text-white' },
  staff:   { label: 'Staff',   cls: 'bg-slate-500 text-white' },
  viewer:  { label: 'Viewer',  cls: 'bg-slate-100 text-slate-600 border border-slate-200' },
}

export default function TopBar({ onMenuClick }) {
  const location = useLocation()
  const title = PAGE_TITLES[location.pathname] ?? 'Anjani Medical'
  const { user } = useAuth()

  const [time, setTime] = useState(() => new Date())
  const [panelOpen, setPanelOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState([])

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const fetchNotifs = useCallback(async () => {
    try {
      const [countData, notifsData] = await Promise.all([getUnreadCount(), getNotifications()])
      setUnreadCount(countData.count)
      setNotifications(notifsData)
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    fetchNotifs()
    const id = setInterval(fetchNotifs, 60_000)
    return () => clearInterval(id)
  }, [fetchNotifs])

  const timeStr = time.toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
  })
  const dateStr = time.toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })

  const badge = user ? (ROLE_BADGE[user.role] ?? ROLE_BADGE.staff) : null

  return (
    <>
      <header className="h-14 flex items-center gap-4 px-4 border-b border-[#D1DCF0] bg-white shadow-sm shrink-0">
        {/* Hamburger — mobile only */}
        <button
          onClick={onMenuClick}
          className="lg:hidden text-slate-500 hover:text-[#0A3D91] transition-colors p-1 -ml-1"
          aria-label="Open menu"
        >
          <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div className="lg:hidden shrink-0">
          <BrandLogo className="h-7 max-w-[128px]" fallbackClassName="text-sm" />
        </div>

        {/* Page title */}
        <h1 className="hidden sm:block text-[#111827] font-semibold text-base tracking-tight">{title}</h1>

        {/* Right section */}
        <div className="ml-auto flex items-center gap-3">
          {/* Clock */}
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-slate-500 text-xs font-mono font-medium leading-tight">{timeStr}</span>
            <span className="text-slate-400 text-[10px] leading-tight">{dateStr}</span>
          </div>

          <div className="hidden sm:block w-px h-6 bg-[#D1DCF0]" />

          {/* System Online badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-100">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-emerald-600 text-xs font-medium">Online</span>
          </div>

          {/* Bell icon */}
          <button
            onClick={() => setPanelOpen((v) => !v)}
            className="relative p-1.5 rounded-lg text-slate-500 hover:text-[#0A3D91] hover:bg-blue-50 transition-colors"
            aria-label="Notifications"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* User name + role badge */}
          {user && (
            <>
              <div className="hidden sm:block w-px h-6 bg-[#D1DCF0]" />
              <div className="flex items-center gap-2">
                <span className="text-[#111827] text-xs font-medium hidden md:block">{user.name}</span>
                {badge && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${badge.cls}`}>
                    {badge.label}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </header>

      <NotificationPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        notifications={notifications}
        onRefresh={fetchNotifs}
      />
    </>
  )
}
