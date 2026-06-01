import { useEffect, useRef } from 'react'
import { markNotificationRead, markAllRead, deleteNotification } from '../services/api'

const PRIORITY_BORDER = {
  critical: 'border-l-red-500',
  high:     'border-l-orange-400',
  medium:   'border-l-blue-400',
  low:      'border-l-slate-300',
}

const TYPE_ICON = {
  task:      '📋',
  checklist: '✅',
  system:    '⚙️', // Added system icon
  staff:     '👤', // Added staff icon
}

function timeAgo(isoString) {
  if (!isoString) return ''
  const diff = Math.floor((Date.now() - new Date(isoString)) / 1000)
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return new Date(isoString).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export default function NotificationPanel({ open, onClose, notifications, onRefresh }) {
  const panelRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  async function handleRead(id) {
    try { await markNotificationRead(id); onRefresh() } catch { /* silent */ }
  }

  async function handleMarkAll() {
    try { await markAllRead(); onRefresh() } catch { /* silent */ }
  }

  async function handleDelete(e, id) {
    e.stopPropagation()
    try { await deleteNotification(id); onRefresh() } catch { /* silent */ }
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length

  return (
    <>
      {/* Backdrop — mobile only */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/20 lg:bg-transparent" onClick={onClose} />
      )}

      {/* Slide-in panel */}
      <div
        ref={panelRef}
        className={[
          'fixed top-0 right-0 h-full z-50 w-full max-w-sm',
          'bg-white border-l border-[#D1DCF0] shadow-2xl',
          'flex flex-col transition-transform duration-200 ease-in-out',
          open ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#D1DCF0] shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-[#111827] font-semibold text-base">Notifications</h2>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-600 border border-red-200">
                {unreadCount} new
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAll}
                className="text-xs text-[#0A3D91] hover:underline font-medium"
              >
                Mark all read
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#F0F4FF]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
              <svg viewBox="0 0 24 24" className="w-10 h-10 text-slate-200" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 00-9.33-5M9 17H4l1.405-1.405A2.032 2.032 0 006 14.158V11a6 6 0 016-6m0 0V4m0 7v6m0 4h.01" />
              </svg>
              <p className="text-slate-500 text-sm font-medium">All caught up!</p>
              <p className="text-slate-400 text-xs">No new notifications.</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => !n.is_read && handleRead(n.id)}
                className={[
                  'flex items-start gap-3 px-4 py-3.5 border-l-4 cursor-pointer transition-colors',
                  PRIORITY_BORDER[n.priority] || PRIORITY_BORDER.low,
                  n.is_read ? 'bg-white hover:bg-slate-50' : 'bg-blue-50/40 hover:bg-blue-50',
                ].join(' ')}
              >
                <span className="text-lg shrink-0 mt-0.5">{TYPE_ICON[n.type] || '🔔'}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm truncate ${n.is_read ? 'text-slate-600 font-normal' : 'text-[#111827] font-semibold'}`}>
                    {n.title}
                  </p>
                  {n.message && (
                    <p className="text-slate-500 text-xs mt-0.5 line-clamp-2">{n.message}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-slate-400 text-[10px]">{timeAgo(n.created_at)}</span>
                    {!n.is_read && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#0A3D91] shrink-0" />
                    )}
                  </div>
                </div>
                <button
                  onClick={(e) => handleDelete(e, n.id)}
                  className="shrink-0 p-1 rounded text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors mt-0.5"
                  title="Delete"
                >
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="px-5 py-3 border-t border-[#D1DCF0] shrink-0">
            <p className="text-slate-400 text-[10px] text-center">
              {notifications.length} notification{notifications.length !== 1 ? 's' : ''} total
            </p>
          </div>
        )}
      </div>
    </>
  )
}
