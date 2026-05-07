import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, Property } from '../api';

// ─── Airbnb-style colour tokens ──────────────────────────────────────────────
// Primary: #FF385C  (Airbnb coral)
// Dark:    #222222
// Mid:     #717171
// Light:   #EBEBEB

type Step = 'form' | 'success';

interface FormData {
  guestName: string;
  guestPhone: string;
  checkIn: string;
  checkOut: string;
  guestCount: number;
}

const today = new Date().toISOString().split('T')[0];

export function GuestRegistration() {
  const [params] = useSearchParams();
  const propertyId = params.get('p') ?? '';
  const prefillCheckIn = params.get('checkIn') ?? '';
  const prefillCheckOut = params.get('checkOut') ?? '';

  const [property, setProperty] = useState<Property | null>(null);
  const [step, setStep] = useState<Step>('form');
  const [welcomeUrl, setWelcomeUrl] = useState('');
  const [confirmedName, setConfirmedName] = useState('');

  const [form, setForm] = useState<FormData>({
    guestName: '',
    guestPhone: '',
    checkIn: prefillCheckIn || today,
    checkOut: prefillCheckOut || '',
    guestCount: 1,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (propertyId) {
      api.properties.get(propertyId).then(setProperty).catch(() => {});
    }
  }, [propertyId]);

  const set = <K extends keyof FormData>(key: K, value: FormData[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // normalise phone
    const rawPhone = form.guestPhone.trim().replace(/\s+/g, '');
    const phone = rawPhone.startsWith('+') ? rawPhone : `+${rawPhone}`;

    setSubmitting(true);
    try {
      const result = await api.guests.register({
        propertyId,
        guestName: form.guestName.trim(),
        guestPhone: phone,
        checkIn: new Date(form.checkIn).toISOString(),
        checkOut: new Date(form.checkOut + 'T11:00:00').toISOString(),
        guestCount: form.guestCount,
      });
      setWelcomeUrl(result.welcomeUrl);
      setConfirmedName(form.guestName.trim().split(' ')[0]);
      setStep('success');
    } catch (err) {
      setError(String(err).replace(/^Error:\s*\d+\s*/, ''));
    } finally {
      setSubmitting(false);
    }
  };

  const propertyName = property?.name ?? 'your upcoming stay';

  if (step === 'success') {
    return <SuccessScreen name={confirmedName} phone={form.guestPhone} welcomeUrl={welcomeUrl} propertyName={propertyName} />;
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Top bar */}
      <header className="border-b border-[#EBEBEB] px-6 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <AirbnbLogo />
          <span className="text-xs text-[#717171]">Guest registration</span>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-6 py-8 space-y-7">
        {/* Hero */}
        <div className="space-y-1.5">
          <h1 className="text-[26px] font-semibold text-[#222222] leading-tight">
            Confirm your stay details
          </h1>
          <p className="text-[#717171] text-sm">
            {property
              ? <>You're checking in to <span className="font-medium text-[#222222]">{property.name}</span>. Fill in your details and we'll send your welcome guide on WhatsApp.</>
              : <>Fill in your details and we'll send your welcome guide directly to your WhatsApp.</>
            }
          </p>
        </div>

        {/* Property card */}
        {property && (
          <div className="flex items-center gap-4 p-4 rounded-2xl border border-[#EBEBEB]">
            <div className="w-14 h-14 rounded-xl bg-[#FF385C]/10 flex items-center justify-center flex-shrink-0">
              <svg className="w-7 h-7 text-[#FF385C]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V10.5z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 21V12h6v9" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-[#222222] text-sm">{property.name}</p>
              {property.address && <p className="text-xs text-[#717171] mt-0.5">{property.address}</p>}
              {(property.checkInTime || property.checkOutTime) && (
                <p className="text-xs text-[#717171] mt-0.5">
                  {property.checkInTime && `Check-in from ${property.checkInTime}`}
                  {property.checkInTime && property.checkOutTime && ' · '}
                  {property.checkOutTime && `Check-out by ${property.checkOutTime}`}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <AirbnbField label="Full name" required>
            <input
              type="text"
              value={form.guestName}
              onChange={(e) => set('guestName', e.target.value)}
              placeholder="Jane Smith"
              required
              autoComplete="name"
              className="airbnb-input"
            />
          </AirbnbField>

          <AirbnbField
            label="WhatsApp number"
            hint="Include country code — e.g. +91 98765 43210"
            required
          >
            <input
              type="tel"
              value={form.guestPhone}
              onChange={(e) => set('guestPhone', e.target.value)}
              placeholder="+91 98765 43210"
              required
              autoComplete="tel"
              className="airbnb-input"
            />
          </AirbnbField>

          <div className="grid grid-cols-2 gap-3">
            <AirbnbField label="Check-in" required>
              <input
                type="date"
                value={form.checkIn}
                onChange={(e) => set('checkIn', e.target.value)}
                min={today}
                required
                className="airbnb-input"
              />
            </AirbnbField>
            <AirbnbField label="Check-out" required>
              <input
                type="date"
                value={form.checkOut}
                onChange={(e) => set('checkOut', e.target.value)}
                min={form.checkIn || today}
                required
                className="airbnb-input"
              />
            </AirbnbField>
          </div>

          <AirbnbField label="Number of guests">
            <div className="flex items-center gap-4 px-4 py-3 border border-[#EBEBEB] rounded-xl">
              <button
                type="button"
                onClick={() => set('guestCount', Math.max(1, form.guestCount - 1))}
                className="w-8 h-8 rounded-full border border-[#EBEBEB] flex items-center justify-center text-[#222222] hover:border-[#222222] transition-colors disabled:opacity-30"
                disabled={form.guestCount <= 1}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" /></svg>
              </button>
              <span className="flex-1 text-center text-sm font-medium text-[#222222]">
                {form.guestCount} {form.guestCount === 1 ? 'guest' : 'guests'}
              </span>
              <button
                type="button"
                onClick={() => set('guestCount', Math.min(20, form.guestCount + 1))}
                className="w-8 h-8 rounded-full border border-[#EBEBEB] flex items-center justify-center text-[#222222] hover:border-[#222222] transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              </button>
            </div>
          </AirbnbField>

          {error && (
            <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !form.guestName || !form.guestPhone || !form.checkIn || !form.checkOut}
            className="w-full py-3.5 rounded-xl text-white text-sm font-semibold transition-all disabled:opacity-40"
            style={{ background: submitting ? '#FF385C99' : 'linear-gradient(to right, #FF385C, #E31C5F)' }}
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                Sending welcome guide…
              </span>
            ) : 'Get my welcome guide →'}
          </button>

          <p className="text-xs text-[#717171] text-center">
            Your welcome guide will be sent to your WhatsApp number.
            Your details are used only to personalise your stay experience.
          </p>
        </form>
      </main>
    </div>
  );
}

// ─── Success Screen ──────────────────────────────────────────────────────────

function SuccessScreen({ name, phone, welcomeUrl, propertyName }: {
  name: string; phone: string; welcomeUrl: string; propertyName: string;
}) {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-[#EBEBEB] px-6 py-4">
        <div className="max-w-lg mx-auto">
          <AirbnbLogo />
        </div>
      </header>

      <main className="max-w-lg mx-auto px-6 py-12 text-center space-y-6">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
          style={{ background: 'linear-gradient(135deg, #FF385C, #E31C5F)' }}>
          <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-[#222222]">You're all set, {name}!</h1>
          <p className="text-[#717171] text-sm">
            We've sent your welcome guide to <span className="font-medium text-[#222222]">{phone}</span> on WhatsApp.
          </p>
        </div>

        <div className="rounded-2xl border border-[#EBEBEB] p-5 text-left space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#FF385C]/10 flex items-center justify-center flex-shrink-0">
              <svg className="w-4.5 h-4.5 text-[#FF385C]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V10.5z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 21V12h6v9" />
              </svg>
            </div>
            <p className="font-medium text-[#222222] text-sm">{propertyName}</p>
          </div>

          <div className="space-y-2">
            {[
              { icon: '✓', text: 'Reservation confirmed' },
              { icon: '✓', text: 'Welcome guide sent to WhatsApp' },
              { icon: '✓', text: 'AI assistant ready to answer your questions' },
            ].map((item) => (
              <div key={item.text} className="flex items-center gap-2.5">
                <span className="text-xs font-bold text-[#FF385C]">{item.icon}</span>
                <span className="text-sm text-[#222222]">{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-[#F7F7F7] p-4 text-left">
          <p className="text-xs text-[#717171] font-medium mb-1.5">Your welcome guide link</p>
          <a
            href={welcomeUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-[#FF385C] break-all hover:underline font-medium"
          >
            {welcomeUrl}
          </a>
          <p className="text-xs text-[#717171] mt-1.5">Bookmark this — it has everything you need for your stay.</p>
        </div>

        <p className="text-xs text-[#717171]">
          During your stay, message the property WhatsApp any time to reach your AI assistant.
        </p>
      </main>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function AirbnbField({ label, hint, required, children }: {
  label: string; hint?: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-[#222222]">
        {label}{required && <span className="text-[#FF385C] ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-[#717171]">{hint}</p>}
    </div>
  );
}

function AirbnbLogo() {
  return (
    <div className="flex items-center gap-1.5">
      <svg viewBox="0 0 32 32" className="w-7 h-7" fill="#FF385C">
        <path d="M16 1C7.163 1 0 8.163 0 17c0 4.337 1.67 8.28 4.394 11.232C6.75 30.746 10.678 32 16 32c5.322 0 9.25-1.254 11.606-3.768C30.33 25.28 32 21.337 32 17 32 8.163 24.837 1 16 1zm0 27.5c-4.686 0-8.198-.996-10.275-2.883C3.786 23.888 2.5 20.63 2.5 17c0-7.456 6.044-13.5 13.5-13.5S29.5 9.544 29.5 17c0 3.63-1.286 6.888-3.225 8.617C24.198 27.504 20.686 28.5 16 28.5z" />
        <path d="M16 9.5c-2.485 0-4.5 2.015-4.5 4.5s2.015 4.5 4.5 4.5 4.5-2.015 4.5-4.5-2.015-4.5-4.5-4.5zm0 7.5c-1.654 0-3-1.346-3-3s1.346-3 3-3 3 1.346 3 3-1.346 3-3 3z" />
      </svg>
      <span className="text-[#FF385C] font-bold text-lg tracking-tight">airbnb</span>
    </div>
  );
}
