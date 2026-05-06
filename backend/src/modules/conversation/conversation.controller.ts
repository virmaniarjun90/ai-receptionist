import { Controller, Get, Param } from '@nestjs/common';
import { Message, Prisma } from '@prisma/client';
import { ConversationService } from './conversation.service';

@Controller('conversations')
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @Get()
  async listConversations(): Promise<
    Prisma.ConversationGetPayload<{
      include: { property: true; messages: { take: 1; orderBy: { createdAt: 'desc' } } };
    }>[]
  > {
    return this.conversationService.listConversations();
  }

  @Get(':phoneNumber/messages')
  async listMessages(
    @Param('phoneNumber') phoneNumber: string,
  ): Promise<Message[]> {
    return this.conversationService.listMessagesForParticipant(phoneNumber);
  }

  @Get(':id')
  async getConversation(
    @Param('id') id: string,
  ): Promise<
    Prisma.ConversationGetPayload<{
      include: { property: true; messages: { orderBy: { createdAt: 'asc' } } };
    }>
  > {
    return this.conversationService.getConversationById(id);
  }
}
