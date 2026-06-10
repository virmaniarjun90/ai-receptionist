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

/**
 * Generic channel manager slot 1 (cm1).
 *
 * Wired to the STAAH REST API by default. To point at a different provider,
 * update the API_BASE and auth param keys, or swap in a new class at slot cm2.
 *
 * Credentials (set in .env):
 *   CM1_CHANNEL_ID  — channel identifier from the provider dashboard
 *   CM1_API_KEY     — user/API token from the provider dashboard
 *
 * Set Property.externalId to the provider's Room Type ID for each property.
 */
@Injectable()
export class Cm1Provider implements ChannelManagerProvider {
  private readonly logger = new Logger(Cm1Provider.name);
  readonly providerName = 'cm1';

  private readonly http: AxiosInstance;

  private static readonly API_BASE = 'https://api.staah.net/API';

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
    this.http = axios.create({
      baseURL: Cm1Provider.API_BASE,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
  }

  // ─── Auth params ──────────────────────────────────────────────────────────

  private authParams(): Record<string, string> {
    return {
      channelId: this.config.channelManager.cm1ChannelId ?? '',
      userToken: this.config.channelManager.cm1ApiKey ?? '',
    };
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  async getListingDetails(externalId: string): Promise<ExternalListingDetails> {
    try {
      const { data } = await this.http.get('/GetRoomTypes', {
        params: { ...this.authParams(), roomTypeId: externalId },
      });

      const room = this.extractFirst(data?.roomTypes ?? data?.RoomTypes ?? data);
      if (!room) {
        throw new InternalServerErrorException(
          `CHANNEL_MANAGER_ERROR: cm1 returned no room type for id ${externalId}`,
        );
      }
      return this.mapListing(room, externalId);
    } catch (error) {
      this.handleApiError('getListingDetails', externalId, error);
    }
  }

  async getReservations(externalId: string): Promise<ExternalReservation[]> {
    const from = new Date();
    from.setDate(from.getDate() - 1);
    const to = new Date();
    to.setDate(to.getDate() + 90);

    try {
      const { data } = await this.http.get('/GetBookings', {
        params: {
          ...this.authParams(),
          roomTypeId: externalId,
          fromDate: this.formatDate(from),
          toDate: this.formatDate(to),
        },
      });

      const bookings = data?.bookings ?? data?.Bookings ?? data ?? [];
      return Array.isArray(bookings) ? bookings.map((b: Record<string, unknown>) => this.mapReservation(b)) : [];
    } catch (error) {
      this.handleApiError('getReservations', externalId, error);
    }
  }

  // ─── Response mapping ─────────────────────────────────────────────────────

  private mapListing(raw: Record<string, unknown>, externalId: string): ExternalListingDetails {
    const knowledge: Record<string, string> = {};
    if (raw['checkInInstructions'] ?? raw['check_in_instructions']) {
      knowledge['check_in_instructions'] = String(raw['checkInInstructions'] ?? raw['check_in_instructions']);
    }
    if (raw['houseRules'] ?? raw['house_rules']) {
      knowledge['house_rules'] = String(raw['houseRules'] ?? raw['house_rules']);
    }

    return {
      externalId: String(raw['roomTypeId'] ?? raw['id'] ?? externalId),
      name: String(raw['roomTypeName'] ?? raw['name'] ?? 'Property'),
      description: this.str(raw['description']),
      address: this.str(raw['address']),
      checkInTime: this.str(raw['checkInTime'] ?? raw['check_in_time']),
      checkOutTime: this.str(raw['checkOutTime'] ?? raw['check_out_time']),
      amenities: this.stringArray(raw['amenities'] ?? raw['facilities']),
      policies: this.stringArray(raw['policies'] ?? raw['houseRules']),
      knowledge: Object.keys(knowledge).length > 0 ? knowledge : undefined,
    };
  }

  private mapReservation(raw: Record<string, unknown>): ExternalReservation {
    const guest = (raw['guestDetails'] ?? raw['guest'] ?? {}) as Record<string, unknown>;

    const firstName = this.str(guest['firstName'] ?? guest['first_name'] ?? raw['guestFirstName']) ?? '';
    const lastName = this.str(guest['lastName'] ?? guest['last_name'] ?? raw['guestLastName']) ?? '';
    const guestName = [firstName, lastName].filter(Boolean).join(' ') || 'Guest';

    const rawPhone = this.str(guest['phone'] ?? guest['mobile'] ?? raw['guestPhone']);
    const guestPhone = rawPhone ? this.normalisePhone(rawPhone) : undefined;

    return {
      externalId: String(raw['bookingId'] ?? raw['reservationId'] ?? raw['id']),
      guestName,
      guestPhone,
      guestEmail: this.str(guest['email'] ?? raw['guestEmail']),
      checkIn: new Date(String(raw['checkIn'] ?? raw['checkInDate'] ?? raw['arrivalDate'])),
      checkOut: new Date(String(raw['checkOut'] ?? raw['checkOutDate'] ?? raw['departureDate'])),
      guestCount: Number(raw['guestCount'] ?? raw['noOfGuests'] ?? raw['adults'] ?? 1),
      status: this.mapStatus(String(raw['status'] ?? raw['bookingStatus'] ?? 'confirmed')),
      notes: this.str(raw['specialRequests'] ?? raw['notes']),
      rawData: raw,
    };
  }

  private mapStatus(raw: string): ExternalReservation['status'] {
    const s = raw.toLowerCase();
    if (s.includes('cancel')) return 'cancelled';
    if (s.includes('complet') || s.includes('checkout')) return 'completed';
    if (s.includes('noshow') || s.includes('no_show') || s.includes('no show')) return 'no_show';
    return 'confirmed';
  }

  // ─── Utilities ────────────────────────────────────────────────────────────

  private extractFirst(data: unknown): Record<string, unknown> | null {
    if (Array.isArray(data) && data.length > 0) return data[0] as Record<string, unknown>;
    if (data && typeof data === 'object') return data as Record<string, unknown>;
    return null;
  }

  private str(v: unknown): string | undefined {
    return v != null && v !== '' ? String(v) : undefined;
  }

  private stringArray(v: unknown): string[] | undefined {
    if (!Array.isArray(v)) return undefined;
    const arr = v.map((item) =>
      typeof item === 'string' ? item
      : typeof item === 'object' && item !== null && 'name' in item ? String((item as { name: unknown }).name)
      : String(item),
    ).filter(Boolean);
    return arr.length > 0 ? arr : undefined;
  }

  private normalisePhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    return `whatsapp:+${digits}`;
  }

  private formatDate(d: Date): string {
    return d.toISOString().split('T')[0];
  }

  private handleApiError(method: string, id: string, error: unknown): never {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const detail = JSON.stringify(error.response?.data ?? error.message);
      this.logger.error(`cm1 ${method}(${id}) HTTP ${status}: ${detail}`);

      if (status === 401 || status === 403) {
        throw new ServiceUnavailableException(
          'CHANNEL_MANAGER_ERROR: cm1 authentication failed — check CM1_API_KEY and CM1_CHANNEL_ID',
        );
      }
      if (status === 429) {
        throw new ServiceUnavailableException(
          'CHANNEL_MANAGER_ERROR: cm1 rate limit exceeded — retry later',
        );
      }
    }
    throw new InternalServerErrorException(`CHANNEL_MANAGER_ERROR: cm1 ${method} failed`);
  }
}
