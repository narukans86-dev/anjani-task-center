const REPORT_CARDS = [
  {
    title: 'Task Completion Report',
    description: 'Breakdown of completed vs pending tasks per staff member over a date range.',
    badge: 'CSV Export',
  },
  {
    title: 'Daily Summary',
    description: 'End-of-day digest showing all task activity, completions, and open items.',
    badge: 'PDF Ready',
  },
  {
    title: 'Staff Performance',
    description: 'On-time completion rate, average task duration, and workload distribution.',
    badge: 'Charts',
  },
  {
    title: 'Recurring Task Audit',
    description: 'Which recurring tasks are being completed consistently and which are being missed.',
    badge: 'Calendar View',
  },
]

export default function Reports() {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white tracking-tight mb-1">Reports</h2>
        <p className="text-slate-400 text-sm">Analytics, exports, and operational summaries.</p>
      </div>

      <div className="card-glass rounded-2xl p-5 mb-6 border-l-2 border-l-teal-500/60">
        <div className="flex items-center gap-3 mb-2">
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-teal-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-teal-300 text-sm font-semibold">Loading in Phase 2</p>
        </div>
        <p className="text-slate-400 text-xs leading-relaxed pl-7">
          Reporting and CSV export will be available once task data accumulates. The backend is wired and ready to serve aggregated data.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {REPORT_CARDS.map((card) => (
          <div key={card.title} className="card-glass rounded-2xl p-5 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[#111827] text-sm font-semibold leading-snug">{card.title}</p>
              <span className="shrink-0 px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-500 text-[10px] font-medium">
                {card.badge}
              </span>
            </div>
            <p className="text-slate-500 text-xs leading-relaxed">{card.description}</p>
            <div className="mt-auto h-1 rounded-full bg-slate-100">
              <div className="w-0 h-full rounded-full bg-teal-500/40" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
