import { useState, useEffect, useCallback } from 'react'
import { getAuditLogs, createAuditLog } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../hooks/useToast'
import Toast from '../components/Toast'

const ENTITY_TYPES = ['', 'staff', 'task', 'checklist', 'auth', 'settings']

function formatTs(ts) {
  if (!ts) return '-'
  const d = new Date(ts)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function ActionBadge({ action = '' }) {
  const a = action.toLowerCase()
  let cls = 'bg-slate-100 text-slate-500 border-slate-200'
  if (a.includes('add') || a.includes('creat'))   cls = 'bg-emerald-50 text-emerald-700 border-emerald-200'
  else if (a.includes('edit') || a.includes('updat')) cls = 'bg-blue-50 text-blue-700 border-blue-200'
  else if (a.includes('delet') || a.includes('clear') || a.includes('deactivat')) cls = 'bg-red-50 text-red-600 border-red-200'
  else if (a.includes('status') || a.includes('complet') || a.includes('unmark')) cls = 'bg-amber-50 text-amber-700 border-amber-200'
  else if (a.includes('login') || a.includes('logout') || a.includes('auth')) cls = 'bg-slate-100 text-slate-600 border-slate-200'
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cls} whitespace-nowrap`}>
      {action}
    </span>
  )
}

export default function AuditLog() {
  const { user, hasPermission } = useAuth()
  const { toasts, add: toast, remove: removeToast } = useToast()

  const [logs, setLogs]         = useState([])
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(1)
  const [loading, setLoading]   = useState(true)
  const [clearing, setClearing] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)

  const [filterEntity, setFilterEntity] = useState('')
  const [filterFrom, setFilterFrom]     = useState('')
  const [filterTo, setFilterTo]         = useState('')
  const [filterSearch, setFilterSearch] = useState('')

  const LIMIT = 50

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const data = await getAuditLogs(page, LIMIT)
      setLogs(data.data ?? [])
      setTotal(data.total ?? 0)
    } catch (e) {
      toast(`Failed to load logs: ${e.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { load() }, [load])

  async function handleClear() {
    setClearing(true)
    try {
      await fetch('/api/audit/clear', { method: 'DELETE' })
      setConfirmClear(false)
      toast('Audit logs cleared', 'success')
      setPage(1)
      await load()
    } catch (e) {
      toast(`Error: ${e.message}`, 'error')
    } finally {
      setClearing(false)
    }
  }

  if (user?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
        <svg viewBox="0 0 24 24" className="w-12 h-12 text-slate-300" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <p className="text-[#111827] font-semibold">Access Restricted</p>
        <p className="text-slate-500 text-sm">Audit Log is only accessible to Administrators.</p>
      </div>
    )
  }

  // client-side filter on loaded page
  const filtered = logs.filter((log) => {
    if (filterEntity && log.entity_type !== filterEntity) return false
    if (filterSearch && !log.action?.toLowerCase().includes(filterSearch.toLowerCase())
        && !log.details?.toLowerCase().includes(filterSearch.toLowerCase())) return false
    if (filterFrom && log.timestamp && log.timestamp.slice(0, 10) < filterFrom) return false
    if (filterTo   && log.timestamp && log.timestamp.slice(0, 10) > filterTo)   return false
    return true
  })

  const totalPages = Math.max(1, Math.ceil(total / LIMIT))

  const filterSelectCls = 'bg-white border border-[#D1DCF0] rounded-lg px-3 py-1.5 text-sm text-[#111827] focus:outline-none focus:border-[#0A3D91]'

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-[#111827] tracking-tight mb-1">Audit Log</h2>
          <p className="text-slate-500 text-sm">{total} total entries</p>
        </div>
        {user?.role === 'admin' && (
          <button
            onClick={() => setConfirmClear(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200 text-red-500 text-xs font-medium hover:bg-red-50 transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Clear Logs
          </button>
        )}
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-2xl p-4 mb-5 border border-[#D1DCF0] shadow-sm">
        <div className="flex gap-3 flex-wrap items-center">
          <select value={filterEntity} onChange={(e) => setFilterEntity(e.target.value)} className={filterSelectCls}>
            <option value="">All Entities</option>
            {ENTITY_TYPES.filter(Boolean).map((t) => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
          <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} className={filterSelectCls} placeholder="From" />
          <input type="date" value={filterTo}   onChange={(e) => setFilterTo(e.target.value)}   className={filterSelectCls} placeholder="To" />
          <div className="relative flex-1 min-w-[160px]">
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              placeholder="Search action or details…"
              className="w-full bg-white border border-[#D1DCF0] rounded-lg px-3 py-1.5 pl-8 text-sm text-[#111827] placeholder-slate-400 focus:outline-none focus:border-[#0A3D91]"
            />
          </div>
          {(filterEntity || filterFrom || filterTo || filterSearch) && (
            <button
              onClick={() => { setFilterEntity(''); setFilterFrom(''); setFilterTo(''); setFilterSearch('') }}
              className="text-slate-500 text-xs hover:text-[#0A3D91] transition-colors whitespace-nowrap"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl overflow-hidden border border-[#D1DCF0] shadow-sm">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1,2,3,4,5].map((i) => <div key={i} className="h-10 rounded bg-slate-100 animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-sm">No audit entries found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E8EFFF]">
                  {['Timestamp', 'Action', 'Entity', 'User', 'Details'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-slate-500 text-xs font-semibold uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F4FF]">
                {filtered.map((log) => (
                  <tr key={log.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{formatTs(log.timestamp)}</td>
                    <td className="px-4 py-3"><ActionBadge action={log.action} /></td>
                    <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">
                      {log.entity_type
                        ? <span>{log.entity_type}{log.entity_id != null ? ` #${log.entity_id}` : ''}</span>
                        : <span className="text-slate-300">—</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">
                      {log.user_name ?? <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs max-w-xs truncate">{log.details ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-slate-400 text-xs">Page {page} of {totalPages} · {total} entries</p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-lg border border-[#D1DCF0] text-xs text-slate-600 hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              ← Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-lg border border-[#D1DCF0] text-xs text-slate-600 hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Confirm clear dialog */}
      {confirmClear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmClear(false)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-[#D1DCF0]">
            <p className="text-[#111827] font-semibold mb-2">Clear All Audit Logs?</p>
            <p className="text-slate-500 text-sm mb-5">This will permanently delete all {total} log entries. This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmClear(false)} className="flex-1 px-4 py-2 rounded-lg border border-[#D1DCF0] text-slate-600 text-sm hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleClear} disabled={clearing} className="flex-1 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-400 disabled:opacity-50 text-white text-sm font-semibold transition-colors">
                {clearing ? 'Clearing…' : 'Clear All'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast toasts={toasts} remove={removeToast} />
    </div>
  )
}
