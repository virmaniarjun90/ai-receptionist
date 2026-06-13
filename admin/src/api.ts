const BASE = import.meta.env.VITE_API_URL ?? '';

function getAdminKey(): string {
  return localStorage.getItem('admin_key') ?? import.meta.env.VITE_ADMIN_KEY ?? '';
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const key = getAdminKey();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(key ? { 'x-admin-key': key } : {}),
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

export type PropertyFeatures = {
  hostRelay: boolean;
  budgetQuota: boolean;
  budgetLimitUsd: number;
  hostAvailabilityTimeoutMin: number;
  guestGuide: boolean;
  proactiveMessaging: boolean;
  menuSharing: boolean;
};

export const DEFAULT_PROPERTY_FEATURES: PropertyFeatures = {
  hostRelay: true,
  budgetQuota: true,
  budgetLimitUsd: 2.0,
  hostAvailabilityTimeoutMin: 5,
  guestGuide: false,
  proactiveMessaging: false,
  menuSharing: false,
};

export type Property = {
  id: string; name: string; type?: string; description?: string;
  address?: string; phone?: string; phoneNumber?: string; externalId?: string;
  checkInTime?: string; checkOutTime?: string; amenities: string[]; policies: string[];
  config?: { features?: Partial<PropertyFeatures> };
  createdAt: string;
};

export type PropertyHost = {
  id: string; propertyId: string; name: string; phone: string; createdAt: string; hasPin: boolean;
};

export type Knowledge = { id: string; propertyId: string; key: string; value: string; updatedAt: string };

export type Reservation = {
  id: string; propertyId: string; externalId?: string;
  guestName: string; guestPhone?: string; checkIn: string; checkOut: string;
  status: 'confirmed' | 'cancelled' | 'completed' | 'no_show'; guestCount: number; notes?: string;
};

export type Message = { id: string; role: 'user' | 'assistant'; content: string; from: string; to: string; senderName: string; createdAt: string };

export type ConversationStatus = 'ai' | 'awaiting_host' | 'host' | 'pending';

export type Conversation = {
  id: string; userPhone: string; channel: string; createdAt: string;
  status: ConversationStatus; guestName?: string | null;
  activeHostPhone?: string | null; activeHostName?: string | null;
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

export type SystemConfig = {
  appMode: 'demo' | 'pilot' | 'production';
  appUrl: string;
  piiMasking: boolean;
  admin: { apiKeySet: boolean };
  llm: {
    provider: string;
    model: string;
    apiKey: string | null;
    apiKeySet: boolean;
    claudeModel: string;
    openaiModel: string;
    kimiModel: string;
  };
  twilio: {
    accountSid: string | null;
    authTokenSet: boolean;
    whatsappNumber: string | null;
    webhookValidation: boolean;
  };
  channelManager: {
    provider: string;
    configured: boolean;
    cm1ChannelId: string | null;
    cm1ApiKeySet: boolean;
  };
  database: {
    url: string | null;
    urlSet: boolean;
  };
  redis: {
    host: string;
    port: number;
    passwordSet: boolean;
    tls: boolean;
  };
};

// ─── Properties ───────────────────────────────────────────────────────────────

export const api = {
  health: () => request<Health>('/health'),
  config: () => request<SystemConfig>('/admin/config'),
  updateConfig: (updates: Record<string, string>, confirmKey: string) =>
    request<{ saved: boolean }>('/admin/config', {
      method: 'PATCH',
      body: JSON.stringify({ updates, confirmKey }),
    }),

  properties: {
    list: () => request<Property[]>('/admin/properties'),
    get: (id: string) => request<Property>(`/admin/properties/${id}`),
    create: (data: Partial<Property>) =>
      request<Property>('/admin/properties', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Property>) =>
      request<Property>(`/admin/properties/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/admin/properties/${id}`, { method: 'DELETE' }),
    sync: (id: string) => request<SyncResult>(`/admin/properties/${id}/sync`, { method: 'POST' }),
    updateFeatures: (id: string, features: Partial<PropertyFeatures>) =>
      request<Property>(`/admin/properties/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ config: { features } }),
      }),
  },

  hosts: {
    list: (propertyId: string) => request<PropertyHost[]>(`/admin/properties/${propertyId}/hosts`),
    add: (propertyId: string, name: string, phone: string, pin?: string) =>
      request<PropertyHost>(`/admin/properties/${propertyId}/hosts`, {
        method: 'POST', body: JSON.stringify({ name, phone, ...(pin ? { pin } : {}) }),
      }),
    setPin: (propertyId: string, hostId: string, pin: string) =>
      request<{ ok: boolean }>(`/admin/properties/${propertyId}/hosts/${hostId}/pin`, {
        method: 'PATCH', body: JSON.stringify({ pin }),
      }),
    remove: (propertyId: string, hostId: string) =>
      request<void>(`/admin/properties/${propertyId}/hosts/${hostId}`, { method: 'DELETE' }),
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

  auth: {
    isLoggedIn: () => getAdminKey().length > 0,
    login: async (key: string): Promise<boolean> => {
      localStorage.setItem('admin_key', key);
      try {
        await request<Property[]>('/admin/properties');
        return true;
      } catch {
        localStorage.removeItem('admin_key');
        return false;
      }
    },
    logout: () => localStorage.removeItem('admin_key'),
  },
};
