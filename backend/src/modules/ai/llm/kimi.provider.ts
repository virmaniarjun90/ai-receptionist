import { Inject, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { APP_CONFIG, AppConfig } from '../../../config/app.config';
import { AiConversationMessage } from '../ai.service';
import { LlmProvider } from './llm.interface';

// Kimi (Moonshot AI) exposes an OpenAI-compatible REST API.
// We reuse the OpenAI SDK with a different baseURL and API key.
@Injectable()
export class KimiProvider implements LlmProvider {
  private readonly logger = new Logger(KimiProvider.name);
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.client = new OpenAI({
      apiKey: config.llm.kimiApiKey,
      baseURL: 'https://api.moonshot.cn/v1',
    });
    this.model = config.llm.kimiModel;
  }

  async generateReply(messages: AiConversationMessage[], systemPrompt: string): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
      });

      return (
        response.choices[0]?.message?.content?.trim() ??
        'I am sorry, I could not prepare a response right now.'
      );
    } catch (error) {
      this.logger.error('Kimi request failed', error);
      throw new InternalServerErrorException('AI_SERVICE_ERROR: Kimi request failed');
    }
  }
}
