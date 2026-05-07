import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { GuestToken, Knowledge, Property, Reservation } from '@prisma/client';
import { APP_CONFIG, AppConfig } from '../../config/app.config';
import { PrismaService } from '../common/prisma.service';
import { CommunicationService } from '../communication/communication.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { PropertyService } from '../property/property.service';
import { ReservationService } from '../reservation/reservation.service';

export type RegisterGuestInput = {
  propertyId: string;
  guestName: string;
  guestPhone: string;
  checkIn: Date;
  checkOut: Date;
  guestCount?: number;
};

export type WelcomeKitData = {
  property: Property;
  reservation: Reservation;
  knowledge: Knowledge[];
  expired: boolean;
};

@Injectable()
export class GuestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly propertyService: PropertyService,
    private readonly reservationService: ReservationService,
    private readonly knowledgeService: KnowledgeService,
    private readonly communicationService: CommunicationService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async register(input: RegisterGuestInput): Promise<{ reservation: Reservation; welcomeUrl: string }> {
    const property = await this.propertyService.getById(input.propertyId);

    const reservation = await this.reservationService.create({
      propertyId: input.propertyId,
      guestName: input.guestName,
      guestPhone: input.guestPhone,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      guestCount: input.guestCount ?? 1,
    });

    const token = await this.prisma.guestToken.create({
      data: {
        reservationId: reservation.id,
        propertyId: input.propertyId,
        expiresAt: input.checkOut,
      },
    });

    const welcomeUrl = `${this.config.appUrl}/guest/welcome/${token.token}`;

    await this.sendWelcomeMessage(property, reservation, welcomeUrl, input.guestPhone);

    return { reservation, welcomeUrl };
  }

  async getWelcomeKit(token: string): Promise<WelcomeKitData> {
    const guestToken = await this.prisma.guestToken.findUnique({
      where: { token },
      include: { reservation: true, property: true },
    });

    if (!guestToken) throw new NotFoundException('Welcome link not found');

    const expired = guestToken.expiresAt < new Date();
    const knowledge = expired
      ? []
      : await this.knowledgeService.getKnowledgeByProperty(guestToken.propertyId);

    return {
      property: guestToken.property,
      reservation: guestToken.reservation,
      knowledge,
      expired,
    };
  }

  getTokenByReservation(reservationId: string): Promise<GuestToken | null> {
    return this.prisma.guestToken.findFirst({ where: { reservationId } });
  }

  private async sendWelcomeMessage(
    property: Property,
    reservation: Reservation,
    welcomeUrl: string,
    guestPhone: string,
  ): Promise<void> {
    const firstName = reservation.guestName.split(' ')[0];
    const checkIn = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(reservation.checkIn));
    const checkOut = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(reservation.checkOut));

    const body =
      `Hi ${firstName}! Welcome to ${property.name} 🏡\n\n` +
      `Your stay: ${checkIn} → ${checkOut}\n\n` +
      `Here's your digital welcome guide:\n${welcomeUrl}\n\n` +
      `Feel free to WhatsApp me anytime with questions — I'm your 24/7 AI assistant. ` +
      `Need the host directly? Just ask and I'll connect you.`;

    await this.communicationService.sendWhatsAppMessage({
      to: guestPhone,
      body,
      from: property.phoneNumber ?? undefined,
    });
  }
}
