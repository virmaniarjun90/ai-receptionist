import { useNavigate } from 'react-router-dom';

export function Home() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center px-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-16">
          <div className="inline-flex w-16 h-16 rounded-3xl bg-indigo-600 items-center justify-center mb-6 shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-white mb-3">AI Receptionist</h1>
          <p className="text-lg text-slate-400">Choose your role to continue</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Admin */}
          <div
            onClick={() => navigate('/admin/login')}
            className="group cursor-pointer bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-2xl p-8 transition-all hover:shadow-2xl hover:shadow-indigo-500/20 hover:-translate-y-1"
          >
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center mb-4 group-hover:bg-white/30 transition">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Admin</h2>
            <p className="text-indigo-100 text-sm mb-4">Manage all properties, conversations, and system settings</p>
            <div className="flex items-center text-white group-hover:translate-x-1 transition">
              <span className="text-sm font-semibold">Sign In</span>
              <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>

          {/* Host */}
          <div
            onClick={() => navigate('/host/login')}
            className="group cursor-pointer bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-2xl p-8 transition-all hover:shadow-2xl hover:shadow-emerald-500/20 hover:-translate-y-1"
          >
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center mb-4 group-hover:bg-white/30 transition">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Host</h2>
            <p className="text-emerald-100 text-sm mb-4">View conversations for your properties and reply to guests</p>
            <div className="flex items-center text-white group-hover:translate-x-1 transition">
              <span className="text-sm font-semibold">Sign In</span>
              <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </div>

        <div className="mt-12 text-center text-xs text-slate-500">
          <p>AI Receptionist Platform</p>
        </div>
      </div>
    </div>
  );
}
