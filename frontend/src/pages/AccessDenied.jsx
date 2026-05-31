import { useNavigate } from 'react-router-dom'

export default function AccessDenied() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-slate-950 bg-grid-slate flex items-center justify-center p-4">
      <div className="card-glass rounded-2xl p-10 max-w-sm w-full text-center shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
          <svg viewBox="0 0 24 24" className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>

        <h2 className="text-white text-xl font-bold mb-2">Access Restricted</h2>
        <p className="text-slate-400 text-sm mb-8">
          You don't have permission to view this page.
        </p>

        <button
          onClick={() => navigate('/dashboard')}
          className="w-full bg-teal-500 hover:bg-teal-400 text-white font-semibold py-2.5 rounded-xl transition-all duration-150 shadow-lg shadow-teal-500/20"
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  )
}
