import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Reservation, ReservationStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';

export type CreateReservationInput = {
  propertyId: string;
  guestName: string;
  guestPhone?: string;
  checkIn: Date;
  checkOut: Date;
  guestCount?: number;
  notes?: string;
  externalId?: string;
};

export type UpdateReservationInput = Partial<Omit<CreateReservationInput, 'propertyId'>> & {
  status?: ReservationStatus;
};

@Injectable()
export class ReservationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Look up an active (confirmed, currently staying) reservation by guest phone.
   * This is the key call during message processing: it lets the AI greet guests by
   * name and answer questions about their specific booking.
   */
  async getActiveReservationByPhone(
    guestPhone: string,
    propertyId: string,
  ): Promise<Reservation | null> {
    try {
      const now = new Date();
      return await this.prisma.reservation.findFirst({
        where: {
          guestPhone,
          propertyId,
          status: 'confirmed',
          checkIn: { lte: new Date(now.getTime() + 24 * 60 * 60 * 1000) }, // arriving within 24h
          checkOut: { gte: now },
        },
        orderBy: { checkIn: 'asc' },
      });
    } catch (error) {
      throw new InternalServerErrorException(
        'RESERVATION_SERVICE_ERROR: Active reservation lookup failed',
      );
    }
  }

  async listByProperty(propertyId: string): Promise<Reservation[]> {
    try {
      return await this.prisma.reservation.findMany({
        where: { propertyId },
        orderBy: { checkIn: 'asc' },
      });
    } catch (error) {
      throw new InternalServerErrorException(
        'RESERVATION_SERVICE_ERROR: List reservations failed',
      );
    }
  }

  async getById(id: string): Promise<Reservation> {
    try {
      return await this.prisma.reservation.findUniqueOrThrow({ where: { id } });
    } catch (error) {
      throw new NotFoundException(`Reservation ${id} not found`);
    }
  }

  async create(input: CreateReservationInput): Promise<Reservation> {
    try {
      return await this.prisma.reservation.create({
        data: {
          propertyId: input.propertyId,
          guestName: input.guestName,
          guestPhone: input.guestPhone ?? null,
          checkIn: input.checkIn,
          checkOut: input.checkOut,
          guestCount: input.guestCount ?? 1,
          notes: input.notes ?? null,
          externalId: input.externalId ?? null,
        },
      });
    } catch (error) {
      throw new InternalServerErrorException(
        'RESERVATION_SERVICE_ERROR: Create reservation failed',
      );
    }
  }

  async update(id: string, input: UpdateReservationInput): Promise<Reservation> {
    await this.getById(id);
    try {
      return await this.prisma.reservation.update({
        where: { id },
        data: {
          ...(input.guestName !== undefined && { guestName: input.guestName }),
          ...(input.guestPhone !== undefined && { guestPhone: input.guestPhone }),
          ...(input.checkIn !== undefined && { checkIn: input.checkIn }),
          ...(input.checkOut !== undefined && { checkOut: input.checkOut }),
          ...(input.guestCount !== undefined && { guestCount: input.guestCount }),
          ...(input.notes !== undefined && { notes: input.notes }),
          ...(input.status !== undefined && { status: input.status }),
        },
      });
    } catch (error) {
      throw new InternalServerErrorException(
        'RESERVATION_SERVICE_ERROR: Update reservation failed',
      );
    }
  }

  async cancel(id: string): Promise<Reservation> {
    return this.update(id, { status: 'cancelled' });
  }

  async anonymizeGuest(phone: string): Promise<{ reservations: number }> {
    const affected = await this.prisma.reservation.findMany({
      where: { guestPhone: phone },
      select: { id: true },
    });
    const ids = affected.map((r) => r.id);

    await this.prisma.guestToken.deleteMany({ where: { reservationId: { in: ids } } });

    await this.prisma.reservation.updateMany({
      where: { id: { in: ids } },
      data: { guestPhone: null, guestName: '[Guest deleted]' },
    });

    return { reservations: ids.length };
  }
}
