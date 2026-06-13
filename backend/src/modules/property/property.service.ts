import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Prisma, Property, PropertyHost } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import * as bcrypt from 'bcrypt';
import { DEFAULT_PROPERTY_ID } from './property.constants';

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
  hostAvailabilityTimeoutMin: 3,
  guestGuide: false,
  proactiveMessaging: false,
  menuSharing: false,
};

export function normalizePhone(phone: string): string {
  return phone.trim().replace(/\s+/g, '');
}

export function getPropertyFeatures(property: Property): PropertyFeatures {
  const stored = (property.config as Record<string, unknown> | null)?.features as Partial<PropertyFeatures> | undefined;
  return { ...DEFAULT_PROPERTY_FEATURES, ...stored };
}

export type CreatePropertyInput = {
  name: string;
  tenantId?: string;
  type?: string;
  description?: string;
  address?: string;
  phone?: string;
  phoneNumber?: string;
  externalId?: string;
  checkInTime?: string;
  checkOutTime?: string;
  amenities?: string[];
  policies?: string[];
  config?: Record<string, unknown>;
};

export type UpdatePropertyInput = Partial<CreatePropertyInput>;

export type CreatePropertyHostInput = {
  name: string;
  phone: string;
  pin?: string;
};

export type PropertyHostPublic = Omit<PropertyHost, 'pinHash'> & { hasPin: boolean };

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
      // Try exact match first, then also try with/without whatsapp: prefix
      const clean = phoneNumber.replace(/^whatsapp:/, '');
      const variants = [phoneNumber, `whatsapp:${clean}`, clean];
      for (const variant of variants) {
        const found = await this.prisma.property.findUnique({ where: { phoneNumber: variant } });
        if (found) return found;
      }

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
          phoneNumber: input.phoneNumber ?? null,
          externalId: input.externalId ?? null,
          checkInTime: input.checkInTime ?? null,
          checkOutTime: input.checkOutTime ?? null,
          amenities: input.amenities ?? [],
          policies: input.policies ?? [],
          ...(input.config !== undefined && { config: input.config as unknown as Prisma.InputJsonValue }),
        },
      });
    } catch (error) {
      throw new InternalServerErrorException('PROPERTY_SERVICE_ERROR: DB property insert failed');
    }
  }

  async updateProperty(id: string, input: UpdatePropertyInput): Promise<Property> {
    await this.getById(id);
    try {
      const data: Prisma.PropertyUncheckedUpdateInput = {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.tenantId !== undefined && { tenantId: input.tenantId }),
        ...(input.type !== undefined && { type: input.type }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.address !== undefined && { address: input.address }),
        ...(input.phone !== undefined && { phone: input.phone }),
        ...(input.phoneNumber !== undefined && { phoneNumber: input.phoneNumber }),
        ...(input.externalId !== undefined && { externalId: input.externalId }),
        ...(input.checkInTime !== undefined && { checkInTime: input.checkInTime }),
        ...(input.checkOutTime !== undefined && { checkOutTime: input.checkOutTime }),
        ...(input.amenities !== undefined && { amenities: input.amenities }),
        ...(input.policies !== undefined && { policies: input.policies }),
        ...(input.config !== undefined && { config: input.config as unknown as Prisma.InputJsonValue }),
      };
      return await this.prisma.property.update({ where: { id }, data });
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

  // ─── Hosts ────────────────────────────────────────────────────────────────────

  async listHosts(propertyId: string): Promise<PropertyHostPublic[]> {
    await this.getById(propertyId);
    try {
      const hosts = await this.prisma.propertyHost.findMany({
        where: { propertyId },
        orderBy: { createdAt: 'asc' },
      });
      return hosts.map(({ pinHash, ...h }) => ({ ...h, hasPin: !!pinHash }));
    } catch (error) {
      throw new InternalServerErrorException('PROPERTY_SERVICE_ERROR: DB hosts query failed');
    }
  }

  async addHost(propertyId: string, input: CreatePropertyHostInput): Promise<PropertyHostPublic> {
    await this.getById(propertyId);
    const phone = input.phone.startsWith('whatsapp:') ? input.phone : `whatsapp:${input.phone}`;
    const pinHash = input.pin ? await bcrypt.hash(input.pin, 12) : undefined;
    try {
      const host = await this.prisma.propertyHost.create({
        data: { propertyId, name: input.name, phone, ...(pinHash ? { pinHash } : {}) },
      });
      const { pinHash: _ph, ...rest } = host;
      return { ...rest, hasPin: !!_ph };
    } catch (error) {
      throw new InternalServerErrorException('PROPERTY_SERVICE_ERROR: DB host insert failed');
    }
  }

  async setHostPin(propertyId: string, hostId: string, pin: string): Promise<{ ok: boolean }> {
    const pinHash = await bcrypt.hash(pin, 12);
    try {
      await this.prisma.propertyHost.update({
        where: { id: hostId, propertyId },
        data: { pinHash },
      });
      return { ok: true };
    } catch (error) {
      throw new NotFoundException(`Host ${hostId} not found for property ${propertyId}`);
    }
  }

  async removeHost(propertyId: string, hostId: string): Promise<void> {
    try {
      await this.prisma.propertyHost.delete({ where: { id: hostId, propertyId } });
    } catch (error) {
      throw new NotFoundException(`Host ${hostId} not found for property ${propertyId}`);
    }
  }

  /** Used in queue processor to check if an inbound sender is a registered host. */
  async getHostsForProperty(propertyId: string): Promise<PropertyHost[]> {
    try {
      return await this.prisma.propertyHost.findMany({ where: { propertyId } });
    } catch (error) {
      throw new InternalServerErrorException('PROPERTY_SERVICE_ERROR: DB hosts lookup failed');
    }
  }
}
