import { Inject, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Channel, Conversation, ConversationStatus, Message, MessageRole } from '@prisma/client';
import { APP_CONFIG, AppConfig } from '../../config/app.config';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class ConversationService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async getOrCreateConversation(
    userPhone: string,
    propertyId?: string,
    channel: Channel = 'whatsapp',
  ): Promise<Conversation> {
    try {
      const existing = await this.prisma.conversation.findFirst({
        where: { userPhone, propertyId: propertyId ?? null, channel },
        orderBy: { createdAt: 'desc' },
      });

      if (existing) return existing;

      return await this.prisma.conversation.create({
        data: { userPhone, propertyId: propertyId ?? null, channel },
      });
    } catch (error) {
      throw new InternalServerErrorException(
        'CONVERSATION_SERVICE_ERROR: DB conversation lookup/create failed',
      );
    }
  }

  async setStatus(conversationId: string, status: ConversationStatus): Promise<Conversation> {
    try {
      return await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { status },
      });
    } catch (error) {
      throw new InternalServerErrorException(
        'CONVERSATION_SERVICE_ERROR: Status update failed',
      );
    }
  }

  async setActiveHost(conversationId: string, hostPhone: string | null): Promise<Conversation> {
    try {
      return await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { activeHostPhone: hostPhone },
      });
    } catch (error) {
      throw new InternalServerErrorException(
        'CONVERSATION_SERVICE_ERROR: Active host update failed',
      );
    }
  }

  async setProcessing(conversationId: string, processing: boolean): Promise<Conversation> {
    try {
      return await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { processingAiMessage: processing },
      });
    } catch (error) {
      throw new InternalServerErrorException(
        'CONVERSATION_SERVICE_ERROR: Processing flag update failed',
      );
    }
  }

  async getActiveHostConversation(propertyId: string): Promise<Conversation | null> {
    const statuses: ConversationStatus[] = ['host', 'pending', 'awaiting_host'];
    const found = await this.prisma.conversation.findFirst({
      where: { propertyId, status: { in: statuses } },
      orderBy: { updatedAt: 'desc' },
    });
    if (found) return found;
    // Fallback: legacy conversations with no propertyId (single-property / dev setups)
    return this.prisma.conversation.findFirst({
      where: { propertyId: null, status: { in: statuses } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getRecentMessages(conversationId: string, limit = 10): Promise<Message[]> {
    try {
      const messages = await this.prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
      return messages.reverse();
    } catch (error) {
      throw new InternalServerErrorException(
        'CONVERSATION_SERVICE_ERROR: DB recent messages query failed',
      );
    }
  }

  async addMessage(conversationId: string, content: string, role: MessageRole): Promise<Message> {
    try {
      const conversation = await this.prisma.conversation.findUniqueOrThrow({
        where: { id: conversationId },
      });
      const receptionistPhone = this.config.twilio.whatsappNumber ?? 'assistant';

      return await this.prisma.message.create({
        data: {
          conversationId,
          content,
          role,
          from: role === 'user' ? conversation.userPhone : receptionistPhone,
          to: role === 'user' ? receptionistPhone : conversation.userPhone,
        },
      });
    } catch (error) {
      throw new InternalServerErrorException(
        'CONVERSATION_SERVICE_ERROR: DB message insert failed',
      );
    }
  }

  async listMessagesForParticipant(phoneNumber: string): Promise<Message[]> {
    try {
      return await this.prisma.message.findMany({
        where: { OR: [{ from: phoneNumber }, { to: phoneNumber }] },
        orderBy: { createdAt: 'asc' },
      });
    } catch (error) {
      throw new InternalServerErrorException(
        'CONVERSATION_SERVICE_ERROR: DB participant messages query failed',
      );
    }
  }

  async listConversations() {
    try {
      const conversations = await this.prisma.conversation.findMany({
        include: { property: true, messages: { take: 1, orderBy: { createdAt: 'desc' } } },
        orderBy: { updatedAt: 'desc' },
      });

      const phones = [...new Set(conversations.map((c) => c.userPhone).filter((p) => p !== '[deleted]'))];
      const reservations = phones.length
        ? await this.prisma.reservation.findMany({
            where: { guestPhone: { in: phones }, status: 'confirmed' },
            select: { guestPhone: true, guestName: true, propertyId: true },
          })
        : [];

      const nameMap = new Map<string, string>();
      for (const r of reservations) {
        if (r.guestPhone) {
          nameMap.set(`${r.guestPhone}|${r.propertyId}`, r.guestName);
          if (!nameMap.has(r.guestPhone)) nameMap.set(r.guestPhone, r.guestName);
        }
      }

      // Resolve activeHostPhone → name for dashboard display
      const activePhones = [...new Set(
        conversations.map((c) => c.activeHostPhone).filter((p): p is string => !!p),
      )];
      const activeHosts = activePhones.length
        ? await this.prisma.propertyHost.findMany({
            where: { phone: { in: activePhones } },
            select: { phone: true, name: true },
          })
        : [];
      const hostNameMap = new Map(activeHosts.map((h) => [h.phone, h.name]));

      return conversations.map((c) => ({
        ...c,
        guestName:
          nameMap.get(`${c.userPhone}|${c.propertyId}`) ?? nameMap.get(c.userPhone) ?? null,
        activeHostName: c.activeHostPhone ? (hostNameMap.get(c.activeHostPhone) ?? null) : null,
      }));
    } catch (error) {
      throw new InternalServerErrorException(
        'CONVERSATION_SERVICE_ERROR: DB conversations query failed',
      );
    }
  }

  async getConversationById(id: string) {
    try {
      const conversation = await this.prisma.conversation.findUniqueOrThrow({
        where: { id },
        include: { property: true, messages: { orderBy: { createdAt: 'asc' } } },
      });

      const guestName = conversation.userPhone !== '[deleted]'
        ? await this.prisma.reservation
            .findFirst({
              where: {
                guestPhone: conversation.userPhone,
                ...(conversation.propertyId ? { propertyId: conversation.propertyId } : {}),
                status: 'confirmed',
              },
              select: { guestName: true },
            })
            .then((r) => r?.guestName ?? null)
        : null;

      const activeHostName = conversation.activeHostPhone
        ? await this.prisma.propertyHost
            .findFirst({
              where: {
                phone: conversation.activeHostPhone,
                ...(conversation.propertyId ? { propertyId: conversation.propertyId } : {}),
              },
              select: { name: true },
            })
            .then((h) => h?.name ?? null)
        : null;

      return { ...conversation, guestName, activeHostName };
    } catch (error) {
      throw new NotFoundException(`Conversation ${id} not found`);
    }
  }

  async getStatus(id: string): Promise<ConversationStatus | null> {
    const conv = await this.prisma.conversation.findUnique({
      where: { id },
      select: { status: true },
    });
    return conv?.status ?? null;
  }

  async countAiMessages(conversationId: string): Promise<number> {
    return this.prisma.message.count({
      where: { conversationId, role: 'assistant' },
    });
  }

  async anonymizeGuest(phone: string): Promise<{ conversations: number; messages: number }> {
    const conversations = await this.prisma.conversation.findMany({
      where: { userPhone: phone },
      select: { id: true },
    });
    const conversationIds = conversations.map((c) => c.id);

    const [msgResult] = await Promise.all([
      this.prisma.message.updateMany({
        where: {
          conversationId: { in: conversationIds },
          OR: [{ from: phone }, { to: phone }],
        },
        data: { from: '[deleted]', to: '[deleted]' },
      }),
      this.prisma.conversation.updateMany({
        where: { userPhone: phone },
        data: { userPhone: '[deleted]' },
      }),
    ]);

    return { conversations: conversations.length, messages: msgResult.count };
  }
}
