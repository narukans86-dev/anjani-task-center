import { useState, useEffect, useCallback, useMemo } from 'react'
import { getTodayChecklists, completeChecklistItem, uncompleteChecklistItem, getStaff } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../hooks/useToast'
import Toast from '../components/Toast'

function timeAgo(isoString) {
  if (!isoString) return ''
  const diff = Math.floor((Date.now() - new Date(isoString)) / 1000)
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return new Date(isoString).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function ProgressBar({ completed, total, color = '#10b981' }) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-slate-500 font-medium">{completed} of {total} completed</span>
        <span className="text-xs font-bold" style={{ color }}>{pct}%</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

function ChecklistItem({ item, onComplete, onUncomplete, staffMap, isStaff, completing }) {
  const done = !!item.is_completed   // coerce SQLite integer 0/1 to boolean
  const hour = new Date().getHours()
  const isLateAndPending = !done && hour >= 18

  let rowCls = 'flex items-start gap-3 p-3.5 rounded-xl border transition-colors'
  if (done) {
    rowCls += ' bg-emerald-50 border-emerald-100'
  } else if (isLateAndPending) {
    rowCls += ' bg-red-50 border-red-100'
  } else {
    rowCls += ' bg-white border-[#D1DCF0] hover:bg-blue-50/40'
  }

  const completedByName = item.completed_by
    ? staffMap[item.completed_by]?.name ?? `Staff #${item.completed_by}`
    : null

  const completedAt = item.completed_at
    ? new Date(item.completed_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
    : null

  // busy if we're completing this item OR unmarking its completion record
  // completing must be non-null to avoid matching null completion_id on pending items
  const isBusy = completing !== null && (completing === item.id || completing === item.completion_id)

  return (
    <div className={rowCls}>
      {/* Checkbox */}
      <button
        onClick={() => done
          ? (!isStaff && onUncomplete(item.completion_id))
          : onComplete(item.id)
        }
        disabled={isBusy || (done && isStaff)}
        className={[
          'shrink-0 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all mt-0.5',
          done
            ? 'bg-emerald-500 border-emerald-500'
            : isLateAndPending
            ? 'border-red-300 hover:border-red-500'
            : 'border-[#D1DCF0] hover:border-[#0A3D91]',
          isBusy ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
        ].join(' ')}
        title={done && isStaff ? 'Only admins can unmark' : ''}
      >
        {isBusy
          ? <div className="w-3 h-3 border border-slate-400 border-t-transparent rounded-full animate-spin" />
          : done
          ? <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          : null
        }
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={[
          'text-sm font-medium',
          done ? 'line-through text-slate-400' : isLateAndPending ? 'text-red-700' : 'text-[#111827]',
        ].join(' ')}>
          {item.title}
        </p>
        {done && completedByName && (
          <p className="text-emerald-600 text-[10px] mt-0.5">
            Completed by {completedByName}
            {completedAt && ` at ${completedAt}`}
          </p>
        )}
        {!done && isLateAndPending && (
          <p className="text-red-500 text-[10px] mt-0.5">Overdue — should be completed by now</p>
        )}
      </div>

      {/* Time ago */}
      {done && item.completed_at && (
        <span className="text-slate-400 text-[10px] shrink-0 mt-0.5">{timeAgo(item.completed_at)}</span>
      )}
    </div>
  )
}

export default function Checklist() {
  const { user, hasPermission } = useAuth()
  const { toasts, add: toast, remove: removeToast } = useToast()

  const [items, setItems] = useState([])
  const [staffList, setStaffList] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('opening')
  const [completing, setCompleting] = useState(null)

  const isStaff = user?.role === 'staff'

  const staffMap = useMemo(() => {
    const m = {}
    staffList.forEach((s) => { m[s.id] = s })
    return m
  }, [staffList])

  const myStaffId = useMemo(() => {
    const match = staffList.find((s) => s.name === user?.name)
    return match ? match.id : null
  }, [staffList, user])

  const load = useCallback(async () => {
    try {
      const [data, staff] = await Promise.all([getTodayChecklists(), getStaff()])
      setItems(data)
      setStaffList(staff)
    } catch (e) {
      toast(`Failed to load checklist: ${e.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleComplete(checklistId) {
    setCompleting(checklistId)
    try {
      await completeChecklistItem(checklistId, myStaffId, null)
      await load()
      toast('Item marked complete', 'success')
    } catch (e) {
      toast(e.message.includes('409') ? 'Already completed today' : `Error: ${e.message}`, 'error')
    } finally {
      setCompleting(null)
    }
  }

  async function handleUncomplete(completionId) {
    setCompleting(completionId)
    try {
      await uncompleteChecklistItem(completionId)
      await load()
      toast('Item unmarked', 'success')
    } catch (e) {
      toast(`Error: ${e.message}`, 'error')
    } finally {
      setCompleting(null)
    }
  }

  const tabItems = useMemo(() => items.filter((i) => i.type === tab), [items, tab])
  const openingItems = useMemo(() => items.filter((i) => i.type === 'opening'), [items])
  const closingItems = useMemo(() => items.filter((i) => i.type === 'closing'), [items])

  const openingCompleted = openingItems.filter((i) => !!i.is_completed).length
  const closingCompleted = closingItems.filter((i) => !!i.is_completed).length

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const activeTotal     = tab === 'opening' ? openingItems.length : closingItems.length
  const activeCompleted = tab === 'opening' ? openingCompleted    : closingCompleted
  const activePct       = activeTotal > 0 ? Math.round((activeCompleted / activeTotal) * 100) : 0

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-[#111827] tracking-tight mb-1">Daily Checklist</h2>
          <p className="text-slate-500 text-sm">{today}</p>
        </div>
        <span className={[
          'px-3 py-1 rounded-full text-xs font-bold border',
          activePct === 100
            ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
            : activePct >= 50
            ? 'bg-blue-50 text-[#0A3D91] border-blue-200'
            : 'bg-amber-50 text-amber-700 border-amber-200',
        ].join(' ')}>
          {activePct}% done
        </span>
      </div>

      {/* Tabs */}
      <div className="flex bg-white rounded-xl p-1 border border-[#D1DCF0] mb-5 gap-1">
        {[
          { key: 'opening', label: 'Opening Checklist', emoji: '🌅', total: openingItems.length, done: openingCompleted },
          { key: 'closing', label: 'Closing Checklist', emoji: '🌙', total: closingItems.length, done: closingCompleted },
        ].map(({ key, label, emoji, total, done }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={[
              'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all',
              tab === key
                ? 'bg-[#0A3D91] text-white shadow-sm'
                : 'text-slate-500 hover:text-[#0A3D91] hover:bg-blue-50',
            ].join(' ')}
          >
            <span>{emoji}</span>
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{key === 'opening' ? 'Opening' : 'Closing'}</span>
            <span className={[
              'px-1.5 py-0.5 rounded-full text-[10px] font-bold',
              tab === key
                ? 'bg-white/20 text-white'
                : done === total && total > 0
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-slate-100 text-slate-500',
            ].join(' ')}>
              {done}/{total}
            </span>
          </button>
        ))}
      </div>

      {/* Progress bar */}
      <div className="bg-white rounded-2xl p-4 border border-[#D1DCF0] shadow-sm mb-4">
        <ProgressBar
          completed={activeCompleted}
          total={activeTotal}
          color={activePct === 100 ? '#10b981' : '#0A3D91'}
        />

        {/* Checklist items */}
        {loading ? (
          <div className="space-y-2">
            {[1,2,3,4].map((i) => (
              <div key={i} className="h-12 rounded-xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : tabItems.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-6">No items in this checklist.</p>
        ) : (
          <div className="space-y-2">
            {tabItems.map((item) => (
              <ChecklistItem
                key={item.id}
                item={item}
                onComplete={handleComplete}
                onUncomplete={handleUncomplete}
                staffMap={staffMap}
                isStaff={isStaff}
                completing={completing}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer hint */}
      {!isStaff && activeCompleted > 0 && (
        <p className="text-slate-400 text-[11px] text-center">
          Admin/Manager: click a completed item to unmark it.
        </p>
      )}

      <Toast toasts={toasts} remove={removeToast} />
    </div>
  )
}
