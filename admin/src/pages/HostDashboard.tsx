import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { HostLayout } from '../components/HostLayout';

type Property = {
  id: string;
  name: string;
  conversationCount: number;
};

type ConversationSummary = {
  id: string;
  guestName: string;
  guestPhone: string;
  status: 'ai' | 'awaiting_host' | 'host' | 'pending';
  activeHostName: string | null;
  createdAt: string;
  lastMessage: string;
};

type Message = {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  from: string;
  senderName: string; // enriched by backend
  createdAt: string;
};

type ConversationDetail = {
  id: string;
  guestPhone: string;
  guestName: string;
  status: 'ai' | 'awaiting_host' | 'host' | 'pending';
  activeHostName: string | null;
  activeHostPhone: string | null;
  handoffTriggeredAt: string | null;
  messages: Message[];
};

type Tab = 'dashboard' | 'properties' | 'conversations';
type View = 'main' | 'propertyDetail' | 'conversationDetail';

function getDayLabel(date: Date, now: Date): string {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((today.getTime() - msgDate.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return msgDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function groupMessagesByDay(messages: Message[]) {
  const now = new Date();
  const groups: { label: string; messages: Message[] }[] = [];
  let currentDay = '';
  for (const msg of messages) {
    const label = getDayLabel(new Date(msg.createdAt), now);
    if (label !== currentDay) {
      currentDay = label;
      groups.push({ label, messages: [] });
    }
    groups[groups.length - 1].messages.push(msg);
  }
  return groups;
}

const STATUS_LABELS: Record<string, string> = {
  ai: 'AI Handling',
  awaiting_host: 'Awaiting',
  host: 'Host Active',
  pending: 'Host Active',
};
const STATUS_COLORS: Record<string, string> = {
  ai: 'bg-blue-100 text-blue-700',
  awaiting_host: 'bg-yellow-100 text-yellow-700',
  host: 'bg-teal-100 text-teal-700',
  pending: 'bg-teal-100 text-teal-700',
};

export function HostDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [view, setView] = useState<View>('main');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);

  const [properties, setProperties] = useState<Property[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [propertyDetail, setPropertyDetail] = useState<any>(null);
  const [conversationDetail, setConversationDetail] = useState<ConversationDetail | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  const conversationDetailRef = useRef<ConversationDetail | null>(null);
  conversationDetailRef.current = conversationDetail;

  const auth = JSON.parse(localStorage.getItem('host_auth') || '{}');

  useEffect(() => {
    if (!auth.phone) { navigate('/host/login'); return; }
    fetchProperties();
  }, []);

  // Poll conversation detail every 8s while viewing it
  useEffect(() => {
    if (view !== 'conversationDetail' || !conversationDetailRef.current) return;
    const id = setInterval(() => {
      if (conversationDetailRef.current) {
        refreshConversationDetail(conversationDetailRef.current.id);
      }
    }, 8000);
    return () => clearInterval(id);
  }, [view]);

  const fetchProperties = async () => {
    try {
      const res = await fetch('http://localhost:3000/host/properties', { credentials: 'include' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setProperties(data);
      if (data.length > 0) {
        setSelectedPropertyId(data[0].id);
        await fetchConversations(data[0].id);
      }
    } catch {
      setError('Failed to load properties');
    } finally {
      setLoading(false);
    }
  };

  const fetchConversations = async (propertyId: string) => {
    try {
      const res = await fetch(`http://localhost:3000/host/properties/${propertyId}/conversations`, { credentials: 'include' });
      if (!res.ok) throw new Error();
      setConversations(await res.json());
    } catch {
      setError('Failed to load conversations');
    }
  };

  const fetchPropertyDetail = async (propertyId: string) => {
    try {
      const res = await fetch(`http://localhost:3000/host/properties/${propertyId}`, { credentials: 'include' });
      if (!res.ok) throw new Error();
      setPropertyDetail(await res.json());
      setView('propertyDetail');
    } catch {
      setError('Failed to load property');
    }
  };

  const fetchConversationDetail = async (conversationId: string) => {
    try {
      const res = await fetch(`http://localhost:3000/host/conversations/${conversationId}`, { credentials: 'include' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setConversationDetail(data);
      setView('conversationDetail');
    } catch {
      setError('Failed to load conversation');
    }
  };

  const refreshConversationDetail = async (conversationId: string) => {
    try {
      const res = await fetch(`http://localhost:3000/host/conversations/${conversationId}`, { credentials: 'include' });
      if (res.ok) setConversationDetail(await res.json());
    } catch {}
  };

  const handleTakeOver = async () => {
    if (!conversationDetail) return;
    try {
      const res = await fetch(`http://localhost:3000/host/conversations/${conversationDetail.id}/takeover`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error();
      await refreshConversationDetail(conversationDetail.id);
    } catch {
      setError('Failed to take over conversation');
    }
  };

  const handleHandBackToAI = async () => {
    if (!conversationDetail) return;
    try {
      const res = await fetch(`http://localhost:3000/host/conversations/${conversationDetail.id}/handback`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error();
      await refreshConversationDetail(conversationDetail.id);
      if (selectedPropertyId) fetchConversations(selectedPropertyId);
    } catch {
      setError('Failed to hand back conversation');
    }
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !conversationDetail) return;
    setSendingMessage(true);
    try {
      const res = await fetch(`http://localhost:3000/host/conversations/${conversationDetail.id}/messages`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: messageInput }),
      });
      if (!res.ok) throw new Error();
      setMessageInput('');
      await refreshConversationDetail(conversationDetail.id);
    } catch {
      setError('Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  };

  const goBack = () => {
    setView('main');
    setPropertyDetail(null);
    setConversationDetail(null);
    setMessageInput('');
    setError('');
  };

  // ─── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <HostLayout hostName={auth.name} hostPhone={auth.phone} activeTab={activeTab} onTabChange={setActiveTab}>
        <div className="flex items-center justify-center py-20 text-slate-400">Loading...</div>
      </HostLayout>
    );
  }

  // ─── Property Detail (read-only) ──────────────────────────────────────────

  if (view === 'propertyDetail' && propertyDetail) {
    return (
      <HostLayout hostName={auth.name} hostPhone={auth.phone} activeTab={activeTab} onTabChange={setActiveTab}>
        <div className="w-full space-y-6 p-6">
          <button onClick={goBack} className="text-teal-600 hover:text-teal-700 text-sm font-medium">← Back</button>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h1 className="text-2xl font-bold text-slate-900 mb-2">{propertyDetail.name}</h1>
            {propertyDetail.description && <p className="text-slate-600 mb-4">{propertyDetail.description}</p>}
            <div className="grid grid-cols-2 gap-4">
              {propertyDetail.address && (
                <div><p className="text-xs font-semibold text-slate-500 uppercase">Address</p><p className="text-slate-900">{propertyDetail.address}</p></div>
              )}
              {propertyDetail.checkInTime && (
                <div><p className="text-xs font-semibold text-slate-500 uppercase">Check-in</p><p className="text-slate-900">{propertyDetail.checkInTime}</p></div>
              )}
              {propertyDetail.checkOutTime && (
                <div><p className="text-xs font-semibold text-slate-500 uppercase">Check-out</p><p className="text-slate-900">{propertyDetail.checkOutTime}</p></div>
              )}
            </div>
          </div>

          {propertyDetail.amenities?.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Amenities</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {propertyDetail.amenities.map((a: string, i: number) => (
                  <div key={i} className="flex items-center gap-2 p-3 bg-teal-50 rounded-lg border border-teal-100">
                    <span className="text-teal-600 text-sm">✓</span>
                    <span className="text-sm text-slate-900">{a}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {propertyDetail.policies?.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-4">House Rules</h2>
              <div className="space-y-2">
                {propertyDetail.policies.map((p: string, i: number) => (
                  <div key={i} className="flex gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-slate-400">•</span>
                    <span className="text-sm text-slate-900">{p}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </HostLayout>
    );
  }

  // ─── Conversation Detail ──────────────────────────────────────────────────

  if (view === 'conversationDetail' && conversationDetail) {
    const isHostHandling = conversationDetail.status === 'host' || conversationDetail.status === 'pending';
    // Dashboard input only when this host took over from the dashboard (handoffTriggeredAt cleared).
    // WhatsApp-initiated host sessions keep handoffTriggeredAt set → dashboard stays locked/read-only.
    const isDashboardTakeover = isHostHandling && !conversationDetail.handoffTriggeredAt;
    const isThisHostHandling = isDashboardTakeover && conversationDetail.activeHostPhone === auth.phone;
    const isAwaiting = conversationDetail.status === 'awaiting_host';
    const isAI = conversationDetail.status === 'ai';

    const groupedMessages = groupMessagesByDay(conversationDetail.messages);

    return (
      <HostLayout hostName={auth.name} hostPhone={auth.phone} activeTab={activeTab} onTabChange={setActiveTab}>
        {/* Full-height flex column — header pinned top, messages scroll, input pinned bottom */}
        <div className="flex flex-col h-full overflow-hidden bg-slate-50">

          {/* ── Header ── */}
          <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 flex-shrink-0">
            <button onClick={goBack} className="text-slate-400 hover:text-slate-600 flex-shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-slate-900 truncate">{conversationDetail.guestName || conversationDetail.guestPhone}</h1>
              <p className="text-xs text-slate-400 truncate">{conversationDetail.guestPhone}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                isAwaiting ? 'bg-yellow-100 text-yellow-700' : isHostHandling ? 'bg-teal-100 text-teal-700' : 'bg-blue-100 text-blue-700'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isAwaiting ? 'bg-yellow-500' : isHostHandling ? 'bg-teal-500' : 'bg-blue-500'}`} />
                {isAwaiting ? 'Awaiting Host' : isHostHandling ? `${conversationDetail.activeHostName ?? 'Host'} handling` : 'AI Handling'}
              </span>
              {/* Take Over — only shown when not yet host-handled; greyed for awaiting_host */}
              {!isHostHandling && (
                <button
                  onClick={!isAwaiting ? handleTakeOver : undefined}
                  disabled={isAwaiting}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                    isAwaiting
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'bg-teal-600 text-white hover:bg-teal-700'
                  }`}
                >
                  Take Over
                </button>
              )}
              {/* Give back to AI — only for the host currently handling */}
              {isThisHostHandling && (
                <button
                  onClick={handleHandBackToAI}
                  className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-200 transition-all whitespace-nowrap"
                >
                  Give back to AI
                </button>
              )}
            </div>
          </div>

          {/* ── Context banners ── */}
          {(error || isAwaiting || isAI) && (
            <div className="px-4 pt-3 space-y-2 flex-shrink-0">
              {error && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-700">{error}</div>
              )}
              {isAwaiting && (
                <div className="p-3 bg-yellow-50 border border-yellow-100 rounded-lg text-xs text-yellow-800">
                  Hosts have been notified via WhatsApp. They will respond directly to the guest.
                </div>
              )}
              {isAI && (
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-800">
                  AI is handling this conversation. Click <strong>Take Over</strong> to respond as a host.
                </div>
              )}
            </div>
          )}

          {/* ── Messages — scrollable region ── */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {groupedMessages.length === 0 ? (
              <p className="text-center text-slate-400 py-8 text-sm">No messages yet</p>
            ) : (
              groupedMessages.map((group, gi) => (
                <div key={gi} className="space-y-3">
                  <div className="flex items-center gap-3 my-2">
                    <div className="flex-1 border-t border-slate-200" />
                    <span className="text-xs text-slate-400 font-medium">{group.label}</span>
                    <div className="flex-1 border-t border-slate-200" />
                  </div>
                  {group.messages.map((msg) => {
                    const isGuest = msg.role === 'user';
                    const time = new Date(msg.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
                    return (
                      <div key={msg.id} className={`flex ${isGuest ? 'justify-start' : 'justify-end'}`}>
                        {isGuest ? (
                          <div className="max-w-[65%]">
                            <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-2.5 shadow-sm">
                              <p className="text-sm text-slate-900 leading-relaxed">{msg.content}</p>
                            </div>
                            <p className="text-xs text-slate-400 mt-1 px-1">{time}</p>
                          </div>
                        ) : (
                          <div className="max-w-[65%]">
                            <div className="bg-teal-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 shadow-sm">
                              <p className="text-xs font-semibold mb-1 opacity-75">{msg.senderName}</p>
                              <p className="text-sm leading-relaxed">{msg.content}</p>
                            </div>
                            <p className="text-xs text-slate-400 mt-1 px-1 text-right">{time}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* ── Message input — only for the host who is actively handling ── */}
          {isThisHostHandling && (
            <div className="bg-white border-t border-slate-200 px-4 py-3 flex-shrink-0">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                  placeholder="Type a message to the guest…"
                  disabled={sendingMessage}
                  className="flex-1 px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim() || sendingMessage}
                  className="px-5 py-2.5 bg-teal-600 text-white text-sm font-semibold rounded-xl hover:bg-teal-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-all"
                >
                  {sendingMessage ? '…' : 'Send'}
                </button>
              </div>
            </div>
          )}
        </div>
      </HostLayout>
    );
  }

  // ─── Main View (Dashboard / Properties / Conversations tabs) ──────────────

  return (
    <HostLayout hostName={auth.name} hostPhone={auth.phone} activeTab={activeTab} onTabChange={(tab) => {
      setActiveTab(tab);
      setError('');
    }}>
      <div className="w-full space-y-6 p-6">
        {error && (
          <div className="bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
        )}

        {/* ── DASHBOARD TAB ─────────────────────────────────────────── */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
              <p className="text-sm text-slate-400 mt-0.5">Overview of your properties</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h2 className="text-base font-bold text-slate-900 mb-4">Your Properties</h2>
                <div className="space-y-2">
                  {properties.map((prop) => (
                    <button
                      key={prop.id}
                      onClick={() => { setSelectedPropertyId(prop.id); fetchConversations(prop.id); }}
                      className={`w-full text-left px-4 py-3 rounded-lg transition text-sm ${
                        selectedPropertyId === prop.id
                          ? 'bg-teal-50 border border-teal-200 text-teal-900'
                          : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="font-semibold">{prop.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{prop.conversationCount} conversations (30d)</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-2">
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                    <div>
                      <h2 className="font-bold text-slate-900">Recent Conversations</h2>
                      <p className="text-xs text-slate-500 mt-0.5">Click to open</p>
                    </div>
                  </div>
                  {conversations.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-sm">No conversations yet</div>
                  ) : (
                    <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                      {conversations.slice(0, 5).map((conv) => (
                        <ConversationRow key={conv.id} conv={conv} onClick={() => fetchConversationDetail(conv.id)} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── PROPERTIES TAB ────────────────────────────────────────── */}
        {activeTab === 'properties' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Properties</h1>
              <p className="text-sm text-slate-400 mt-0.5">Read-only view of your properties</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {properties.map((prop) => (
                <button
                  key={prop.id}
                  onClick={() => fetchPropertyDetail(prop.id)}
                  className="bg-white rounded-xl p-6 border border-slate-200 hover:border-teal-300 hover:shadow-md transition text-left"
                >
                  <h3 className="font-bold text-slate-900 mb-3">{prop.name}</h3>
                  <p className="text-2xl font-bold text-teal-600">{prop.conversationCount}</p>
                  <p className="text-xs text-slate-500">conversations (30d)</p>
                  <p className="mt-4 text-teal-600 text-sm font-medium">View Details →</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── CONVERSATIONS TAB ─────────────────────────────────────── */}
        {activeTab === 'conversations' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Conversations</h1>
              <p className="text-sm text-slate-400 mt-0.5">All conversations from your properties</p>
            </div>

            {/* Property filter */}
            <div className="flex flex-wrap gap-2">
              {properties.map((prop) => (
                <button
                  key={prop.id}
                  onClick={() => { setSelectedPropertyId(prop.id); fetchConversations(prop.id); }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    selectedPropertyId === prop.id
                      ? 'bg-teal-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {prop.name}
                </button>
              ))}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {conversations.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">No conversations for this property</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {conversations.map((conv) => (
                    <ConversationRow key={conv.id} conv={conv} onClick={() => fetchConversationDetail(conv.id)} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </HostLayout>
  );
}

function ConversationRow({ conv, onClick }: { conv: ConversationSummary; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full text-left p-4 hover:bg-slate-50 transition">
      <div className="flex justify-between items-start gap-4">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900">{conv.guestName}</p>
          <p className="text-xs text-slate-500">{conv.guestPhone}</p>
          <p className="text-sm text-slate-600 mt-1 truncate">{conv.lastMessage}</p>
        </div>
        <div className="flex-shrink-0 text-right">
          <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${STATUS_COLORS[conv.status] ?? 'bg-slate-100 text-slate-600'}`}>
            {STATUS_LABELS[conv.status] ?? conv.status}
          </span>
          <p className="text-xs text-slate-400 mt-1.5">{new Date(conv.createdAt).toLocaleDateString()}</p>
        </div>
      </div>
    </button>
  );
}
