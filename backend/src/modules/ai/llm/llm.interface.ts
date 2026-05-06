import { AiConversationMessage } from '../ai.service';

export interface LlmProvider {
  generateReply(
    messages: AiConversationMessage[],
    systemPrompt: string,
  ): Promise<string>;
}
