import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { AiConversationMessage } from '../ai.service';
import { LlmProvider } from './llm.interface';

@Injectable()
export class KimiProvider implements LlmProvider {
  async generateReply(
    messages: AiConversationMessage[],
    systemPrompt: string,
  ): Promise<string> {
    void messages;
    void systemPrompt;

    throw new ServiceUnavailableException(
      'AI_SERVICE_ERROR: Kimi provider is configured but not implemented yet',
    );
  }
}
