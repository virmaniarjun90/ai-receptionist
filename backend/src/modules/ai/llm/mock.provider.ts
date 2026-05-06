import { Injectable } from '@nestjs/common';
import { AiConversationMessage } from '../ai.service';
import { LlmProvider } from './llm.interface';

@Injectable()
export class MockProvider implements LlmProvider {
  async generateReply(
    messages: AiConversationMessage[],
    systemPrompt: string,
  ): Promise<string> {
    void systemPrompt;

    console.log('[LLM] Using MOCK provider');

    const lastUserMessage =
      [...messages].reverse().find((message) => message.role === 'user')
        ?.content ?? 'Hello';

    if (/room|rooms|available|availability/i.test(lastUserMessage)) {
      return `[MOCK RESPONSE] We have rooms available. (You said: ${lastUserMessage})`;
    }

    return `[MOCK RESPONSE] You said: ${lastUserMessage}`;
  }
}
