import { useEffect, useState } from 'react';
import { api, Property, Reservation } from '../api';

type StayWithProperty = Reservation & { propertyName: string };

export function ActiveStays() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [stays, setStays] = useState<StayWithProperty[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const props = await api.properties.list();
      setProperties(props);

      const now = new Date();
      const results = await Promise.all(
        props.map((p) =>
          api.reservations
            .list(p.id)
            .then((rows) =>
              rows
                .filter(
                  (r) =>
                    r.status === 'confirmed' &&
                    new Date(r.checkIn) <= now &&
                    new Date(r.checkOut) >= now,
                )
                .map((r) => ({ ...r, propertyName: p.name })),
            ),
        ),
      );

      setStays(results.flat());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = selectedPropertyId
    ? stays.filter((s) => s.propertyId === selectedPropertyId)
    : stays;

  return (
    <div className="space-y-6 w-full">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Active Stays</h1>
        <p className="text-sm text-slate-400 mt-0.5">Guests currently checked in across all properties</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Property filter */}
      {!loading && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedPropertyId(null)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              selectedPropertyId === null
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            All properties
            <span className="ml-2 text-xs opacity-75">({stays.length})</span>
          </button>
          {properties
            .filter((p) => stays.some((s) => s.propertyId === p.id))
            .map((p) => {
              const count = stays.filter((s) => s.propertyId === p.id).length;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedPropertyId(p.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    selectedPropertyId === p.id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {p.name}
                  <span className="ml-2 text-xs opacity-75">({count})</span>
                </button>
              );
            })}
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center text-slate-400 text-sm">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 py-16 text-center">
          <svg className="w-10 h-10 text-slate-200 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
          </svg>
          <p className="text-sm font-medium text-slate-500">No active stays</p>
          <p className="text-xs text-slate-400 mt-1">No guests are currently checked in</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="divide-y divide-slate-50">
            {filtered.map((stay) => {
              const checkIn = new Date(stay.checkIn);
              const checkOut = new Date(stay.checkOut);
              const daysLeft = Math.ceil((checkOut.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
              return (
                <div key={stay.id} className="px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 text-sm font-bold text-emerald-700">
                      {stay.guestName?.charAt(0)?.toUpperCase() ?? '?'}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{stay.guestName}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        <span className="font-medium text-indigo-600">{stay.propertyName}</span>
                        {' · '}
                        {checkIn.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} →{' '}
                        {checkOut.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        {stay.guestCount > 1 && ` · ${stay.guestCount} guests`}
                      </p>
                    </div>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    daysLeft <= 1 ? 'bg-red-100 text-red-700' : 'bg-emerald-50 text-emerald-700'
                  }`}>
                    {daysLeft <= 0 ? 'Checkout today' : daysLeft === 1 ? 'Last night' : `${daysLeft}d left`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
