import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { APP_CONFIG, AppConfig } from '../../../config/app.config';
import {
  ChannelManagerProvider,
  ExternalListingDetails,
  ExternalReservation,
} from '../channel-manager.interface';

type AirbnbTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

/**
 * Airbnb Channel Manager integration.
 *
 * AUTH: Airbnb uses OAuth 2.0. Two modes are supported:
 *   1. Static token: set AIRBNB_ACCESS_TOKEN directly (easiest for single-host pilots).
 *   2. Client credentials: set AIRBNB_CLIENT_ID + AIRBNB_CLIENT_SECRET for multi-host.
 *      Tokens are cached in memory and refreshed on expiry.
 *
 * Requires Airbnb Partner API access: https://www.airbnb.com/partner
 *
 * Per-property access tokens (multi-host) can be stored in Property.config:
 *   { "airbnbAccessToken": "...", "airbnbUserId": "..." }
 * The syncProperty flow reads this before falling back to the env token.
 */
@Injectable()
export class AirbnbProvider implements ChannelManagerProvider {
  private readonly logger = new Logger(AirbnbProvider.name);
  readonly providerName = 'airbnb';

  private readonly http: AxiosInstance;
  private cachedToken: string | null = null;
  private tokenExpiresAt = 0;

  private static readonly API_BASE = 'https://api.airbnb.com';
  private static readonly AUTH_URL = `${AirbnbProvider.API_BASE}/oauth2/token`;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
    this.http = axios.create({ baseURL: AirbnbProvider.API_BASE });
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  async getListingDetails(externalId: string): Promise<ExternalListingDetails> {
    const token = await this.getToken();

    try {
      const { data } = await this.http.get(`/v2/listings/${externalId}`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { _format: 'v1_legacy_long' },
      });

      return this.mapListing(data.listing ?? data);
    } catch (error) {
      this.handleApiError('getListingDetails', externalId, error);
    }
  }

  async getReservations(externalId: string): Promise<ExternalReservation[]> {
    const token = await this.getToken();

    try {
      const { data } = await this.http.get('/v2/reservations', {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          listing_id: externalId,
          _format: 'v1_legacy_long',
          _limit: 50,
          _offset: 0,
        },
      });

      const reservations: Record<string, unknown>[] = data.reservations ?? data.results ?? [];
      return reservations.map((r) => this.mapReservation(r));
    } catch (error) {
      this.handleApiError('getReservations', externalId, error);
    }
  }

  // ─── Token Management ────────────────────────────────────────────────────────

  private async getToken(): Promise<string> {
    // Priority 1: static token in env (easiest for early pilots).
    const staticToken = process.env.AIRBNB_ACCESS_TOKEN;
    if (staticToken) return staticToken;

    // Priority 2: cached client-credentials token.
    if (this.cachedToken && Date.now() < this.tokenExpiresAt) {
      return this.cachedToken;
    }

    return this.fetchClientCredentialsToken();
  }

  private async fetchClientCredentialsToken(): Promise<string> {
    const { airbnbClientId, airbnbClientSecret } = this.config.channelManager;

    if (!airbnbClientId || !airbnbClientSecret) {
      throw new ServiceUnavailableException(
        'CHANNEL_MANAGER_ERROR: Airbnb credentials not configured. ' +
        'Set AIRBNB_ACCESS_TOKEN (quick) or AIRBNB_CLIENT_ID + AIRBNB_CLIENT_SECRET.',
      );
    }

    try {
      const { data } = await axios.post<AirbnbTokenResponse>(
        AirbnbProvider.AUTH_URL,
        new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: airbnbClientId,
          client_secret: airbnbClientSecret,
          scope: 'vr:read_listings vr:read_reservations',
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      );

      this.cachedToken = data.access_token;
      // Refresh 60 s before actual expiry.
      this.tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
      this.logger.log('Airbnb OAuth token refreshed');
      return data.access_token;
    } catch (error) {
      this.logger.error('Airbnb OAuth token request failed', error);
      throw new ServiceUnavailableException(
        'CHANNEL_MANAGER_ERROR: Airbnb OAuth token request failed',
      );
    }
  }

  // ─── Response Mapping ────────────────────────────────────────────────────────

  private mapListing(raw: Record<string, unknown>): ExternalListingDetails {
    const amenities = this.extractStringArray(raw['listing_amenities']);

    const knowledge: Record<string, string> = {};
    if (raw['check_in_time']) knowledge['check_in_instructions'] = String(raw['check_in_time']);
    if (raw['house_rules']) knowledge['house_rules'] = String(raw['house_rules']);
    if (raw['interaction']) knowledge['host_greeting'] = String(raw['interaction']);

    return {
      externalId: String(raw['id']),
      name: String(raw['name'] ?? ''),
      description: raw['description'] ? String(raw['description']) : undefined,
      address: this.extractAddress(raw),
      checkInTime: raw['check_in_time'] ? String(raw['check_in_time']) : undefined,
      checkOutTime: raw['check_out_time'] ? String(raw['check_out_time']) : undefined,
      amenities: amenities.length > 0 ? amenities : undefined,
      policies: raw['house_rules'] ? [String(raw['house_rules'])] : undefined,
      knowledge: Object.keys(knowledge).length > 0 ? knowledge : undefined,
    };
  }

  private mapReservation(raw: Record<string, unknown>): ExternalReservation {
    const guest = (raw['guest'] ?? raw['guest_details'] ?? {}) as Record<string, unknown>;
    const guestPhone = guest['phone'] ? String(guest['phone']) : undefined;

    return {
      externalId: String(raw['confirmation_code'] ?? raw['id']),
      guestName: guest['full_name']
        ? String(guest['full_name'])
        : [guest['first_name'], guest['last_name']].filter(Boolean).join(' ') || 'Guest',
      guestPhone: guestPhone ? this.normalisePhone(guestPhone) : undefined,
      guestEmail: guest['email'] ? String(guest['email']) : undefined,
      checkIn: new Date(String(raw['start_date'] ?? raw['checkin_date'])),
      checkOut: new Date(String(raw['end_date'] ?? raw['checkout_date'])),
      guestCount: Number(raw['number_of_guests'] ?? raw['guest_count'] ?? 1),
      status: this.mapStatus(String(raw['status'] ?? 'accept')),
      notes: raw['special_offer'] ? String(raw['special_offer']) : undefined,
      rawData: raw,
    };
  }

  private mapStatus(raw: string): ExternalReservation['status'] {
    const map: Record<string, ExternalReservation['status']> = {
      accept: 'confirmed',
      accepted: 'confirmed',
      confirmed: 'confirmed',
      cancelled: 'cancelled',
      cancel: 'cancelled',
      completed: 'completed',
      no_show: 'no_show',
    };
    return map[raw.toLowerCase()] ?? 'confirmed';
  }

  private extractAddress(raw: Record<string, unknown>): string | undefined {
    const addr = raw['address'] as Record<string, unknown> | undefined;
    if (!addr) return undefined;
    return [addr['street'], addr['city'], addr['state'], addr['country_code']]
      .filter(Boolean)
      .join(', ');
  }

  private extractStringArray(raw: unknown): string[] {
    if (!Array.isArray(raw)) return [];
    return raw.map((item) => {
      if (typeof item === 'string') return item;
      if (typeof item === 'object' && item !== null && 'name' in item) return String(item.name);
      return String(item);
    });
  }

  private normalisePhone(phone: string): string {
    // Strip all non-digits, then prefix with whatsapp: and +
    const digits = phone.replace(/\D/g, '');
    return `whatsapp:+${digits}`;
  }

  private handleApiError(method: string, id: string, error: unknown): never {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const detail = JSON.stringify(error.response?.data ?? error.message);
      this.logger.error(`Airbnb ${method}(${id}) HTTP ${status}: ${detail}`);

      if (status === 401 || status === 403) {
        this.cachedToken = null; // force re-auth on next call
        throw new ServiceUnavailableException(
          'CHANNEL_MANAGER_ERROR: Airbnb authentication failed — check credentials',
        );
      }
      if (status === 429) {
        throw new ServiceUnavailableException(
          'CHANNEL_MANAGER_ERROR: Airbnb rate limit exceeded — retry later',
        );
      }
    }
    throw new InternalServerErrorException(
      `CHANNEL_MANAGER_ERROR: Airbnb ${method} failed`,
    );
  }
}
