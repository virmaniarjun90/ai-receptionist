import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Property } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import {
  DEFAULT_PROPERTY_ID,
  DEFAULT_TENANT_ID,
} from './property.constants';

export type CreatePropertyInput = {
  name: string;
  tenantId?: string;
  type?: string;
  description?: string;
  address?: string;
  phone?: string;
  checkInTime?: string;
  checkOutTime?: string;
  amenities?: string[];
  policies?: string[];
};

@Injectable()
export class PropertyService {
  constructor(private readonly prisma: PrismaService) {}

  async listProperties(): Promise<Property[]> {
    try {
      return await this.prisma.property.findMany({
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      throw new InternalServerErrorException(
        'PROPERTY_SERVICE_ERROR: DB properties query failed',
      );
    }
  }

  async createProperty(input: CreatePropertyInput): Promise<Property> {
    try {
      return await this.prisma.property.create({
        data: {
          name: input.name,
          tenantId: input.tenantId,
          type: input.type,
          description: input.description,
          address: input.address,
          phone: input.phone,
          checkInTime: input.checkInTime,
          checkOutTime: input.checkOutTime,
          amenities: input.amenities ?? [],
          policies: input.policies ?? [],
        },
      });
    } catch (error) {
      throw new InternalServerErrorException(
        'PROPERTY_SERVICE_ERROR: DB property insert failed',
      );
    }
  }

  async getDefaultProperty(): Promise<Property | null> {
    try {
      await this.prisma.tenant.upsert({
        where: { id: DEFAULT_TENANT_ID },
        update: {},
        create: {
          id: DEFAULT_TENANT_ID,
          name: 'Development Tenant',
          type: 'hotel',
        },
      });

      return await this.prisma.property.upsert({
        where: { id: DEFAULT_PROPERTY_ID },
        update: {},
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
    } catch (error) {
      throw new InternalServerErrorException(
        'PROPERTY_SERVICE_ERROR: DB default property query failed',
      );
    }
  }
}
