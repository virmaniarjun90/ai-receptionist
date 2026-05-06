import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import {
  DEFAULT_PROPERTY_ID,
  DEFAULT_TENANT_ID,
} from '../src/modules/property/property.constants';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  await prisma.tenant.upsert({
    where: { id: DEFAULT_TENANT_ID },
    update: {
      name: 'Development Tenant',
      type: 'hotel',
    },
    create: {
      id: DEFAULT_TENANT_ID,
      name: 'Development Tenant',
      type: 'hotel',
    },
  });

  await prisma.property.upsert({
    where: { id: DEFAULT_PROPERTY_ID },
    update: {
      tenantId: DEFAULT_TENANT_ID,
      name: 'Development Hotel',
      type: 'hotel',
      description: 'Default property used for local WhatsApp testing.',
      checkInTime: '2:00 PM',
      checkOutTime: '11:00 AM',
      amenities: ['Wi-Fi', 'Breakfast', 'Room service'],
      policies: ['Valid ID is required at check-in'],
    },
    create: {
      id: DEFAULT_PROPERTY_ID,
      tenantId: DEFAULT_TENANT_ID,
      name: 'Development Hotel',
      type: 'hotel',
      description: 'Default property used for local WhatsApp testing.',
      checkInTime: '2:00 PM',
      checkOutTime: '11:00 AM',
      amenities: ['Wi-Fi', 'Breakfast', 'Room service'],
      policies: ['Valid ID is required at check-in'],
    },
  });

  await prisma.knowledge.upsert({
    where: {
      propertyId_key: {
        propertyId: DEFAULT_PROPERTY_ID,
        key: 'parking',
      },
    },
    update: {
      value: 'Free parking is available for in-house guests.',
    },
    create: {
      propertyId: DEFAULT_PROPERTY_ID,
      key: 'parking',
      value: 'Free parking is available for in-house guests.',
    },
  });

  await prisma.knowledge.upsert({
    where: {
      propertyId_key: {
        propertyId: DEFAULT_PROPERTY_ID,
        key: 'breakfast',
      },
    },
    update: {
      value: 'Breakfast is served from 7:00 AM to 10:00 AM.',
    },
    create: {
      propertyId: DEFAULT_PROPERTY_ID,
      key: 'breakfast',
      value: 'Breakfast is served from 7:00 AM to 10:00 AM.',
    },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
