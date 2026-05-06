import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Knowledge, Property } from '@prisma/client';
import { FeatureFlagsService } from '../common/feature-flags.service';
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
    private readonly featureFlags: FeatureFlagsService,
    private readonly llmFactory: LlmFactory,
    private readonly piiService: PiiService,
    private readonly promptService: PromptService,
  ) {}

  async generateReply(
    messages: AiConversationMessage[],
    property: Property | null = null,
    knowledge: Knowledge[] = [],
  ): Promise<string> {
    const conversationMessages = messages.filter((message) =>
      message.content.trim(),
    );

    if (conversationMessages.length === 0) {
      return 'How may I help you today?';
    }

    if (!this.featureFlags.isAiEnabled()) {
      return 'AI replies are temporarily disabled. A receptionist will follow up shortly.';
    }

    try {
      const sanitizedMessages =
        this.piiService.sanitizeMessages(conversationMessages);
      const systemPrompt = this.promptService.buildSystemPrompt(
        property,
        knowledge,
      );

      return await this.llmFactory
        .getProvider()
        .generateReply(sanitizedMessages, systemPrompt);
    } catch (error) {
      // Keep provider details out of the HTTP response while preserving a clear failure boundary.
      throw new InternalServerErrorException(
        'AI_SERVICE_ERROR: LLM reply generation failed',
      );
    }
  }
}
