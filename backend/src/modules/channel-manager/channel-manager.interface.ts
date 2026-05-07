/**
 * Abstraction over any channel manager (Airbnb, Booking.com, VRBO, etc.).
 * Swap implementations by changing CHANNEL_MANAGER_PROVIDER env var.
 * New provider = new class that implements this interface.
 */

export const CHANNEL_MANAGER_PROVIDER = Symbol('CHANNEL_MANAGER_PROVIDER');

export interface ExternalListingDetails {
  externalId: string;
  name: string;
  description?: string;
  address?: string;
  checkInTime?: string;
  checkOutTime?: string;
  amenities?: string[];
  policies?: string[];
  /** Arbitrary key-value facts to store as Knowledge entries. */
  knowledge?: Record<string, string>;
}

export interface ExternalReservation {
  externalId: string;
  guestName: string;
  guestPhone?: string;
  guestEmail?: string;
  checkIn: Date;
  checkOut: Date;
  guestCount: number;
  status: 'confirmed' | 'cancelled' | 'completed' | 'no_show';
  notes?: string;
  rawData?: Record<string, unknown>;
}

export interface ChannelManagerProvider {
  /** Human-readable name for logs and UI. */
  readonly providerName: string;

  /** Fetch listing details for a given external listing ID. */
  getListingDetails(externalId: string): Promise<ExternalListingDetails>;

  /** Fetch all reservations for a listing. */
  getReservations(externalId: string): Promise<ExternalReservation[]>;
}
