import { createContext, useCallback, useContext, useState } from 'react'

const ToastContext = createContext(null)

let _id = 0

const TYPE_STYLES = {
  success: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
  error:   'bg-red-500/10   border-red-500/30   text-red-300',
  warning: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
  info:    'bg-blue-500/10  border-blue-500/30  text-blue-300',
}

const TYPE_ICONS = {
  success: (
    <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  ),
  error: (
    <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),
  warning: (
    <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
  ),
  info: (
    <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
}

function ToastItem({ toast, onRemove }) {
  const cls = TYPE_STYLES[toast.type] ?? TYPE_STYLES.info

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-sm shadow-xl min-w-[260px] max-w-sm toast-in ${cls}`}>
      {TYPE_ICONS[toast.type]}
      <span className="text-sm font-medium flex-1 leading-snug">{toast.message}</span>
      <button
        onClick={() => onRemove(toast.id)}
        className="opacity-50 hover:opacity-100 transition-opacity shrink-0 ml-1"
        aria-label="Dismiss"
      >
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback((message, type = 'info') => {
    const id = ++_id
    setToasts((prev) => {
      const next = [...prev, { id, message, type }]
      return next.length > 3 ? next.slice(next.length - 3) : next
    })
    setTimeout(() => remove(id), 3000)
  }, [remove])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-[300] flex flex-col gap-2 pointer-events-none">
          {toasts.map((t) => (
            <div key={t.id} className="pointer-events-auto">
              <ToastItem toast={t} onRemove={remove} />
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
