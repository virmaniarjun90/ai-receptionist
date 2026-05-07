const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const ADMIN_KEY = import.meta.env.VITE_ADMIN_KEY ?? '';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(ADMIN_KEY ? { 'x-admin-key': ADMIN_KEY } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status} ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as T;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type Property = {
  id: string; name: string; type?: string; description?: string;
  address?: string; phone?: string; phoneNumber?: string; externalId?: string;
  checkInTime?: string; checkOutTime?: string; amenities: string[]; policies: string[];
  createdAt: string;
};

export type Knowledge = { id: string; propertyId: string; key: string; value: string; updatedAt: string };

export type Reservation = {
  id: string; propertyId: string; externalId?: string;
  guestName: string; guestPhone?: string; checkIn: string; checkOut: string;
  status: 'confirmed' | 'cancelled' | 'completed' | 'no_show'; guestCount: number; notes?: string;
};

export type Message = { id: string; role: 'user' | 'assistant'; content: string; from: string; to: string; createdAt: string };

export type ConversationStatus = 'ai' | 'awaiting_host' | 'host' | 'pending';

export type Conversation = {
  id: string; userPhone: string; channel: string; createdAt: string;
  status: ConversationStatus;
  property?: Property; messages: Message[];
};

export type SyncResult = {
  propertyId: string; provider: string;
  reservationsSynced: number; knowledgeEntriesSynced: number; errors: string[];
};

export type Health = {
  status: string;
  appMode?: string;
  dependencies: Record<string, { status: string; detail?: string }>;
};

// ─── Properties ───────────────────────────────────────────────────────────────

export const api = {
  health: () => request<Health>('/health'),

  properties: {
    list: () => request<Property[]>('/admin/properties'),
    get: (id: string) => request<Property>(`/admin/properties/${id}`),
    create: (data: Partial<Property>) =>
      request<Property>('/admin/properties', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Property>) =>
      request<Property>(`/admin/properties/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/admin/properties/${id}`, { method: 'DELETE' }),
    sync: (id: string) => request<SyncResult>(`/admin/properties/${id}/sync`, { method: 'POST' }),
  },

  knowledge: {
    list: (propertyId: string) => request<Knowledge[]>(`/admin/properties/${propertyId}/knowledge`),
    upsert: (propertyId: string, key: string, value: string) =>
      request<Knowledge>(`/admin/properties/${propertyId}/knowledge`, {
        method: 'POST', body: JSON.stringify({ key, value }),
      }),
    delete: (propertyId: string, key: string) =>
      request<void>(`/admin/properties/${propertyId}/knowledge/${encodeURIComponent(key)}`, { method: 'DELETE' }),
  },

  reservations: {
    list: (propertyId: string) => request<Reservation[]>(`/admin/properties/${propertyId}/reservations`),
    create: (propertyId: string, data: Partial<Reservation>) =>
      request<Reservation>(`/admin/properties/${propertyId}/reservations`, {
        method: 'POST', body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<Reservation>) =>
      request<Reservation>(`/admin/reservations/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    cancel: (id: string) => request<Reservation>(`/admin/reservations/${id}/cancel`, { method: 'POST' }),
  },

  conversations: {
    list: () => request<Conversation[]>('/admin/conversations'),
    get: (id: string) => request<Conversation>(`/admin/conversations/${id}`),
    takeover: (id: string) => request<{ status: string }>(`/admin/conversations/${id}/takeover`, { method: 'POST' }),
    handback: (id: string) => request<{ status: string }>(`/admin/conversations/${id}/handback`, { method: 'POST' }),
  },

  guests: {
    register: (data: {
      propertyId: string; guestName: string; guestPhone: string;
      checkIn: string; checkOut: string; guestCount?: number;
    }) => request<{ reservationId: string; welcomeUrl: string }>('/guest/register', {
      method: 'POST', body: JSON.stringify(data),
    }),
    deleteData: (phone: string) =>
      request<{ phone: string; anonymised: Record<string, number> }>(
        `/admin/guests/${encodeURIComponent(phone)}`,
        { method: 'DELETE' },
      ),
  },

  sync: {
    all: () => request<void>('/admin/sync', { method: 'POST' }),
  },
};
