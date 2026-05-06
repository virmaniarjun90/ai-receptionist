import { Injectable, InternalServerErrorException } from '@nestjs/common';
import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { AiConversationMessage } from '../ai.service';
import { LlmProvider } from './llm.interface';

@Injectable()
export class OpenAiProvider implements LlmProvider {
  private readonly client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  async generateReply(
    messages: AiConversationMessage[],
    systemPrompt: string,
  ): Promise<string> {
    try {
      const promptMessages: ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        ...messages,
      ];

      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: promptMessages,
      });

      return (
        response.choices[0]?.message?.content?.trim() ??
        'I am sorry, I could not prepare a response right now.'
      );
    } catch (error) {
      throw new InternalServerErrorException(
        'AI_SERVICE_ERROR: OpenAI request failed',
      );
    }
  }
}
