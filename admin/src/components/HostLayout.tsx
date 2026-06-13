import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

type Tab = 'dashboard' | 'properties' | 'conversations';

const icons: Record<Tab, ReactNode> = {
  dashboard: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  properties: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V10.5z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 21V12h6v9" />
    </svg>
  ),
  conversations: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
    </svg>
  ),
};

type Props = {
  children: ReactNode;
  hostName: string;
  hostPhone: string;
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
};

export function HostLayout({ children, hostName, hostPhone, activeTab, onTabChange }: Props) {
  const navigate = useNavigate();

  const nav: { id: Tab; label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'properties', label: 'Properties' },
    { id: 'conversations', label: 'Conversations' },
  ];

  const handleLogout = () => {
    localStorage.removeItem('host_auth');
    navigate('/host/login');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed left-0 top-0 h-screen w-60 bg-slate-800 flex flex-col z-50 overflow-y-auto">
        <div className="px-5 py-5 border-b border-slate-700">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-teal-500 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </div>
            <div>
              <p className="text-white text-sm font-semibold leading-none">AI Receptionist</p>
              <p className="text-slate-400 text-xs mt-0.5">Host Dashboard</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          {nav.map((n) => (
            <button
              key={n.id}
              onClick={() => onTabChange(n.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm flex items-center gap-3 transition-all ${
                activeTab === n.id
                  ? 'bg-teal-600 text-white font-medium shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
              }`}
            >
              {icons[n.id]}
              {n.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-700 space-y-3">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{hostName}</p>
            <p className="text-xs text-slate-500 mt-0.5">{hostPhone}</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full text-left px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
            </svg>
            Sign out
          </button>
        </div>
      </aside>

      <main className="ml-60 w-[calc(100%-240px)] h-screen overflow-auto">
        {children}
      </main>
    </div>
  );
}
