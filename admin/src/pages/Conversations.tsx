import { useEffect, useState } from 'react';
import { api, Conversation, ConversationStatus } from '../api';

const STATUS_CONFIG: Record<ConversationStatus, { label: string; dot: string; bg: string; text: string }> = {
  ai:            { label: 'AI handling',    dot: 'bg-emerald-400', bg: 'bg-emerald-50',  text: 'text-emerald-700' },
  awaiting_host: { label: 'Awaiting host',  dot: 'bg-amber-400',   bg: 'bg-amber-50',    text: 'text-amber-700'   },
  host:          { label: 'Host active',    dot: 'bg-blue-400',    bg: 'bg-blue-50',     text: 'text-blue-700'    },
  pending:       { label: 'Guest waiting',  dot: 'bg-orange-400',  bg: 'bg-orange-50',   text: 'text-orange-700'  },
};

function StatusBadge({ status }: { status: ConversationStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function Avatar({ phone }: { phone: string }) {
  const initials = phone.replace('whatsapp:+', '').replace('+', '').slice(-2);
  return (
    <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 text-xs font-bold text-indigo-600">
      {initials}
    </div>
  );
}

export function Conversations() {
  const [list, setList] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionBusy, setActionBusy] = useState(false);

  const loadList = () =>
    api.conversations.list()
      .then(setList)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));

  useEffect(() => { void loadList(); }, []);

  const handleSelect = async (id: string) => {
    try { setSelected(await api.conversations.get(id)); }
    catch (e) { setError(String(e)); }
  };

  const handleTakeover = async () => {
    if (!selected) return;
    setActionBusy(true);
    try {
      await api.conversations.takeover(selected.id);
      setSelected(await api.conversations.get(selected.id));
      void loadList();
    } catch (e) { setError(String(e)); }
    finally { setActionBusy(false); }
  };

  const handleHandback = async () => {
    if (!selected) return;
    setActionBusy(true);
    try {
      await api.conversations.handback(selected.id);
      setSelected(await api.conversations.get(selected.id));
      void loadList();
    } catch (e) { setError(String(e)); }
    finally { setActionBusy(false); }
  };

  const handleDeleteGuestData = async () => {
    if (!selected) return;
    if (!confirm(`Permanently erase all personal data for ${selected.userPhone}? This cannot be undone.`)) return;
    setActionBusy(true);
    try {
      await api.guests.deleteData(selected.userPhone);
      setSelected(null);
      void loadList();
    } catch (e) { setError(String(e)); }
    finally { setActionBusy(false); }
  };

  if (selected) {
    const isHostActive = selected.status === 'host' || selected.status === 'pending' || selected.status === 'awaiting_host';
    const displayPhone = selected.userPhone.replace('whatsapp:', '');

    return (
      <div className="max-w-2xl space-y-4">
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
            {error}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelected(null)}
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
            Back
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <Avatar phone={selected.userPhone} />
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-slate-900">{displayPhone}</p>
                  <StatusBadge status={selected.status} />
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selected.property?.name ?? 'Unknown property'} · {new Date(selected.createdAt).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="flex gap-2 flex-shrink-0">
              {!isHostActive ? (
                <button
                  onClick={handleTakeover}
                  disabled={actionBusy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
                  Take over
                </button>
              ) : (
                <button
                  onClick={handleHandback}
                  disabled={actionBusy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
                  Hand back to AI
                </button>
              )}
              <button
                onClick={handleDeleteGuestData}
                disabled={actionBusy}
                title="Erase guest personal data (GDPR)"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                Erase data
              </button>
            </div>
          </div>
        </div>

        {selected.status === 'awaiting_host' && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3.5">
            <svg className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <div className="text-sm text-amber-800">
              <strong>Waiting for host.</strong> Host was notified on WhatsApp.
              They can reply <code className="bg-amber-100 px-1 py-0.5 rounded text-xs">JOIN</code> to assist,
              or <code className="bg-amber-100 px-1 py-0.5 rounded text-xs ml-1">SKIP</code> to let AI retry.
            </div>
          </div>
        )}
        {(selected.status === 'host' || selected.status === 'pending') && (
          <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3.5">
            <svg className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
            <div className="text-sm text-blue-800">
              <strong>Host active.</strong> All host WhatsApp replies are forwarded to the guest.
              Host sends <code className="bg-blue-100 px-1 py-0.5 rounded text-xs">DONE</code> on WhatsApp to hand back to AI.
            </div>
          </div>
        )}

        <div className="space-y-2">
          {selected.messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-sm rounded-2xl px-4 py-3 shadow-sm ${
                m.role === 'user'
                  ? 'bg-white border border-slate-100 text-slate-800 rounded-bl-sm'
                  : 'bg-indigo-600 text-white rounded-br-sm'
              }`}>
                <p className="text-sm leading-relaxed">{m.content}</p>
                <p className={`text-xs mt-1.5 ${m.role === 'user' ? 'text-slate-400' : 'text-indigo-300'}`}>
                  {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
          {selected.messages.length === 0 && (
            <div className="py-12 text-center">
              <svg className="w-8 h-8 text-slate-200 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" /></svg>
              <p className="text-sm text-slate-400">No messages yet</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Conversations</h1>
        <p className="text-sm text-slate-400 mt-0.5">All guest interactions across your properties</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16">
          <svg className="w-5 h-5 text-indigo-400 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
        </div>
      )}

      {!loading && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {list.length === 0 ? (
            <div className="py-16 text-center">
              <svg className="w-10 h-10 text-slate-200 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" /></svg>
              <p className="text-sm font-medium text-slate-500">No conversations yet</p>
              <p className="text-xs text-slate-400 mt-1">They'll appear here when guests start messaging</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100">
                <tr className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="px-5 py-3.5 text-left">Guest</th>
                  <th className="px-5 py-3.5 text-left">Property</th>
                  <th className="px-5 py-3.5 text-left">Status</th>
                  <th className="px-5 py-3.5 text-left">Last message</th>
                  <th className="px-5 py-3.5 text-left">Started</th>
                  <th className="px-5 py-3.5 w-16" />
                </tr>
              </thead>
              <tbody>
                {list.map((c, i) => (
                  <tr
                    key={c.id}
                    onClick={() => handleSelect(c.id)}
                    className={`cursor-pointer hover:bg-slate-50 transition-colors ${i > 0 ? 'border-t border-slate-50' : ''}`}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar phone={c.userPhone} />
                        <span className="font-medium text-slate-800">{c.userPhone.replace('whatsapp:', '')}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-500">{c.property?.name ?? '—'}</td>
                    <td className="px-5 py-3.5"><StatusBadge status={c.status ?? 'ai'} /></td>
                    <td className="px-5 py-3.5 text-slate-400 max-w-xs truncate">{c.messages?.[0]?.content ?? '—'}</td>
                    <td className="px-5 py-3.5 text-slate-400 whitespace-nowrap">{new Date(c.createdAt).toLocaleDateString()}</td>
                    <td className="px-5 py-3.5">
                      <svg className="w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
