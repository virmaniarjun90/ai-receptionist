import { Inject, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { APP_CONFIG, AppConfig } from '../../../config/app.config';
import { AiConversationMessage } from '../ai.service';
import { LlmProvider } from './llm.interface';

@Injectable()
export class ClaudeProvider implements LlmProvider {
  private readonly logger = new Logger(ClaudeProvider.name);
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.client = new Anthropic({ apiKey: config.llm.anthropicApiKey });
    this.model = config.llm.claudeModel;
  }

  async generateReply(messages: AiConversationMessage[], systemPrompt: string): Promise<string> {
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        system: systemPrompt,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      });

      const block = response.content[0];
      if (block?.type !== 'text') {
        return 'I am sorry, I could not prepare a response right now.';
      }
      return block.text.trim();
    } catch (error) {
      this.logger.error('Anthropic request failed', error);
      throw new InternalServerErrorException('AI_SERVICE_ERROR: Claude request failed');
    }
  }
}
