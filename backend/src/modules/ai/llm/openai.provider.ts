import { Inject, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { APP_CONFIG, AppConfig } from '../../../config/app.config';
import { AiConversationMessage } from '../ai.service';
import { LlmProvider } from './llm.interface';

@Injectable()
export class OpenAiProvider implements LlmProvider {
  private readonly logger = new Logger(OpenAiProvider.name);
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.client = new OpenAI({ apiKey: config.llm.openaiApiKey });
    this.model = config.llm.openaiModel;
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
      this.logger.error('OpenAI request failed', error);
      throw new InternalServerErrorException('AI_SERVICE_ERROR: OpenAI request failed');
    }
  }
}
