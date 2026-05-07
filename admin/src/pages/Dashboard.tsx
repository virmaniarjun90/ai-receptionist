import { useEffect, useState } from 'react';
import { api, Conversation, Health, Property, Reservation } from '../api';

function StatCard({ label, value, sub, icon, color }: {
  label: string; value: string | number; sub?: string;
  icon: React.ReactNode; color: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-6 py-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
          <p className="text-3xl font-bold text-slate-900 mt-1.5">{value}</p>
          {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function HealthRow({ name, dep }: { name: string; dep: { status: string; detail?: string } }) {
  const isOk = dep.status === 'ok';
  const isWarn = dep.status === 'warning';
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
      <div className="flex items-center gap-2.5">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isOk ? 'bg-emerald-400' : isWarn ? 'bg-amber-400' : 'bg-red-400'}`} />
        <span className="text-sm font-medium text-slate-700 capitalize">{name}</span>
      </div>
      <span className="text-xs text-slate-400 max-w-xs text-right truncate">{dep.detail ?? dep.status}</span>
    </div>
  );
}

export function Dashboard({ onNavigate }: { onNavigate: (p: 'properties' | 'conversations') => void }) {
  const [health, setHealth] = useState<Health | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.health().then(setHealth),
      api.properties.list().then(setProperties),
      api.conversations.list().then(setConversations),
    ]).catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    Promise.all(properties.map((p) => api.reservations.list(p.id)))
      .then((results) => setReservations(results.flat()))
      .catch(() => {});
  }, [properties]);

  const handleSyncAll = async () => {
    setSyncing(true);
    try { await api.sync.all(); } catch { /* errors logged in backend */ }
    finally { setSyncing(false); }
  };

  const needsAttention = conversations.filter(
    (c) => c.status === 'awaiting_host' || c.status === 'pending',
  );
  const activeHost = conversations.filter((c) => c.status === 'host');

  return (
    <div className="space-y-7 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-400 mt-0.5">Overview of your AI receptionist activity</p>
        </div>
        <button
          onClick={handleSyncAll}
          disabled={syncing}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
        >
          <svg className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {syncing ? 'Syncing…' : 'Sync All Properties'}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {needsAttention.length > 0 && (
        <div
          className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-5 py-3.5 cursor-pointer hover:bg-amber-100 transition-colors"
          onClick={() => onNavigate('conversations')}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-900">
                {needsAttention.length} conversation{needsAttention.length > 1 ? 's' : ''} need{needsAttention.length === 1 ? 's' : ''} your attention
              </p>
              <p className="text-xs text-amber-700">Guest waiting for host response</p>
            </div>
          </div>
          <span className="text-amber-600 text-sm font-medium">View →</span>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="Properties"
          value={properties.length}
          sub="configured"
          color="bg-indigo-50"
          icon={<svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V10.5z" /><path strokeLinecap="round" strokeLinejoin="round" d="M9 21V12h6v9" /></svg>}
        />
        <StatCard
          label="Active stays"
          value={reservations.filter((r) => r.status === 'confirmed').length}
          sub="confirmed reservations"
          color="bg-emerald-50"
          icon={<svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>}
        />
        <StatCard
          label="Conversations"
          value={conversations.length}
          sub={activeHost.length > 0 ? `${activeHost.length} host active` : 'all AI-handled'}
          color="bg-violet-50"
          icon={<svg className="w-5 h-5 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" /></svg>}
        />
      </div>

      <div className="grid grid-cols-5 gap-4">
        {health && (
          <div className="col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <p className="text-sm font-semibold text-slate-700 mb-1">System Health</p>
            <p className="text-xs text-slate-400 mb-4">All backend dependencies</p>
            <div>
              {Object.entries(health.dependencies).map(([name, dep]) => (
                <HealthRow key={name} name={name} dep={dep} />
              ))}
            </div>
          </div>
        )}

        <div className={`${health ? 'col-span-3' : 'col-span-5'} bg-white rounded-2xl border border-slate-100 shadow-sm p-5`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-semibold text-slate-700">Recent Conversations</p>
              <p className="text-xs text-slate-400 mt-0.5">Latest guest activity</p>
            </div>
            <button
              onClick={() => onNavigate('conversations')}
              className="text-xs text-indigo-600 font-medium hover:text-indigo-800 transition-colors"
            >
              View all →
            </button>
          </div>
          {conversations.length === 0 ? (
            <div className="py-8 text-center">
              <svg className="w-8 h-8 text-slate-200 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
              </svg>
              <p className="text-sm text-slate-400">No conversations yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {conversations.slice(0, 5).map((c) => (
                <div key={c.id} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 text-xs font-semibold text-slate-500">
                    {c.userPhone.replace('whatsapp:+', '').slice(-2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{c.userPhone.replace('whatsapp:', '')}</p>
                    <p className="text-xs text-slate-400 truncate">{c.messages?.[0]?.content ?? 'No messages'}</p>
                  </div>
                  <span className="text-xs text-slate-400 flex-shrink-0">{new Date(c.createdAt).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
