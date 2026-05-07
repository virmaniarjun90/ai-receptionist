import { useEffect, useRef, useState } from 'react';
import { api, Knowledge, Property, Reservation, SyncResult } from '../api';

// ─── Property Card ─────────────────────────────────────────────────────────

function PropertyCard({ property: p, onManage }: { property: Property; onManage: () => void }) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const formLink = `${window.location.origin}/register?p=${p.id}`;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    void navigator.clipboard.writeText(formLink).then(() => {
      setCopied(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center justify-between hover:border-indigo-200 hover:shadow-md transition-all">
      <div className="flex items-center gap-4">
        <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V10.5z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 21V12h6v9" />
          </svg>
        </div>
        <div>
          <p className="font-semibold text-slate-900">{p.name}</p>
          <p className="text-sm text-slate-400 mt-0.5">
            {p.address ?? 'No address set'}
            {p.phoneNumber && (
              <span className="ml-2 inline-flex items-center gap-1 text-indigo-500 font-medium">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" /></svg>
                {p.phoneNumber}
              </span>
            )}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleCopy}
          title="Copy guest registration form link"
          className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border transition-all ${
            copied
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
          }`}
        >
          {copied ? (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
              Copied!
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>
              Copy form link
            </>
          )}
        </button>
        <button
          onClick={onManage}
          className="px-4 py-2 text-sm font-medium text-indigo-600 border border-indigo-200 rounded-xl hover:bg-indigo-50 transition-colors"
        >
          Manage
        </button>
      </div>
    </div>
  );
}

// ─── Property List ─────────────────────────────────────────────────────────

export function Properties() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [selected, setSelected] = useState<Property | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const load = () => api.properties.list().then(setProperties).catch((e) => setError(String(e)));
  useEffect(() => { void load(); }, []);

  if (selected) {
    return <PropertyDetail property={selected} onBack={() => { setSelected(null); void load(); }} />;
  }

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Properties</h1>
          <p className="text-sm text-slate-400 mt-0.5">Manage your properties and their knowledge bases</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          Add Property
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
          {error}
        </div>
      )}

      {creating && (
        <PropertyForm
          onSave={async (d) => { await api.properties.create(d); setCreating(false); void load(); }}
          onCancel={() => setCreating(false)}
        />
      )}

      <div className="space-y-3">
        {properties.map((p) => (
          <PropertyCard key={p.id} property={p} onManage={() => setSelected(p)} />
        ))}
        {properties.length === 0 && !creating && (
          <div className="bg-white rounded-2xl border border-slate-100 py-16 text-center">
            <svg className="w-10 h-10 text-slate-200 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V10.5z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 21V12h6v9" />
            </svg>
            <p className="text-sm font-medium text-slate-500">No properties yet</p>
            <p className="text-xs text-slate-400 mt-1">Add your first property to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Property Detail ────────────────────────────────────────────────────────

function PropertyDetail({ property, onBack }: { property: Property; onBack: () => void }) {
  const [tab, setTab] = useState<'info' | 'knowledge' | 'reservations'>('info');
  const [editing, setEditing] = useState(false);
  const [current, setCurrent] = useState(property);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');

  const handleSync = async () => {
    setSyncing(true); setSyncResult(null); setError('');
    try { setSyncResult(await api.properties.sync(current.id)); }
    catch (e) { setError(String(e)); }
    finally { setSyncing(false); }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete property "${current.name}"? This cannot be undone.`)) return;
    try { await api.properties.delete(current.id); onBack(); }
    catch (e) { setError(String(e)); }
  };

  const tabs = [
    { id: 'info' as const, label: 'Info' },
    { id: 'knowledge' as const, label: 'Knowledge / FAQs' },
    { id: 'reservations' as const, label: 'Reservations' },
  ];

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
          Back
        </button>
        <h1 className="text-xl font-bold text-slate-900 flex-1">{current.name}</h1>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          <svg className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          {syncing ? 'Syncing…' : 'Sync Channel Manager'}
        </button>
        <button
          onClick={handleDelete}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
          Delete
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
          {error}
        </div>
      )}

      {syncResult && (
        <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3.5">
          <svg className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <div className="text-sm text-emerald-800">
            Sync complete via <strong>{syncResult.provider}</strong>: {syncResult.reservationsSynced} reservations, {syncResult.knowledgeEntriesSynced} knowledge entries.
            {syncResult.errors.length > 0 && <p className="text-red-600 mt-1">{syncResult.errors.join('; ')}</p>}
          </div>
        </div>
      )}

      <div className="flex gap-1 border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.id
                ? 'border-b-2 border-indigo-600 text-indigo-700 -mb-px'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'info' && (
        editing
          ? <PropertyForm initial={current} onSave={async (d) => { const u = await api.properties.update(current.id, d); setCurrent(u); setEditing(false); }} onCancel={() => setEditing(false)} />
          : <PropertyInfo property={current} onEdit={() => setEditing(true)} />
      )}
      {tab === 'knowledge' && <KnowledgePanel propertyId={current.id} />}
      {tab === 'reservations' && <ReservationsPanel propertyId={current.id} />}
    </div>
  );
}

// ─── Property Info ──────────────────────────────────────────────────────────

function PropertyInfo({ property: p, onEdit }: { property: Property; onEdit: () => void }) {
  const row = (label: string, value?: string | null) =>
    value ? (
      <div key={label}>
        <dt className="text-xs text-slate-400 font-medium uppercase tracking-wide">{label}</dt>
        <dd className="text-sm text-slate-800 mt-0.5">{value}</dd>
      </div>
    ) : null;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
      <div className="flex justify-between items-start mb-5">
        <p className="font-semibold text-slate-900 text-base">{p.name}</p>
        <button
          onClick={onEdit}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 border border-indigo-200 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" /></svg>
          Edit
        </button>
      </div>
      <dl className="grid grid-cols-2 gap-4">
        {row('Type', p.type)}
        {row('Address', p.address)}
        {row('Contact Phone', p.phone)}
        {row('WhatsApp Number', p.phoneNumber)}
        {row('Channel Manager ID', p.externalId)}
        {row('Check-in', p.checkInTime)}
        {row('Check-out', p.checkOutTime)}
        {p.description && (
          <div className="col-span-2">
            <dt className="text-xs text-slate-400 font-medium uppercase tracking-wide">Description</dt>
            <dd className="text-sm text-slate-800 mt-0.5">{p.description}</dd>
          </div>
        )}
      </dl>
      {p.amenities.length > 0 && (
        <div className="mt-5 pt-5 border-t border-slate-100">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-2">Amenities</p>
          <div className="flex flex-wrap gap-2">
            {p.amenities.map((a) => (
              <span key={a} className="px-2.5 py-1 bg-slate-100 text-slate-700 text-xs rounded-lg">{a}</span>
            ))}
          </div>
        </div>
      )}
      {p.policies.length > 0 && (
        <div className="mt-4">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-2">Policies</p>
          <ul className="space-y-1">
            {p.policies.map((pol, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                <svg className="w-4 h-4 text-slate-300 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                {pol}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Knowledge Panel ────────────────────────────────────────────────────────

function KnowledgePanel({ propertyId }: { propertyId: string }) {
  const [items, setItems] = useState<Knowledge[]>([]);
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => api.knowledge.list(propertyId).then(setItems).catch((e) => setError(String(e)));
  useEffect(() => { void load(); }, [propertyId]);

  const handleSave = async () => {
    if (!key.trim() || !value.trim()) return;
    setSaving(true);
    try { await api.knowledge.upsert(propertyId, key.trim(), value.trim()); setKey(''); setValue(''); void load(); }
    catch (e) { setError(String(e)); }
    finally { setSaving(false); }
  };

  const handleDelete = async (k: string) => {
    try { await api.knowledge.delete(propertyId, k); void load(); }
    catch (e) { setError(String(e)); }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
          {error}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <p className="text-sm font-semibold text-slate-700 mb-3">Add or update entry</p>
        <div className="flex gap-3 items-end">
          <div className="w-44">
            <label className="block text-xs text-slate-400 font-medium mb-1.5">Key</label>
            <input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent transition-shadow"
              placeholder="wifi_password"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-slate-400 font-medium mb-1.5">Value</label>
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleSave(); }}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent transition-shadow"
              placeholder="SunsetVilla_5G"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !key || !value}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {items.length === 0 ? (
          <div className="py-12 text-center">
            <svg className="w-8 h-8 text-slate-200 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" /></svg>
            <p className="text-sm text-slate-400">No knowledge entries yet</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100">
              <tr className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <th className="px-5 py-3.5 text-left">Key</th>
                <th className="px-5 py-3.5 text-left">Value</th>
                <th className="px-5 py-3.5 w-12" />
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={item.key} className={`${i > 0 ? 'border-t border-slate-50' : ''} hover:bg-slate-50 transition-colors`}>
                  <td className="px-5 py-3 font-mono text-indigo-600 text-xs">{item.key}</td>
                  <td className="px-5 py-3 text-slate-700">{item.value}</td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => handleDelete(item.key)}
                      className="text-slate-300 hover:text-red-500 transition-colors"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Reservations Panel ─────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  confirmed: { label: 'Confirmed', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  cancelled: { label: 'Cancelled', bg: 'bg-red-50',     text: 'text-red-700'     },
  completed: { label: 'Completed', bg: 'bg-slate-100',  text: 'text-slate-600'   },
  no_show:   { label: 'No show',   bg: 'bg-amber-50',   text: 'text-amber-700'   },
};

function ReservationsPanel({ propertyId }: { propertyId: string }) {
  const [items, setItems] = useState<Reservation[]>([]);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState<string | null>(null);

  const load = () => api.reservations.list(propertyId).then(setItems).catch((e) => setError(String(e)));
  useEffect(() => { void load(); }, [propertyId]);

  const handleCancel = async (id: string) => {
    setCancelling(id);
    try { await api.reservations.cancel(id); void load(); }
    catch (e) { setError(String(e)); }
    finally { setCancelling(null); }
  };

  return (
    <div className="space-y-3">
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
          {error}
        </div>
      )}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {items.length === 0 ? (
          <div className="py-12 text-center">
            <svg className="w-8 h-8 text-slate-200 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
            <p className="text-sm text-slate-400">No reservations yet</p>
            <p className="text-xs text-slate-400 mt-1">Sync your channel manager to pull them in</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100">
              <tr className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <th className="px-5 py-3.5 text-left">Guest</th>
                <th className="px-5 py-3.5 text-left">Phone</th>
                <th className="px-5 py-3.5 text-left">Check-in</th>
                <th className="px-5 py-3.5 text-left">Check-out</th>
                <th className="px-5 py-3.5 text-left">Status</th>
                <th className="px-5 py-3.5 w-20" />
              </tr>
            </thead>
            <tbody>
              {items.map((r, i) => {
                const cfg = STATUS_CONFIG[r.status] ?? { label: r.status, bg: 'bg-slate-100', text: 'text-slate-600' };
                return (
                  <tr key={r.id} className={`${i > 0 ? 'border-t border-slate-50' : ''} hover:bg-slate-50 transition-colors`}>
                    <td className="px-5 py-3.5 font-medium text-slate-800">
                      {r.guestName}
                      {r.guestCount > 1 && <span className="text-slate-400 font-normal ml-1.5 text-xs">×{r.guestCount}</span>}
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 text-xs">{r.guestPhone ?? '—'}</td>
                    <td className="px-5 py-3.5 text-slate-600">{new Date(r.checkIn).toLocaleDateString()}</td>
                    <td className="px-5 py-3.5 text-slate-600">{new Date(r.checkOut).toLocaleDateString()}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      {r.status === 'confirmed' && (
                        <button
                          onClick={() => handleCancel(r.id)}
                          disabled={cancelling === r.id}
                          className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50 font-medium transition-colors"
                        >
                          {cancelling === r.id ? '…' : 'Cancel'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Property Form ──────────────────────────────────────────────────────────

function PropertyForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Property;
  onSave: (data: Partial<Property>) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Partial<Property>>(initial ?? {});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k: keyof Property, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError('');
    try { await onSave(form); }
    catch (err) { setError(String(err)); setSaving(false); }
  };

  const field = (label: string, key: keyof Property, placeholder?: string, required?: boolean) => (
    <div>
      <label className="block text-xs text-slate-500 font-medium mb-1.5">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <input
        value={(form[key] as string) ?? ''}
        onChange={(e) => set(key, e.target.value)}
        placeholder={placeholder}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent transition-shadow"
      />
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-slate-900">{initial ? 'Edit Property' : 'New Property'}</p>
      </div>
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      <div className="grid grid-cols-2 gap-4">
        {field('Property name', 'name', 'Sunset Villa', true)}
        {field('Type', 'type', 'airbnb / hotel / villa')}
        {field('Address', 'address', '123 Ocean Drive...')}
        {field('Contact phone', 'phone', '+1 305 555 0100')}
        {field('WhatsApp number (Twilio)', 'phoneNumber', 'whatsapp:+14155238886')}
        {field('Channel Manager listing ID', 'externalId', '12345678')}
        {field('Check-in time', 'checkInTime', '3:00 PM')}
        {field('Check-out time', 'checkOutTime', '11:00 AM')}
      </div>
      <div>
        <label className="block text-xs text-slate-500 font-medium mb-1.5">Description</label>
        <textarea
          value={form.description ?? ''}
          onChange={(e) => set('description', e.target.value)}
          rows={2}
          placeholder="A beautiful 3-bedroom villa with ocean views..."
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent transition-shadow resize-none"
        />
      </div>
      <div className="flex gap-3 pt-1">
        <button
          type="submit"
          disabled={saving || !form.name}
          className="px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
        >
          {saving ? 'Saving…' : 'Save property'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
