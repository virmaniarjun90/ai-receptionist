import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CHANNEL_MANAGER_PROVIDER, ChannelManagerProvider } from './channel-manager.interface';

export type SyncResult = {
  propertyId: string;
  provider: string;
  reservationsSynced: number;
  knowledgeEntriesSynced: number;
  errors: string[];
};

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CHANNEL_MANAGER_PROVIDER)
    private readonly channelManager: ChannelManagerProvider,
  ) {}

  async syncProperty(propertyId: string): Promise<SyncResult> {
    const property = await this.prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) throw new NotFoundException(`Property ${propertyId} not found`);

    const externalId = property.externalId;
    if (!externalId) {
      return {
        propertyId,
        provider: this.channelManager.providerName,
        reservationsSynced: 0,
        knowledgeEntriesSynced: 0,
        errors: ['Property has no externalId — set it to the listing ID in your channel manager'],
      };
    }

    const errors: string[] = [];
    let reservationsSynced = 0;
    let knowledgeEntriesSynced = 0;

    try {
      const listing = await this.channelManager.getListingDetails(externalId);

      await this.prisma.property.update({
        where: { id: propertyId },
        data: {
          name: listing.name ?? property.name,
          description: listing.description ?? property.description,
          address: listing.address ?? property.address,
          checkInTime: listing.checkInTime ?? property.checkInTime,
          checkOutTime: listing.checkOutTime ?? property.checkOutTime,
          amenities: listing.amenities ?? property.amenities,
          policies: listing.policies ?? property.policies,
        },
      });

      if (listing.knowledge) {
        for (const [key, value] of Object.entries(listing.knowledge)) {
          await this.prisma.knowledge.upsert({
            where: { propertyId_key: { propertyId, key } },
            update: { value },
            create: { propertyId, key, value },
          });
          knowledgeEntriesSynced++;
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Listing sync failed for property ${propertyId}`, msg);
      errors.push(`Listing sync failed: ${msg}`);
    }

    try {
      const reservations = await this.channelManager.getReservations(externalId);

      for (const res of reservations) {
        if (!res.externalId) continue;
        await this.prisma.reservation.upsert({
          where: { propertyId_externalId: { propertyId, externalId: res.externalId } },
          update: {
            guestName: res.guestName,
            guestPhone: res.guestPhone ?? null,
            checkIn: res.checkIn,
            checkOut: res.checkOut,
            guestCount: res.guestCount,
            status: res.status,
            notes: res.notes ?? null,
            rawData: res.rawData ? JSON.parse(JSON.stringify(res.rawData)) : undefined,
          },
          create: {
            propertyId,
            externalId: res.externalId,
            guestName: res.guestName,
            guestPhone: res.guestPhone ?? null,
            checkIn: res.checkIn,
            checkOut: res.checkOut,
            guestCount: res.guestCount,
            status: res.status,
            notes: res.notes ?? null,
            rawData: res.rawData ? JSON.parse(JSON.stringify(res.rawData)) : undefined,
          },
        });
        reservationsSynced++;
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Reservation sync failed for property ${propertyId}`, msg);
      errors.push(`Reservation sync failed: ${msg}`);
    }

    this.logger.log(
      `Sync complete for property ${propertyId} via ${this.channelManager.providerName}: ` +
      `${reservationsSynced} reservations, ${knowledgeEntriesSynced} knowledge entries`,
    );

    return {
      propertyId,
      provider: this.channelManager.providerName,
      reservationsSynced,
      knowledgeEntriesSynced,
      errors,
    };
  }
}
