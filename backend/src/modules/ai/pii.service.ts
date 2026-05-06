import { Injectable } from '@nestjs/common';
import { AiConversationMessage } from './ai.service';

@Injectable()
export class PiiService {
  sanitizeMessages(messages: AiConversationMessage[]): AiConversationMessage[] {
    if (process.env.PII_MASKING_ENABLED === 'false') {
      return messages;
    }

    return messages.map((message) => ({
      ...message,
      content: this.sanitizeText(message.content),
    }));
  }

  private sanitizeText(value: string): string {
    return value
      .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[EMAIL]')
      .replace(/\+?\d[\d\s().-]{7,}\d/g, '[PHONE]')
      .replace(/\b(?:booking|reservation|confirmation)\s*(?:id|number|no|#)?\s*[:#-]?\s*[A-Z0-9-]{4,}\b/gi, '[BOOKING_ID]')
      .replace(/\b(?:id|ref|reference)\s*[:#-]?\s*\d{4,}\b/gi, '[IDENTIFIER]')
      .replace(/\b\d{5,8}\b/g, '[IDENTIFIER]')
      .replace(/\b(my name is|this is|i am|i'm)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/g, '$1 [NAME]');
  }
}
