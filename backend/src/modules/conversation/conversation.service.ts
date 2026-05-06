import { Injectable, InternalServerErrorException } from '@nestjs/common';
import {
  Channel,
  Conversation,
  Message,
  MessageRole,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { DEFAULT_PROPERTY_ID } from '../property/property.constants';

type CreateMessageInput = {
  from: string;
  to: string;
  content: string;
  role: MessageRole;
};

@Injectable()
export class ConversationService {
  constructor(private readonly prisma: PrismaService) {}

  async recordMessage(input: CreateMessageInput): Promise<Message> {
    const userPhone = input.role === 'user' ? input.from : input.to;
    const conversation = await this.getOrCreateConversation(userPhone);

    return this.prisma.message.create({
      data: {
        ...input,
        conversationId: conversation.id,
      },
    });
  }

  async getOrCreateConversation(
    userPhone: string,
    propertyId = DEFAULT_PROPERTY_ID,
    channel: Channel = 'whatsapp',
  ): Promise<Conversation> {
    try {
      const existingConversation = await this.prisma.conversation.findFirst({
        where: {
          propertyId,
          userPhone,
          channel,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (existingConversation) {
        return existingConversation;
      }

      return await this.prisma.conversation.create({
        data: {
          propertyId,
          userPhone,
          channel,
        },
      });
    } catch (error) {
      throw new InternalServerErrorException(
        'CONVERSATION_SERVICE_ERROR: DB conversation lookup/create failed',
      );
    }
  }

  async getRecentMessages(
    conversationId: string,
    limit = 10,
  ): Promise<Message[]> {
    try {
      const messages = await this.prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      // Keep prompts coherent by passing conversation context chronologically.
      return messages.reverse();
    } catch (error) {
      throw new InternalServerErrorException(
        'CONVERSATION_SERVICE_ERROR: DB recent messages query failed',
      );
    }
  }

  async addMessage(
    conversationId: string,
    content: string,
    role: MessageRole,
  ): Promise<Message> {
    try {
      const conversation = await this.prisma.conversation.findUniqueOrThrow({
        where: { id: conversationId },
      });
      const receptionistPhone =
        process.env.TWILIO_WHATSAPP_NUMBER ?? 'assistant';

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
        where: {
          OR: [{ from: phoneNumber }, { to: phoneNumber }],
        },
        orderBy: { createdAt: 'asc' },
      });
    } catch (error) {
      throw new InternalServerErrorException(
        'CONVERSATION_SERVICE_ERROR: DB participant messages query failed',
      );
    }
  }

  async listConversations(): Promise<
    Prisma.ConversationGetPayload<{
      include: { property: true; messages: { take: 1; orderBy: { createdAt: 'desc' } } };
    }>[]
  > {
    try {
      return await this.prisma.conversation.findMany({
        include: {
          property: true,
          messages: {
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      throw new InternalServerErrorException(
        'CONVERSATION_SERVICE_ERROR: DB conversations query failed',
      );
    }
  }

  async getConversationById(
    id: string,
  ): Promise<
    Prisma.ConversationGetPayload<{
      include: { property: true; messages: { orderBy: { createdAt: 'asc' } } };
    }>
  > {
    try {
      return await this.prisma.conversation.findUniqueOrThrow({
        where: { id },
        include: {
          property: true,
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });
    } catch (error) {
      throw new InternalServerErrorException(
        'CONVERSATION_SERVICE_ERROR: DB conversation lookup failed',
      );
    }
  }
}
