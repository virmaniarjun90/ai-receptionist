import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CommunicationService } from '../communication/communication.service';

// Some hosts are stored with whatsapp: prefix, some without — always check both
function phoneVariants(phone: string): string[] {
  const clean = phone.replace(/^whatsapp:/, '');
  return [clean, `whatsapp:${clean}`];
}

@Injectable()
export class HostService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly communication: CommunicationService,
  ) {}

  async getPropertiesForHost(hostPhone: string): Promise<any[]> {
    const propertyHosts = await this.prisma.propertyHost.findMany({
      where: { phone: { in: phoneVariants(hostPhone) } },
      include: { property: true },
    });

    if (!propertyHosts.length) {
      throw new UnauthorizedException('Host has no properties');
    }

    // Get conversation counts for each property
    const propertiesWithCounts = await Promise.all(
      propertyHosts.map(async (ph) => {
        const count = await this.prisma.conversation.count({
          where: { propertyId: ph.propertyId },
        });
        return {
          id: ph.propertyId,
          name: ph.property.name,
          conversationCount: count,
        };
      }),
    );

    return propertiesWithCounts;
  }

  async getReservationsForProperty(hostPhone: string, propertyId: string): Promise<any[]> {
    const access = await this.prisma.propertyHost.findFirst({
      where: { phone: { in: phoneVariants(hostPhone) }, propertyId },
    });
    if (!access) throw new UnauthorizedException('No access to this property');

    const now = new Date();
    return this.prisma.reservation.findMany({
      where: {
        propertyId,
        status: 'confirmed',
        checkIn: { lte: now },
        checkOut: { gte: now },
      },
      orderBy: { checkIn: 'asc' },
    });
  }

  async getConversationsForProperty(
    hostPhone: string,
    propertyId: string,
  ): Promise<any[]> {
    // Verify host has access to this property
    const access = await this.prisma.propertyHost.findFirst({
      where: { phone: { in: phoneVariants(hostPhone) }, propertyId },
    });

    if (!access) {
      throw new UnauthorizedException('No access to this property');
    }

    const conversations = await this.prisma.conversation.findMany({
      where: { propertyId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Bulk-fetch all hosts for this property to resolve activeHostPhone → name
    const allHosts = await this.prisma.propertyHost.findMany({
      where: { propertyId },
      select: { phone: true, name: true },
    });
    const hostNameByPhone: Record<string, string> = {};
    for (const h of allHosts) hostNameByPhone[h.phone] = h.name;

    // Enrich with guest names from Reservation table
    const enriched = await Promise.all(
      conversations.map(async (conv) => {
        const reservation = await this.prisma.reservation.findFirst({
          where: { propertyId, guestPhone: conv.userPhone },
        });

        return {
          id: conv.id,
          guestPhone: conv.userPhone,
          guestName: reservation?.guestName ?? null,
          status: conv.status,
          activeHostPhone: conv.activeHostPhone,
          activeHostName: conv.activeHostPhone ? (hostNameByPhone[conv.activeHostPhone] ?? null) : null,
          createdAt: conv.createdAt,
          lastMessageAt: conv.messages[conv.messages.length - 1]?.createdAt ?? conv.createdAt,
          messageCount: conv.messages.length,
          lastMessage: conv.messages[conv.messages.length - 1]?.content || '',
        };
      }),
    );

    return enriched;
  }

  async getConversationDetail(
    hostPhone: string,
    conversationId: string,
  ): Promise<any> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        property: true,
      },
    });

    if (!conversation || !conversation.propertyId) {
      throw new UnauthorizedException('Conversation not found');
    }

    // Verify host has access to this property
    const access = await this.prisma.propertyHost.findFirst({
      where: { phone: { in: phoneVariants(hostPhone) }, propertyId: conversation.propertyId },
    });

    if (!access) {
      throw new UnauthorizedException('No access to this conversation');
    }

    // Get guest name
    const reservation = await this.prisma.reservation.findFirst({
      where: {
        propertyId: conversation.propertyId,
        guestPhone: conversation.userPhone,
      },
    });

    // Build phone→name map for all hosts of this property so messages carry senderName
    const allHosts = await this.prisma.propertyHost.findMany({
      where: { propertyId: conversation.propertyId },
      select: { phone: true, name: true },
    });
    const hostNameByPhone: Record<string, string> = {};
    for (const h of allHosts) {
      hostNameByPhone[h.phone] = h.name;
    }

    const enrichedMessages = conversation.messages.map((m) => ({
      ...m,
      senderName: m.from === 'assistant' ? 'AI' : (hostNameByPhone[m.from] ?? 'Host'),
    }));

    return {
      id: conversation.id,
      guestPhone: conversation.userPhone,
      guestName: reservation?.guestName ?? null,
      status: conversation.status,
      activeHostPhone: conversation.activeHostPhone,
      activeHostName: conversation.activeHostName,
      handoffTriggeredAt: conversation.handoffTriggeredAt,
      property: conversation.property,
      messages: enrichedMessages,
      createdAt: conversation.createdAt,
    };
  }

  async getPropertyDetail(hostPhone: string, propertyId: string): Promise<any> {
    // Verify host has access
    const access = await this.prisma.propertyHost.findFirst({
      where: { phone: { in: phoneVariants(hostPhone) }, propertyId },
    });

    if (!access) {
      throw new UnauthorizedException('No access to this property');
    }

    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
    });

    return property;
  }

  async takeOverConversation(conversationId: string, hostPhone: string, hostName: string) {
    try {
      const conversation = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
      });

      if (!conversation) {
        throw new Error('Conversation not found');
      }

      // Verify host has access to this property
      const access = await this.prisma.propertyHost.findFirst({
        where: { phone: { in: phoneVariants(hostPhone) }, propertyId: conversation.propertyId ?? undefined },
      });

      if (!access) {
        throw new Error('No access to this conversation');
      }

      // Update conversation status to "host" — clear handoffTriggeredAt so the
      // dashboard knows this is a dashboard-initiated takeover, not a WhatsApp handoff
      return await this.prisma.conversation.update({
        where: { id: conversationId },
        data: {
          status: 'host',
          activeHostPhone: hostPhone,
          activeHostName: hostName,
          handoffTriggeredAt: null,
        },
        include: {
          messages: { orderBy: { createdAt: 'asc' } },
          property: true,
        },
      });
    } catch (error) {
      throw new Error(`Failed to take over conversation: ${(error as Error).message}`);
    }
  }

  async handBackToAI(conversationId: string, hostPhone: string) {
    try {
      const conversation = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
      });

      if (!conversation) throw new Error('Conversation not found');

      if (conversation.activeHostPhone !== hostPhone) {
        throw new Error('You are not handling this conversation');
      }

      return await this.prisma.conversation.update({
        where: { id: conversationId },
        data: {
          status: 'ai',
          activeHostPhone: null,
          activeHostName: null,
          handoffTriggeredAt: null,
        },
      });
    } catch (error) {
      throw new Error(`Failed to hand back conversation: ${(error as Error).message}`);
    }
  }

  async sendHostMessage(conversationId: string, hostPhone: string, content: string) {
    try {
      const conversation = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
      });

      if (!conversation) {
        throw new Error('Conversation not found');
      }

      // Verify this host is actively handling this conversation
      if (conversation.activeHostPhone !== hostPhone) {
        throw new Error('You are not handling this conversation');
      }

      const property = conversation.propertyId
        ? await this.prisma.property.findUnique({ where: { id: conversation.propertyId } })
        : null;

      const [savedMessage] = await Promise.all([
        this.prisma.message.create({
          data: {
            conversationId,
            content,
            role: 'assistant',
            from: hostPhone,
            to: conversation.userPhone,
          },
        }),
        this.communication.sendWhatsAppMessage({
          to: conversation.userPhone,
          body: content,
          from: property?.phoneNumber ?? undefined,
        }),
      ]);

      return savedMessage;
    } catch (error) {
      throw new Error(`Failed to send message: ${(error as Error).message}`);
    }
  }
}
