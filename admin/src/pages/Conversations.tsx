import { useEffect, useRef, useState } from 'react';
import { api, Conversation, ConversationStatus } from '../api';

const STATUS_CONFIG: Record<ConversationStatus, { label: string; dot: string; bg: string; text: string }> = {
  ai:            { label: 'AI handling',    dot: 'bg-emerald-400', bg: 'bg-emerald-50',  text: 'text-emerald-700' },
  awaiting_host: { label: 'Awaiting host',  dot: 'bg-amber-400',   bg: 'bg-amber-50',    text: 'text-amber-700'   },
  host:          { label: 'Host active',    dot: 'bg-blue-400',    bg: 'bg-blue-50',     text: 'text-blue-700'    },
  pending:       { label: 'Guest waiting',  dot: 'bg-orange-400',  bg: 'bg-orange-50',   text: 'text-orange-700'  },
};

function getDayLabel(date: Date, now: Date): string {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffTime = today.getTime() - messageDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return messageDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function groupMessagesByDay(messages: any[]) {
  const now = new Date();
  const groups: { label: string; messages: any[] }[] = [];
  let currentDay = '';

  messages.forEach((msg) => {
    const msgDate = new Date(msg.createdAt);
    const dayLabel = getDayLabel(msgDate, now);

    if (dayLabel !== currentDay) {
      currentDay = dayLabel;
      groups.push({ label: dayLabel, messages: [] });
    }

    groups[groups.length - 1].messages.push(msg);
  });

  return groups;
}

function StatusBadge({ status }: { status: ConversationStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function Avatar({ name, phone }: { name?: string | null; phone: string }) {
  const initials = name
    ? name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
    : phone.replace('whatsapp:+', '').replace('+', '').slice(-2);
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

  // Keep a ref so the polling interval can always see the latest selected state
  const selectedRef = useRef<Conversation | null>(null);
  selectedRef.current = selected;

  const loadList = () =>
    api.conversations.list()
      .then(setList)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));

  useEffect(() => { void loadList(); }, []);

  // Poll every 10 s — refresh the detail if one is open, otherwise refresh the list
  useEffect(() => {
    const interval = setInterval(() => {
      if (selectedRef.current) {
        void api.conversations.get(selectedRef.current.id)
          .then(setSelected)
          .catch(() => {});
      } else {
        void api.conversations.list()
          .then(setList)
          .catch(() => {});
      }
    }, 10_000);
    return () => clearInterval(interval);
  }, []);

  const handleSelect = async (id: string) => {
    try { setSelected(await api.conversations.get(id)); }
    catch (e) { setError(String(e)); }
  };

  if (selected) {
    const displayPhone = selected.userPhone.replace('whatsapp:', '');
    const displayName = selected.guestName;

    return (
      <div className="grid grid-cols-3 gap-6 h-full">
        {/* List Column */}
        <div className="col-span-1 overflow-auto">
          <div className="space-y-2">
            <button
              onClick={() => setSelected(null)}
              className="w-full text-left inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors mb-4"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
              Back to list
            </button>
            {list.map((conv) => (
              <div
                key={conv.id}
                onClick={() => handleSelect(conv.id)}
                className={`p-3 rounded-lg cursor-pointer transition ${
                  selected?.id === conv.id
                    ? 'bg-indigo-100 border border-indigo-300'
                    : 'bg-slate-50 hover:bg-slate-100 border border-slate-100'
                }`}
              >
                <p className="font-semibold text-sm text-slate-900">{conv.guestName}</p>
                <p className="text-xs text-slate-500 mt-1">{new Date(conv.createdAt).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Detail Column */}
        <div className="col-span-2 overflow-auto space-y-4">
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
            {error}
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <Avatar name={selected.guestName} phone={selected.userPhone} />
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-slate-900">{displayName}</p>
                  <StatusBadge status={selected.status} />
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selected.guestName && <span className="mr-2">{displayPhone}</span>}
                  {selected.property?.name ?? 'Unknown property'} · {new Date(selected.createdAt).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="flex gap-2 flex-shrink-0" />
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
              <strong>Host active{selected.activeHostName ? ` — ${selected.activeHostName}` : ''}.</strong> Replies are forwarded to the guest via WhatsApp.
            </div>
          </div>
        )}

        <div className="space-y-4">
          {selected.messages.length === 0 ? (
            <div className="py-12 text-center">
              <svg className="w-8 h-8 text-slate-200 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" /></svg>
              <p className="text-sm text-slate-400">No messages yet</p>
            </div>
          ) : (
            groupMessagesByDay(selected.messages).map((group, groupIdx) => (
              <div key={groupIdx} className="space-y-3">
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 border-t border-slate-300"></div>
                  <span className="text-xs font-medium text-slate-500 px-2">{group.label}</span>
                  <div className="flex-1 border-t border-slate-300"></div>
                </div>

                {group.messages.map((m) => {
                  const isGuest = m.role === 'user';
                  const msgTime = new Date(m.createdAt).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true,
                  });

                  const getSenderName = () => m.senderName ?? 'AI';

                  return (
                    <div key={m.id} className={`flex ${isGuest ? 'justify-start' : 'justify-end'}`}>
                      {isGuest ? (
                        <div className="max-w-xs">
                          <div className="bg-white border border-slate-200 rounded-lg px-4 py-2">
                            <p className="text-sm text-slate-900">{m.content}</p>
                          </div>
                          <p className="text-xs text-slate-500 mt-1 px-4">{msgTime}</p>
                        </div>
                      ) : (
                        <div className="max-w-xs">
                          <div className="bg-indigo-600 text-white rounded-lg px-4 py-2">
                            <p className="text-xs font-semibold mb-1 opacity-90">{getSenderName()}</p>
                            <p className="text-sm">{m.content}</p>
                          </div>
                          <p className="text-xs text-slate-500 mt-1 px-4 text-right">{msgTime}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Conversations</h1>
          <p className="text-sm text-slate-400 mt-0.5">All guest interactions · refreshes every 10 s</p>
        </div>
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
                        <Avatar name={c.guestName} phone={c.userPhone} />
                        <div>
                          <p className="font-medium text-slate-800">
                            {c.guestName}
                          </p>
                          {c.guestName && (
                            <p className="text-xs text-slate-400">{c.userPhone.replace('whatsapp:', '')}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-500">{c.property?.name ?? '—'}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-col gap-0.5">
                        <StatusBadge status={c.status ?? 'ai'} />
                        {c.activeHostName && (
                          <span className="text-xs text-slate-400 pl-0.5">{c.activeHostName}</span>
                        )}
                      </div>
                    </td>
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
