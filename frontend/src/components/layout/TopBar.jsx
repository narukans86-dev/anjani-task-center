import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

const PAGE_TITLES = {
  '/dashboard': 'Dashboard',
  '/tasks':     "Today's Tasks",
  '/staff':     'Staff',
  '/calendar':  'Calendar',
  '/reports':   'Reports',
  '/settings':  'Settings',
}

export default function TopBar({ onMenuClick }) {
  const location = useLocation()
  const title = PAGE_TITLES[location.pathname] ?? 'Anjani Medical'

  const [time, setTime] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const timeStr = time.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })

  const dateStr = time.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return (
    <header className="h-14 flex items-center gap-4 px-4 border-b border-slate-800/70 bg-slate-950/80 backdrop-blur-sm shrink-0">
      {/* Hamburger — mobile only */}
      <button
        onClick={onMenuClick}
        className="lg:hidden text-slate-400 hover:text-slate-200 transition-colors p-1 -ml-1"
        aria-label="Open menu"
      >
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Page title */}
      <h1 className="text-white font-semibold text-base tracking-tight">{title}</h1>

      {/* Right section */}
      <div className="ml-auto flex items-center gap-3">
        {/* Clock */}
        <div className="hidden sm:flex flex-col items-end">
          <span className="text-slate-200 text-xs font-mono font-medium leading-tight">{timeStr}</span>
          <span className="text-slate-500 text-[10px] leading-tight">{dateStr}</span>
        </div>

        {/* Divider */}
        <div className="hidden sm:block w-px h-6 bg-slate-800" />

        {/* System Online badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-emerald-400 text-xs font-medium">System Online</span>
        </div>
      </div>
    </header>
  )
}
