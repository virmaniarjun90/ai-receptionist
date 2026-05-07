import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Knowledge, Property, Reservation } from '@prisma/client';
import { LlmFactory } from './llm/llm.factory';
import { PiiService } from './pii.service';
import { PromptService } from './prompt.service';

export type AiConversationMessage = {
  role: 'user' | 'assistant';
  content: string;
};

@Injectable()
export class AiService {
  constructor(
    private readonly llmFactory: LlmFactory,
    private readonly piiService: PiiService,
    private readonly promptService: PromptService,
  ) {}

  async generateReply(
    messages: AiConversationMessage[],
    property: Property | null = null,
    knowledge: Knowledge[] = [],
    reservation: Reservation | null = null,
  ): Promise<string> {
    const nonEmpty = messages.filter((m) => m.content.trim());
    if (nonEmpty.length === 0) {
      return 'How may I help you today?';
    }

    try {
      const sanitized = this.piiService.sanitizeMessages(nonEmpty);
      const systemPrompt = this.promptService.buildSystemPrompt(property, knowledge, reservation);
      return await this.llmFactory.getProvider().generateReply(sanitized, systemPrompt);
    } catch (error) {
      throw new InternalServerErrorException('AI_SERVICE_ERROR: LLM reply generation failed');
    }
  }
}
