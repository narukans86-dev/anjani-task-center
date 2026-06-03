import { useEffect, useRef, useState, useCallback } from 'react'
import { markNotificationRead, markAllRead, deleteNotification, completeNotification, sendTestNotification } from '../services/api'
import {
  isPushSupported, getPermissionStatus, subscribeDevice,
  unsubscribeDevice, getCurrentSubscription, sendTestPush,
} from '../utils/pushNotifications'

const PRIORITY_BORDER = {
  critical: 'border-l-red-500',
  urgent:   'border-l-red-500',
  high:     'border-l-orange-400',
  medium:   'border-l-blue-400',
  low:      'border-l-slate-300',
}

const TYPE_ICON = {
  task:      '📋',
  checklist: '✅',
  system:    '⚙️',
  staff:     '👤',
  refill:    '💊',
}

function timeAgo(isoString) {
  if (!isoString) return ''
  const diff = Math.floor((Date.now() - new Date(isoString)) / 1000)
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return new Date(isoString).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

// Single notification row
function NotifRow({ n, onRead, onDelete, onComplete }) {
  const isRequired = n.requires_action === 1 && n.action_completed !== 1
  const borderCls = isRequired
    ? 'border-l-amber-500'
    : (PRIORITY_BORDER[n.priority] || PRIORITY_BORDER.low)

  return (
    <div
      onClick={() => !n.is_read && onRead(n.id)}
      className={[
        'flex items-start gap-3 px-4 py-3.5 border-l-4 cursor-pointer transition-colors',
        borderCls,
        isRequired
          ? 'bg-amber-50/60 hover:bg-amber-50'
          : n.is_read
            ? 'bg-white hover:bg-slate-50'
            : 'bg-blue-50/40 hover:bg-blue-50',
      ].join(' ')}
    >
      <span className="text-lg shrink-0 mt-0.5">{TYPE_ICON[n.type] || '🔔'}</span>

      <div className="flex-1 min-w-0">
        {isRequired && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100 border border-amber-200 rounded px-1.5 py-0.5 mb-1">
            <svg viewBox="0 0 24 24" className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            </svg>
            ACTION REQUIRED
          </span>
        )}

        <p className={`text-sm ${n.is_read && !isRequired ? 'text-slate-600 font-normal' : 'text-[#111827] font-semibold'}`}>
          {n.title}
        </p>

        {n.message && (
          <p className="text-slate-500 text-xs mt-0.5 line-clamp-2">{n.message}</p>
        )}

        {n.related_token && (
          <span className="inline-block text-[10px] font-mono bg-slate-100 text-slate-500 rounded px-1.5 py-0.5 mt-1">
            {n.related_token}
          </span>
        )}

        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-slate-400 text-[10px]">{timeAgo(n.created_at)}</span>
          {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-[#0A3D91] shrink-0" />}
          {n.action_completed ? (
            <span className="text-[10px] text-emerald-600 font-medium">✓ Completed</span>
          ) : null}
          {isRequired && n.action_url && (
            <a
              href={n.action_url}
              onClick={(e) => e.stopPropagation()}
              className="text-[10px] text-[#0A3D91] underline font-medium"
            >
              Open →
            </a>
          )}
        </div>

        {/* Complete button for action-required */}
        {isRequired && (
          <button
            onClick={(e) => { e.stopPropagation(); onComplete(n.id) }}
            className="mt-2 text-[11px] px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors font-medium"
          >
            Mark Complete
          </button>
        )}
      </div>

      {/* Delete / Lock button */}
      {isRequired ? (
        <span
          className="shrink-0 p-1 rounded text-amber-400 mt-0.5"
          title="Complete the refill task before clearing this notification"
        >
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
        </span>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(n.id) }}
          className="shrink-0 p-1 rounded text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors mt-0.5"
          title="Delete"
        >
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}

// ── Push notification status panel ─────────────────────────────────────────

function PushStatusPanel() {
  const [permission, setPermission] = useState(getPermissionStatus)
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState(null) // { text, type }
  const supported = isPushSupported()

  const checkSub = useCallback(async () => {
    const sub = await getCurrentSubscription()
    setSubscribed(!!sub)
  }, [])

  useEffect(() => { checkSub() }, [checkSub])

  async function handleEnable() {
    setLoading(true)
    setMsg(null)
    try {
      await subscribeDevice()
      setPermission('granted')
      setSubscribed(true)
      setMsg({ text: 'Mobile notifications enabled on this device.', type: 'success' })
    } catch (err) {
      setPermission(getPermissionStatus())
      setMsg({ text: err.message, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  async function handleDisable() {
    setLoading(true)
    try {
      await unsubscribeDevice()
      setSubscribed(false)
      setMsg({ text: 'Mobile notifications disabled for this device.', type: 'info' })
    } catch (err) {
      setMsg({ text: err.message, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  async function handleTestPush() {
    setLoading(true)
    try {
      await sendTestPush()
      setMsg({ text: 'Test push sent — check your device.', type: 'success' })
    } catch (err) {
      setMsg({ text: 'Failed: ' + err.message, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  async function handleTestInApp() {
    try {
      await sendTestNotification()
      setMsg({ text: 'Test in-app notification created.', type: 'success' })
    } catch (err) {
      setMsg({ text: err.message, type: 'error' })
    }
  }

  const msgColors = {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    error:   'bg-red-50 text-red-600 border-red-200',
    info:    'bg-blue-50 text-blue-700 border-blue-200',
  }

  return (
    <div className="px-4 py-3 bg-slate-50 border-b border-[#D1DCF0]">
      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Mobile Push Notifications</p>

      {!supported ? (
        <p className="text-xs text-slate-500 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Push not supported on this browser. Use Chrome (Android) or Safari with "Add to Home Screen" (iPhone).
        </p>
      ) : (
        <>
          {/* Status indicators */}
          <div className="flex flex-wrap gap-2 mb-2">
            <StatusChip
              label="Browser"
              value={permission === 'granted' ? 'Allowed' : permission === 'denied' ? 'Blocked' : 'Not set'}
              color={permission === 'granted' ? 'emerald' : permission === 'denied' ? 'red' : 'slate'}
            />
            <StatusChip
              label="This device"
              value={subscribed ? 'Subscribed' : 'Not subscribed'}
              color={subscribed ? 'emerald' : 'slate'}
            />
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            {!subscribed ? (
              <button
                onClick={handleEnable}
                disabled={loading || permission === 'denied'}
                className="text-[11px] px-3 py-1.5 rounded-lg bg-[#0A3D91] text-white font-medium hover:bg-[#0057D9] disabled:opacity-50 transition-colors"
              >
                {loading ? 'Enabling…' : 'Enable Mobile Notifications'}
              </button>
            ) : (
              <>
                <button
                  onClick={handleTestPush}
                  disabled={loading}
                  className="text-[11px] px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  Send Test Push
                </button>
                <button
                  onClick={handleDisable}
                  disabled={loading}
                  className="text-[11px] px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:border-red-300 hover:text-red-600 disabled:opacity-50 transition-colors"
                >
                  Disable
                </button>
              </>
            )}
            <button
              onClick={handleTestInApp}
              className="text-[11px] px-3 py-1.5 rounded-lg border border-[#D1DCF0] text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Test In-App
            </button>
          </div>

          {permission === 'denied' && (
            <p className="text-[10px] text-red-500 mt-1.5">
              Notifications blocked in browser. Go to browser settings → Site settings → Notifications → Allow.
            </p>
          )}
        </>
      )}

      {msg && (
        <div className={`mt-2 text-[11px] px-3 py-1.5 rounded-lg border ${msgColors[msg.type]}`}>
          {msg.text}
        </div>
      )}

      {/* Install instructions */}
      <details className="mt-2">
        <summary className="text-[10px] text-slate-400 cursor-pointer hover:text-slate-600">
          How to install on mobile?
        </summary>
        <div className="mt-1.5 text-[10px] text-slate-500 space-y-1 pl-2 border-l-2 border-slate-200">
          <p><strong>Android Chrome:</strong> Menu → Add to Home screen → Open app → Enable Notifications</p>
          <p><strong>iPhone Safari:</strong> Share → Add to Home Screen → Open from home screen → Enable Notifications</p>
        </div>
      </details>
    </div>
  )
}

function StatusChip({ label, value, color }) {
  const colors = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    red:     'bg-red-50 text-red-600 border-red-200',
    slate:   'bg-slate-100 text-slate-500 border-slate-200',
  }
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded border ${colors[color]}`}>
      <span className="font-normal text-inherit opacity-70">{label}:</span>
      {value}
    </span>
  )
}

// ── Main panel ─────────────────────────────────────────────────────────────

export default function NotificationPanel({ open, onClose, notifications, onRefresh }) {
  const panelRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (panelRef.current && !panelRef.current.contains(e.target)) onClose() }
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

  async function handleDelete(id) {
    try { await deleteNotification(id); onRefresh() } catch { /* silent */ }
  }

  async function handleComplete(id) {
    try { await completeNotification(id); onRefresh() } catch { /* silent */ }
  }

  const actionRequired = notifications.filter((n) => n.requires_action === 1 && n.action_completed !== 1)
  const others = notifications.filter((n) => !(n.requires_action === 1 && n.action_completed !== 1))
  const unreadCount = notifications.filter((n) => !n.is_read).length

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/20 lg:bg-transparent" onClick={onClose} />}

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
            {actionRequired.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                {actionRequired.length} pending
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button onClick={handleMarkAll} className="text-xs text-[#0A3D91] hover:underline font-medium">
                Mark all read
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Push notification controls */}
        <PushStatusPanel />

        {/* Notification list */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#F0F4FF]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
              <svg viewBox="0 0 24 24" className="w-10 h-10 text-slate-200" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 00-9.33-5M9 17H4l1.405-1.405A2.032 2.032 0 006 14.158V11a6 6 0 016-6m0 0V4m0 7v6m0 4h.01" />
              </svg>
              <p className="text-slate-500 text-sm font-medium">All caught up!</p>
              <p className="text-slate-400 text-xs">No notifications.</p>
            </div>
          ) : (
            <>
              {actionRequired.length > 0 && (
                <>
                  <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 flex items-center gap-1.5">
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-amber-600 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                    </svg>
                    <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">
                      Action Required · {actionRequired.length}
                    </span>
                  </div>
                  {actionRequired.map((n) => (
                    <NotifRow key={n.id} n={n} onRead={handleRead} onDelete={handleDelete} onComplete={handleComplete} />
                  ))}
                </>
              )}

              {others.length > 0 && (
                <>
                  {actionRequired.length > 0 && (
                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Other</span>
                    </div>
                  )}
                  {others.map((n) => (
                    <NotifRow key={n.id} n={n} onRead={handleRead} onDelete={handleDelete} onComplete={handleComplete} />
                  ))}
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="px-5 py-3 border-t border-[#D1DCF0] shrink-0">
            <p className="text-slate-400 text-[10px] text-center">
              {notifications.length} notification{notifications.length !== 1 ? 's' : ''} total
              {actionRequired.length > 0 && (
                <span className="text-amber-600 font-medium"> · {actionRequired.length} need action</span>
              )}
            </p>
          </div>
        )}
      </div>
    </>
  )
}
