import { useEffect } from 'react'

function ToastItem({ toast, remove }) {
  useEffect(() => {
    const id = setTimeout(() => remove(toast.id), 4000)
    return () => clearTimeout(id)
  }, [toast.id, remove])

  const cfg =
    toast.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' :
    toast.type === 'error'   ? 'bg-red-500/10 border-red-500/30 text-red-300' :
                               'bg-slate-800/90 border-slate-700/80 text-slate-300'

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-sm shadow-xl min-w-[240px] max-w-sm toast-in ${cfg}`}>
      <span className="text-sm font-medium flex-1">{toast.message}</span>
      <button onClick={() => remove(toast.id)} className="opacity-60 hover:opacity-100 transition-opacity shrink-0">
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

export default function Toast({ toasts, remove }) {
  if (!toasts.length) return null
  return (
    <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} remove={remove} />
        </div>
      ))}
    </div>
  )
}
