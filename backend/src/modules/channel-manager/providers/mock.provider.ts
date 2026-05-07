import { Injectable } from '@nestjs/common';
import {
  ChannelManagerProvider,
  ExternalListingDetails,
  ExternalReservation,
} from '../channel-manager.interface';

/**
 * Mock channel manager for local development.
 * Returns realistic fixtures so the full sync flow can be tested without
 * real Airbnb API credentials.
 */
@Injectable()
export class MockChannelManagerProvider implements ChannelManagerProvider {
  readonly providerName = 'mock';

  async getListingDetails(_externalId: string): Promise<ExternalListingDetails> {
    return {
      externalId: 'MOCK-LISTING-001',
      name: 'Sunset Villa',
      description: 'A beautiful 3-bedroom villa with ocean views.',
      address: '123 Ocean Drive, Miami Beach, FL 33139',
      checkInTime: '3:00 PM',
      checkOutTime: '11:00 AM',
      amenities: [
        'High-speed Wi-Fi',
        'Heated pool',
        'Full kitchen',
        'BBQ grill',
        'Beach access',
        'Free parking',
      ],
      policies: [
        'No smoking on premises',
        'No parties or events',
        'Pets allowed with prior approval',
      ],
      knowledge: {
        wifi_name: 'SunsetVilla_5G',
        wifi_password: 'Welcome2024!',
        check_in_process: 'Self check-in with keypad code. Code sent 24h before arrival.',
        parking: 'Two spots in the driveway. Street parking also available.',
        nearest_supermarket: 'Publix is 0.5 miles away on Collins Ave.',
      },
    };
  }

  async getReservations(_externalId: string): Promise<ExternalReservation[]> {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const twoWeeks = new Date(now);
    twoWeeks.setDate(twoWeeks.getDate() + 14);

    return [
      {
        externalId: 'MOCK-RES-001',
        guestName: 'Sarah Johnson',
        guestPhone: 'whatsapp:+911234567890',
        guestEmail: 'sarah@example.com',
        checkIn: now,
        checkOut: nextWeek,
        guestCount: 2,
        status: 'confirmed',
        notes: 'Anniversary trip. Requested late checkout.',
      },
      {
        externalId: 'MOCK-RES-002',
        guestName: 'Michael Chen',
        guestPhone: 'whatsapp:+19175550199',
        checkIn: nextWeek,
        checkOut: twoWeeks,
        guestCount: 4,
        status: 'confirmed',
        notes: 'Family vacation.',
      },
    ];
  }
}
