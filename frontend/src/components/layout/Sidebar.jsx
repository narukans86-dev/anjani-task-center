import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import BrandLogo from '../BrandLogo'
import { createAuditLog } from '../../services/api'
import { ROUTE_ROLES, hasRole } from '../../services/permissions'
import MyProfileModal from '../MyProfileModal'

const NAV = [
  {
    to: '/dashboard',
    routeKey: 'dashboard',
    label: 'Dashboard',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.75">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    to: '/tasks',
    routeKey: 'tasks',
    label: "Today's Tasks",
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5z" />
      </svg>
    ),
  },
  {
    to: '/checklist',
    routeKey: 'checklist',
    label: 'Checklist',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    to: '/daily-routine',
    routeKey: 'dailyRoutine',
    label: 'Daily Routine',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.75">
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 8h6M9 12h6M9 16h3" />
        <path strokeLinecap="round" strokeLinejoin="round" d="m15 16 1.5 1.5L20 14" />
      </svg>
    ),
  },
  {
    to: '/incentives',
    routeKey: 'incentives',
    label: 'Incentives',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.5h5a2.5 2.5 0 000-5h-4a2.5 2.5 0 010-5h5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 19h16M5 15l3-3 3 2 5-6 3 3" />
      </svg>
    ),
  },
  {
    to: '/staff',
    routeKey: 'staff',
    label: 'Staff',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-5-3.87M9 20H4v-2a4 4 0 015-3.87m6-4.13a4 4 0 11-8 0 4 4 0 018 0zm6 0a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    to: '/calendar',
    routeKey: 'calendar',
    label: 'Calendar',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.75">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 2v4M8 2v4M3 10h18" />
      </svg>
    ),
  },
  {
    to: '/reports',
    routeKey: 'reports',
    label: 'Reports',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-6m4 6v-4m4 4V9M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    to: '/audit',
    routeKey: 'audit',
    label: 'Audit Log',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    to: '/patient-refill',
    routeKey: 'patientRefill',
    label: 'Patient Refills',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    to: '/refill-dashboard',
    routeKey: 'refillDashboard',
    label: 'Refill Dashboard',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-6m4 6v-4m4 4V9M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 3H6a1 1 0 00-1 1v3" />
      </svg>
    ),
  },
  {
    to: '/quote-editor',
    routeKey: 'quoteEditor',
    label: 'Quote Editor',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 3v4a1 1 0 001 1h4" />
      </svg>
    ),
  },
  {
    to: '/settings',
    routeKey: 'settings',
    label: 'Settings',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
]

const ROLE_LABEL = { admin: 'Administrator', manager: 'Manager', staff: 'Staff', viewer: 'Viewer' }

function initials(name = '') {
  return name.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}

export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth()
  const [showProfile, setShowProfile] = useState(false)

  const visibleNav = NAV.filter(({ routeKey }) => hasRole(user, ROUTE_ROLES[routeKey] ?? []))

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={[
          'fixed inset-y-0 left-0 z-30 flex flex-col w-64',
          'bg-white border-r border-[#D1DCF0] shadow-sm',
          'transition-transform duration-200 ease-in-out',
          'lg:static lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-[#D1DCF0] bg-gradient-to-br from-white to-blue-50/70">
          <div className="min-w-0 flex-1">
            <BrandLogo className="h-8 max-w-[160px]" fallbackClassName="text-sm" />
            <div className="mt-2">
              <p className="text-[#0A3D91] font-bold text-sm leading-tight truncate">Anjani Medical</p>
              <p className="text-slate-500 text-xs leading-tight">Task Center</p>
            </div>
          </div>
          {/* Mobile close */}
          <button onClick={onClose} className="ml-auto lg:hidden text-slate-400 hover:text-slate-600 transition-colors">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <p className="px-3 mb-2 text-[10px] font-semibold tracking-[0.15em] uppercase text-slate-400">
            Navigation
          </p>
          {visibleNav.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) =>
                [
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                  isActive
                    ? 'bg-blue-50 text-[#0A3D91] border-l-2 border-[#0A3D91] font-semibold'
                    : 'text-slate-600 hover:bg-blue-50 hover:text-[#0A3D91] border-l-2 border-transparent',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  <span className={isActive ? 'text-[#0A3D91]' : 'text-slate-400'}>{icon}</span>
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer — user info + logout */}
        <div className="px-4 py-4 border-t border-[#D1DCF0]">
          {user && (
            <div className="flex items-center gap-3 mb-3">
              <button
                onClick={() => setShowProfile(true)}
                title="Edit my profile"
                className="flex items-center gap-3 flex-1 min-w-0 text-left rounded-lg hover:bg-blue-50 p-1 -m-1 transition-colors group"
              >
                <div className="w-8 h-8 rounded-full bg-blue-50 border border-[#D1DCF0] flex items-center justify-center text-[11px] font-bold text-[#0A3D91] shrink-0 group-hover:border-[#0A3D91] transition-colors">
                  {initials(user.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[#111827] text-xs font-semibold truncate">{user.name}</p>
                  <p className="text-slate-400 text-[10px] truncate">{ROLE_LABEL[user.role] ?? user.role}</p>
                </div>
              </button>
              <button
                onClick={() => {
                  createAuditLog({ action: 'logout', entity_type: 'auth', entity_id: null, user_name: user?.name, details: `User '${user?.name}' logged out` }).catch(() => {})
                  logout()
                }}
                title="Sign out"
                className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          )}
          <p className="text-slate-400 text-[10px] text-center">
            v1.0.0 &middot; Local Build &middot; Port 5173
          </p>
        </div>

        {showProfile && <MyProfileModal onClose={() => setShowProfile(false)} />}
      </aside>
    </>
  )
}
