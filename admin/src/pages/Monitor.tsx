import { useEffect, useMemo, useRef, useState } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
} from 'recharts';
import { api, Property, Reservation } from '../api';

const AI_COST_PER_MSG = 0.004;
const TWILIO_COST_PER_MSG = 0.005;

const STATUS_LABELS: Record<string, string> = {
  ai: 'AI Handling',
  awaiting_host: 'Awaiting Host',
  host: 'Host Active',
  pending: 'Pending',
};

const STATUS_COLORS: Record<string, string> = {
  ai: '#6366f1',
  awaiting_host: '#f59e0b',
  host: '#10b981',
  pending: '#94a3b8',
};

const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#94a3b8'];

type TimeRange = '7d' | '30d' | '90d' | 'all' | 'custom';

const TIME_OPTIONS: { key: TimeRange; label: string; days: number | null }[] = [
  { key: '7d', label: 'Last 7 days', days: 7 },
  { key: '30d', label: 'Last 30 days', days: 30 },
  { key: '90d', label: 'Last 90 days', days: 90 },
  { key: 'all', label: 'All time', days: null },
  { key: 'custom', label: 'Custom range', days: null },
];

type ConvStat = {
  id: string;
  status: string;
  userPhone: string;
  guestName: string | null;
  propertyId: string;
  propertyName: string | null;
  aiMessages: number;
  hostMessages: number;
  guestMessages: number;
  totalMessages: number;
  hostNames: string[];
  firstMessageAt: string | null;
  lastMessageAt: string | null;
  messagesByDay: Record<string, { ai: number; host: number; guest: number }>;
};

function StatCard({ label, value, sub, color, icon }: {
  label: string; value: string | number; sub?: string; color: string; icon: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
          {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
        </div>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">{children}</p>;
}

// Suppress recharts SVG focus outline
const chartStyle = { outline: 'none' };

export function Monitor() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [stats, setStats] = useState<ConvStat[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [initialLoading, setInitialLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [error, setError] = useState('');
  const selectedIdRef = useRef<string | null>(null);

  const load = async (propertyId: string | null = selectedId) => {
    setPolling(true);
    setError('');
    try {
      const [props, convStats] = await Promise.all([
        api.properties.list(),
        api.analytics.get(propertyId) as Promise<ConvStat[]>,
      ]);
      setProperties(props);
      setStats(convStats);
      const allRes = await Promise.all(props.map((p) => api.reservations.list(p.id)));
      setReservations(allRes.flat());
      setLastUpdated(new Date());
      setSecondsAgo(0);
    } catch (e) {
      setError(String(e));
    } finally {
      setInitialLoading(false);
      setPolling(false);
    }
  };

  // Initial load
  useEffect(() => { void load(null); }, []);

  // Auto-poll every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      void load(selectedIdRef.current);
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  // "X seconds ago" ticker
  useEffect(() => {
    if (!lastUpdated) return;
    const tick = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastUpdated.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(tick);
  }, [lastUpdated]);

  const handleSelectProperty = (id: string | null) => {
    selectedIdRef.current = id;
    setSelectedId(id);
    void load(id);
  };

  // ── Time range cutoff ─────────────────────────────────────────────────────
  const { sinceDate, untilDate } = useMemo(() => {
    if (timeRange === 'custom') {
      return {
        sinceDate: customFrom ? new Date(customFrom) : null,
        untilDate: customTo ? new Date(customTo + 'T23:59:59') : null,
      };
    }
    const opt = TIME_OPTIONS.find((o) => o.key === timeRange);
    if (!opt?.days) return { sinceDate: null, untilDate: null };
    const d = new Date();
    d.setDate(d.getDate() - opt.days);
    d.setHours(0, 0, 0, 0);
    return { sinceDate: d, untilDate: null };
  }, [timeRange, customFrom, customTo]);

  // ── Apply time filter to stats using messagesByDay ────────────────────────
  const filteredStats = useMemo(() => {
    if (!sinceDate && !untilDate) return stats;
    const sinceStr = sinceDate ? sinceDate.toISOString().slice(0, 10) : null;
    const untilStr = untilDate ? untilDate.toISOString().slice(0, 10) : null;
    return stats
      .map((c) => {
        const days = Object.entries(c.messagesByDay).filter(([day]) =>
          (!sinceStr || day >= sinceStr) && (!untilStr || day <= untilStr),
        );
        const ai = days.reduce((s, [, b]) => s + b.ai, 0);
        const host = days.reduce((s, [, b]) => s + b.host, 0);
        const guest = days.reduce((s, [, b]) => s + b.guest, 0);
        return { ...c, aiMessages: ai, hostMessages: host, guestMessages: guest, totalMessages: ai + host + guest };
      })
      .filter((c) => c.totalMessages > 0);
  }, [stats, sinceDate, untilDate]);

  // ── Filter reservations by time + property ────────────────────────────────
  const filteredRes = useMemo(() => {
    let res = selectedId ? reservations.filter((r) => r.propertyId === selectedId) : reservations;
    if (sinceDate) res = res.filter((r) => new Date(r.checkIn) >= sinceDate);
    if (untilDate) res = res.filter((r) => new Date(r.checkIn) <= untilDate);
    return res;
  }, [reservations, selectedId, sinceDate, untilDate]);

  // ── Aggregates ────────────────────────────────────────────────────────────
  const totalAI = filteredStats.reduce((s, c) => s + c.aiMessages, 0);
  const totalHost = filteredStats.reduce((s, c) => s + c.hostMessages, 0);
  const totalGuest = filteredStats.reduce((s, c) => s + c.guestMessages, 0);
  const totalMsgs = totalAI + totalHost + totalGuest;
  const aiCost = totalAI * AI_COST_PER_MSG;
  const twilioCost = (totalAI + totalHost) * TWILIO_COST_PER_MSG;

  const messagePie = [
    { name: 'AI', value: totalAI },
    { name: 'Host', value: totalHost },
    { name: 'Guest', value: totalGuest },
  ].filter((d) => d.value > 0);

  const statusCounts = Object.entries(
    filteredStats.reduce<Record<string, number>>((acc, c) => {
      acc[c.status] = (acc[c.status] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([status, count]) => ({ name: STATUS_LABELS[status] ?? status, value: count, status }));

  const resByStatus = [
    { name: 'Confirmed', value: filteredRes.filter((r) => r.status === 'confirmed').length },
    { name: 'Cancelled', value: filteredRes.filter((r) => r.status === 'cancelled').length },
    { name: 'Completed', value: filteredRes.filter((r) => r.status === 'completed').length },
    { name: 'No Show', value: filteredRes.filter((r) => r.status === 'no_show').length },
  ].filter((d) => d.value > 0);

  // ── Messages per day chart ────────────────────────────────────────────────
  const chartDays = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);

    if (timeRange === 'custom') {
      const from = customFrom || todayStr;
      const to = customTo || todayStr;
      const days: string[] = [];
      const cur = new Date(from);
      const end = new Date(to);
      while (cur <= end) {
        days.push(cur.toISOString().slice(0, 10));
        cur.setDate(cur.getDate() + 1);
      }
      return days;
    }

    if (timeRange === 'all') {
      // Derive range from actual data: earliest firstMessageAt → today, max 365 days
      const earliest = stats.reduce<string | null>((min, c) => {
        if (!c.firstMessageAt) return min;
        const d = new Date(c.firstMessageAt).toISOString().slice(0, 10);
        return min === null || d < min ? d : min;
      }, null);
      if (!earliest) return [todayStr];
      const cutoff = new Date();
      cutoff.setFullYear(cutoff.getFullYear() - 1);
      const startDate = earliest < cutoff.toISOString().slice(0, 10) ? cutoff.toISOString().slice(0, 10) : earliest;
      const days: string[] = [];
      const cur = new Date(startDate);
      const end = new Date(todayStr);
      while (cur <= end) {
        days.push(cur.toISOString().slice(0, 10));
        cur.setDate(cur.getDate() + 1);
      }
      return days;
    }

    const count = timeRange === '7d' ? 7 : timeRange === '90d' ? 90 : 30;
    return Array.from({ length: count }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (count - 1 - i));
      return d.toISOString().slice(0, 10);
    });
  }, [timeRange, customFrom, customTo, stats]);

  const msgsByDay = chartDays.map((day) => {
    const totals = stats.reduce(
      (acc, c) => {
        const b = c.messagesByDay[day] ?? { ai: 0, host: 0, guest: 0 };
        return { ai: acc.ai + b.ai, host: acc.host + b.host, guest: acc.guest + b.guest };
      },
      { ai: 0, host: 0, guest: 0 },
    );
    return {
      date: (timeRange === '90d' || timeRange === 'all') ? day.slice(5, 8) + day.slice(8) : day.slice(5),
      ...totals,
    };
  });

  // ── Property comparison ───────────────────────────────────────────────────
  const propertyComparison = properties.map((p) => {
    const pStats = filteredStats.filter((c) => c.propertyId === p.id);
    return {
      name: p.name.length > 18 ? p.name.slice(0, 16) + '…' : p.name,
      conversations: pStats.length,
      aiMsgs: pStats.reduce((s, c) => s + c.aiMessages, 0),
      hostMsgs: pStats.reduce((s, c) => s + c.hostMessages, 0),
      reservations: reservations.filter((r) => r.propertyId === p.id).length,
    };
  });

  const pieLabel = ({ name, percent }: { name?: string; percent?: number }) =>
    `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`;

  const piePercentLabel = ({ percent }: { name?: string; percent?: number }) =>
    `${((percent ?? 0) * 100).toFixed(0)}%`;

  if (initialLoading) {
    return <div className="py-24 text-center text-slate-400 text-sm">Loading monitor data…</div>;
  }

  return (
    <div className="space-y-7 w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Monitor</h1>
          <p className="text-sm text-slate-400 mt-0.5">Live analytics across all properties</p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <span className={`w-1.5 h-1.5 rounded-full ${polling ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
              {polling ? 'Updating…' : `Updated ${secondsAgo}s ago`}
              <span className="text-slate-300 ml-1">· auto-refreshes every 30s</span>
            </div>
          )}
          <button
            onClick={() => void load(selectedId)}
            disabled={polling}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            <svg className={`w-3.5 h-3.5 ${polling ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Property filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => handleSelectProperty(null)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${selectedId === null ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
        >
          All properties
          <span className="ml-2 text-xs opacity-75">({properties.length})</span>
        </button>
        {properties.map((p) => (
          <button
            key={p.id}
            onClick={() => handleSelectProperty(p.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${selectedId === p.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* Time filter */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-1">Period</span>
        {TIME_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            onClick={() => setTimeRange(opt.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${timeRange === opt.key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            {opt.label}
          </button>
        ))}
        {timeRange === 'custom' && (
          <div className="flex items-center gap-2 ml-2">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:border-indigo-400"
            />
            <span className="text-xs text-slate-400">to</span>
            <input
              type="date"
              value={customTo}
              min={customFrom}
              onChange={(e) => setCustomTo(e.target.value)}
              className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:border-indigo-400"
            />
          </div>
        )}
      </div>

      {/* Overview cards */}
      <div>
        <SectionTitle>Overview</SectionTitle>
        <div className="grid grid-cols-4 gap-4">
          <StatCard
            label="Reservations"
            value={filteredRes.length}
            sub={`${filteredRes.filter((r) => r.status === 'confirmed').length} confirmed`}
            color="bg-indigo-50"
            icon={<svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>}
          />
          <StatCard
            label="Conversations"
            value={filteredStats.length}
            sub={`${filteredStats.filter((c) => c.status === 'host').length} host active`}
            color="bg-violet-50"
            icon={<svg className="w-4 h-4 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" /></svg>}
          />
          <StatCard
            label="AI Replies"
            value={totalAI}
            sub={`${totalHost} by host · ${totalGuest} guest msgs`}
            color="bg-emerald-50"
            icon={<svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>}
          />
          <StatCard
            label="Total Messages"
            value={totalMsgs}
            sub="across all conversations"
            color="bg-sky-50"
            icon={<svg className="w-4 h-4 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" /></svg>}
          />
        </div>
      </div>

      {/* Cost cards */}
      <div>
        <SectionTitle>Cost estimates</SectionTitle>
        <div className="grid grid-cols-3 gap-4">
          <StatCard
            label="AI Cost (Claude)"
            value={`$${aiCost.toFixed(4)}`}
            sub={`${totalAI} replies × $${AI_COST_PER_MSG}/msg`}
            color="bg-amber-50"
            icon={<svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          />
          <StatCard
            label="Twilio Cost (est.)"
            value={`$${twilioCost.toFixed(4)}`}
            sub={`${totalAI + totalHost} outbound × $${TWILIO_COST_PER_MSG}/msg`}
            color="bg-rose-50"
            icon={<svg className="w-4 h-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 8.25h3m-3 4.5h3" /></svg>}
          />
          <StatCard
            label="Total Estimated Cost"
            value={`$${(aiCost + twilioCost).toFixed(4)}`}
            sub="AI + Twilio combined"
            color="bg-slate-100"
            icon={<svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" /></svg>}
          />
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <p className="text-sm font-semibold text-slate-700 mb-0.5">Message Breakdown</p>
          <p className="text-xs text-slate-400 mb-4">AI vs Host vs Guest</p>
          {messagePie.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-300 text-sm">No messages</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart style={chartStyle}>
                <Pie data={messagePie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70}
                  label={pieLabel} labelLine={false} strokeWidth={0} animationDuration={600}>
                  {messagePie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <p className="text-sm font-semibold text-slate-700 mb-0.5">Conversation Status</p>
          <p className="text-xs text-slate-400 mb-4">Current handling breakdown</p>
          {statusCounts.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-300 text-sm">No conversations</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart style={chartStyle}>
                <Pie data={statusCounts} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70}
                  label={piePercentLabel} labelLine={false} strokeWidth={0} animationDuration={600}>
                  {statusCounts.map((d, i) => <Cell key={i} fill={STATUS_COLORS[d.status] ?? PIE_COLORS[i]} />)}
                </Pie>
                <Tooltip />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <p className="text-sm font-semibold text-slate-700 mb-0.5">Reservation Status</p>
          <p className="text-xs text-slate-400 mb-4">All reservations breakdown</p>
          {resByStatus.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-300 text-sm">No reservations</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart style={chartStyle}>
                <Pie data={resByStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70}
                  label={pieLabel} labelLine={false} strokeWidth={0} animationDuration={600}>
                  <Cell fill="#6366f1" /><Cell fill="#f43f5e" /><Cell fill="#10b981" /><Cell fill="#94a3b8" />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Messages over time */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <p className="text-sm font-semibold text-slate-700 mb-0.5">Messages Over Time</p>
        <p className="text-xs text-slate-400 mb-4">
          {timeRange === 'custom' && customFrom && customTo
            ? `${customFrom} → ${customTo} — AI vs Host vs Guest`
            : `${TIME_OPTIONS.find((o) => o.key === timeRange)?.label} — AI vs Host vs Guest`}
        </p>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={msgsByDay} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" tick={{ fontSize: (timeRange === '90d' || timeRange === 'all') ? 9 : 11, fill: '#94a3b8' }}
              interval={timeRange === 'all' ? Math.floor(chartDays.length / 12) : timeRange === '90d' ? 6 : timeRange === '30d' ? 2 : 0} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="ai" name="AI" stroke="#6366f1" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="host" name="Host" stroke="#10b981" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="guest" name="Guest" stroke="#f59e0b" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Property comparison (only when All selected) */}
      {selectedId === null && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <p className="text-sm font-semibold text-slate-700 mb-0.5">Property Comparison</p>
          <p className="text-xs text-slate-400 mb-4">Conversations, AI replies & host replies per property</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={propertyComparison} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="reservations" name="Reservations" fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="conversations" name="Conversations" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="aiMsgs" name="AI Msgs" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="hostMsgs" name="Host Msgs" fill="#f43f5e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Conversation detail table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50">
          <p className="text-sm font-semibold text-slate-700">Conversation Breakdown</p>
          <p className="text-xs text-slate-400 mt-0.5">Per-conversation message stats — AI replies, host replies, guest messages</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-50">
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Guest</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Property</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">AI Replies</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Host Replies</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Hosts Involved</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Guest Msgs</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">AI Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredStats.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3">
                    <p className="font-medium text-slate-800">{c.guestName ?? '—'}</p>
                    <p className="text-xs text-slate-400">{c.userPhone.replace('whatsapp:', '')}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600 text-xs">{c.propertyName ?? '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold"
                      style={{ backgroundColor: `${STATUS_COLORS[c.status] ?? '#94a3b8'}20`, color: STATUS_COLORS[c.status] ?? '#94a3b8' }}>
                      {STATUS_LABELS[c.status] ?? c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`font-semibold ${c.aiMessages > 0 ? 'text-indigo-600' : 'text-slate-300'}`}>{c.aiMessages}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`font-semibold ${c.hostMessages > 0 ? 'text-emerald-600' : 'text-slate-300'}`}>{c.hostMessages}</span>
                  </td>
                  <td className="px-4 py-3">
                    {c.hostNames.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {c.hostNames.map((name) => (
                          <span key={name} className="inline-block px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-xs font-medium">{name}</span>
                        ))}
                      </div>
                    ) : <span className="text-slate-300 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center text-slate-500">{c.guestMessages}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-slate-600">${(c.aiMessages * AI_COST_PER_MSG).toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
