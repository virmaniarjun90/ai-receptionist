import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Property } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { DEFAULT_PROPERTY_ID } from './property.constants';

export type CreatePropertyInput = {
  name: string;
  tenantId?: string;
  type?: string;
  description?: string;
  address?: string;
  phone?: string;
  hostPhone?: string;
  phoneNumber?: string;
  externalId?: string;
  checkInTime?: string;
  checkOutTime?: string;
  amenities?: string[];
  policies?: string[];
};

export type UpdatePropertyInput = Partial<CreatePropertyInput>;

@Injectable()
export class PropertyService {
  constructor(private readonly prisma: PrismaService) {}

  async listProperties(): Promise<Property[]> {
    try {
      return await this.prisma.property.findMany({ orderBy: { createdAt: 'desc' } });
    } catch (error) {
      throw new InternalServerErrorException('PROPERTY_SERVICE_ERROR: DB properties query failed');
    }
  }

  async getById(id: string): Promise<Property> {
    try {
      return await this.prisma.property.findUniqueOrThrow({ where: { id } });
    } catch (error) {
      throw new NotFoundException(`Property ${id} not found`);
    }
  }

  /**
   * Routes an inbound WhatsApp message to the right property.
   * Each property has its own Twilio WhatsApp number stored in phoneNumber.
   * Falls back to the default property for single-property setups where
   * the seed sets phoneNumber = TWILIO_WHATSAPP_NUMBER.
   */
  async getPropertyByPhone(phoneNumber: string): Promise<Property | null> {
    try {
      const exact = await this.prisma.property.findUnique({ where: { phoneNumber } });
      if (exact) return exact;

      // Fallback for single-property / dev setups: return the default property.
      return await this.prisma.property.findUnique({ where: { id: DEFAULT_PROPERTY_ID } });
    } catch (error) {
      throw new InternalServerErrorException(
        'PROPERTY_SERVICE_ERROR: Property phone lookup failed',
      );
    }
  }

  async createProperty(input: CreatePropertyInput): Promise<Property> {
    try {
      return await this.prisma.property.create({
        data: {
          name: input.name,
          tenantId: input.tenantId ?? null,
          type: input.type ?? null,
          description: input.description ?? null,
          address: input.address ?? null,
          phone: input.phone ?? null,
          hostPhone: input.hostPhone ?? null,
          phoneNumber: input.phoneNumber ?? null,
          externalId: input.externalId ?? null,
          checkInTime: input.checkInTime ?? null,
          checkOutTime: input.checkOutTime ?? null,
          amenities: input.amenities ?? [],
          policies: input.policies ?? [],
        },
      });
    } catch (error) {
      throw new InternalServerErrorException('PROPERTY_SERVICE_ERROR: DB property insert failed');
    }
  }

  async updateProperty(id: string, input: UpdatePropertyInput): Promise<Property> {
    await this.getById(id);
    try {
      return await this.prisma.property.update({
        where: { id },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.tenantId !== undefined && { tenantId: input.tenantId }),
          ...(input.type !== undefined && { type: input.type }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.address !== undefined && { address: input.address }),
          ...(input.phone !== undefined && { phone: input.phone }),
          ...(input.hostPhone !== undefined && { hostPhone: input.hostPhone }),
          ...(input.phoneNumber !== undefined && { phoneNumber: input.phoneNumber }),
          ...(input.externalId !== undefined && { externalId: input.externalId }),
          ...(input.checkInTime !== undefined && { checkInTime: input.checkInTime }),
          ...(input.checkOutTime !== undefined && { checkOutTime: input.checkOutTime }),
          ...(input.amenities !== undefined && { amenities: input.amenities }),
          ...(input.policies !== undefined && { policies: input.policies }),
        },
      });
    } catch (error) {
      throw new InternalServerErrorException('PROPERTY_SERVICE_ERROR: DB property update failed');
    }
  }

  async deleteProperty(id: string): Promise<void> {
    await this.getById(id);
    try {
      await this.prisma.property.delete({ where: { id } });
    } catch (error) {
      throw new InternalServerErrorException('PROPERTY_SERVICE_ERROR: DB property delete failed');
    }
  }
}
