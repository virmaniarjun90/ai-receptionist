import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import {
  DEFAULT_PROPERTY_ID,
  DEFAULT_TENANT_ID,
} from '../src/modules/property/property.constants';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const tenant = await prisma.tenant.upsert({
    where: { id: DEFAULT_TENANT_ID },
    update: {},
    create: {
      id: DEFAULT_TENANT_ID,
      name: 'Development Tenant',
      type: 'airbnb',
    },
  });

  const property = await prisma.property.upsert({
    where: { id: DEFAULT_PROPERTY_ID },
    update: {
      hostPhone: process.env.HOST_WHATSAPP_NUMBER ?? 'whatsapp:+15550000001',
    },
    create: {
      id: DEFAULT_PROPERTY_ID,
      tenantId: tenant.id,
      name: 'Sunset Villa',
      type: 'airbnb',
      description: 'A beautiful 3-bedroom villa with ocean views. Perfect for families and groups.',
      address: '123 Ocean Drive, Miami Beach, FL 33139',
      phone: '+1 (305) 555-0100',
      // Set this to match TWILIO_WHATSAPP_NUMBER for single-property setups.
      // Each property in a multi-property deployment has its own WhatsApp number.
      phoneNumber: process.env.TWILIO_WHATSAPP_NUMBER ?? null,
      hostPhone: process.env.HOST_WHATSAPP_NUMBER ?? 'whatsapp:+15550000001',
      checkInTime: '3:00 PM',
      checkOutTime: '11:00 AM',
      amenities: [
        'High-speed Wi-Fi',
        'Heated pool',
        'Full kitchen',
        'BBQ grill',
        'Beach access',
        'Free parking',
        'Air conditioning',
        'Smart TV',
      ],
      policies: [
        'No smoking on premises',
        'No parties or events',
        'Pets allowed with prior approval',
        'Valid ID required at check-in',
        'Quiet hours: 10 PM – 8 AM',
      ],
    },
  });

  const knowledgeEntries = [
    { key: 'wifi_name', value: 'SunsetVilla_5G' },
    { key: 'wifi_password', value: 'Welcome2024!' },
    { key: 'parking', value: 'Two parking spots in the driveway. Street parking also available.' },
    { key: 'nearest_supermarket', value: 'Publix is 0.5 miles away on Collins Ave. Open 7am–11pm.' },
    { key: 'pool_hours', value: 'Pool is available 8 AM to 10 PM. No lifeguard on duty.' },
    { key: 'check_in_process', value: 'Self check-in with keypad code. Code sent 24h before arrival via Airbnb message.' },
    { key: 'early_check_in', value: 'Early check-in before 3 PM subject to availability. Contact us the morning of arrival.' },
    { key: 'late_checkout', value: 'Late checkout until 1 PM available for $50 fee, subject to availability.' },
    { key: 'trash', value: 'Trash pickup is Tuesday and Friday. Bins are in the side yard.' },
    { key: 'emergency_contact', value: 'For emergencies: +1 (305) 555-0199 (available 24/7).' },
  ];

  for (const entry of knowledgeEntries) {
    await prisma.knowledge.upsert({
      where: { propertyId_key: { propertyId: property.id, key: entry.key } },
      update: { value: entry.value },
      create: { propertyId: property.id, ...entry },
    });
  }

  // Guest 1 — Arjun (registered via manual form, check-in today)
  await prisma.reservation.upsert({
    where: { propertyId_externalId: { propertyId: property.id, externalId: 'DEMO-ARJUN-001' } },
    update: {
      guestName: 'Arjun Virmani',
      guestPhone: 'whatsapp:+918802078873',
      checkIn: new Date('2026-05-07T15:00:00Z'),
      checkOut: new Date('2026-05-12T11:00:00Z'),
      status: 'confirmed',
    },
    create: {
      propertyId: property.id,
      externalId: 'DEMO-ARJUN-001',
      guestName: 'Arjun Virmani',
      guestPhone: 'whatsapp:+918802078873',
      checkIn: new Date('2026-05-07T15:00:00Z'),
      checkOut: new Date('2026-05-12T11:00:00Z'),
      status: 'confirmed',
      guestCount: 1,
      notes: 'Registered via pilot form.',
    },
  });

  // Guest 2 — Kunal (registered via manual form, check-in today)
  await prisma.reservation.upsert({
    where: { propertyId_externalId: { propertyId: property.id, externalId: 'DEMO-KUNAL-001' } },
    update: {
      guestName: 'Kunal',
      guestPhone: 'whatsapp:+918570846127',
      checkIn: new Date('2026-05-07T15:00:00Z'),
      checkOut: new Date('2026-05-12T11:00:00Z'),
      status: 'confirmed',
    },
    create: {
      propertyId: property.id,
      externalId: 'DEMO-KUNAL-001',
      guestName: 'Kunal',
      guestPhone: 'whatsapp:+918570846127',
      checkIn: new Date('2026-05-07T15:00:00Z'),
      checkOut: new Date('2026-05-12T11:00:00Z'),
      status: 'confirmed',
      guestCount: 2,
      notes: 'Registered via pilot form.',
    },
  });

  console.log(
    `Seeded: tenant "${tenant.name}", property "${property.name}", ` +
    `${knowledgeEntries.length} knowledge entries, 2 demo reservations (Arjun + Kunal).`,
  );
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
