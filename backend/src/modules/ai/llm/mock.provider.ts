import { Injectable } from '@nestjs/common';
import { AiConversationMessage } from '../ai.service';
import { LlmProvider } from './llm.interface';

// Questions that require a human — AI should hand off these
const HANDOFF_PATTERNS =
  /taxi|cab|uber|ola|book.*for me|room service|extra towel|laundry|deliver|recommend.*restaurant|favourite.*place|best.*restaurant|outside the property|i need.*help with|can you arrange|complaint/i;

// Patterns mapped to knowledge keys we expect in the system prompt
const TOPIC_PATTERNS: Array<[RegExp, string[]]> = [
  [/wi.?fi|wifi|internet|password|network/i, ['wifi_password', 'wifi_name', 'wifi']],
  [/check.?in|checkin|arrival|arrive/i, ['check_in_process', 'check_in', 'checkin']],
  [/check.?out|checkout|departure|leave|depart/i, ['late_checkout', 'check_out', 'checkout']],
  [/parking|car|vehicle|park/i, ['parking']],
  [/pool|swim|swimming/i, ['pool_hours', 'pool']],
  [/breakfast|food|eat|meal|dining/i, ['breakfast', 'meals', 'food']],
  [/supermarket|grocery|groceries|shop|store/i, ['nearest_supermarket', 'supermarket', 'grocery']],
  [/trash|garbage|bin|rubbish/i, ['trash', 'garbage']],
  [/emergency|urgent|help|problem/i, ['emergency_contact', 'emergency']],
  [/early.*check.?in|arrive early/i, ['early_check_in']],
];

@Injectable()
export class MockProvider implements LlmProvider {
  async generateReply(messages: AiConversationMessage[], systemPrompt: string): Promise<string> {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
    const lower = lastUserMsg.toLowerCase();
    const knowledge = parseKnowledge(systemPrompt);
    const guestName = parseGuestName(systemPrompt);

    // Greeting — personalise if we know the guest
    if (/^(hi|hello|hey|good morning|good evening|howdy)\b/i.test(lower.trim())) {
      const propertyName = parsePropertyName(systemPrompt);
      const greeting = guestName
        ? `Hi ${guestName}! Great to have you at ${propertyName}. How can I help you today?`
        : `Hi there! Welcome to ${propertyName}. How can I help?`;
      return greeting;
    }

    // Out-of-scope — trigger host handoff
    if (HANDOFF_PATTERNS.test(lastUserMsg)) {
      return (
        '[HANDOFF] That\'s something I\'d need the host\'s personal help with. ' +
        'Let me connect you with them right away!'
      );
    }

    // Look up answer from knowledge base
    for (const [pattern, keys] of TOPIC_PATTERNS) {
      if (pattern.test(lower)) {
        for (const key of keys) {
          if (knowledge[key]) return knowledge[key];
        }
      }
    }

    // Generic fallback — in real mode the LLM synthesises from the full system prompt
    return (
      `I don't have specific information about that in my knowledge base. ` +
      `For anything else, you can also check the welcome guide link we sent you, ` +
      `or I can connect you with the host.`
    );
  }
}

function parseKnowledge(systemPrompt: string): Record<string, string> {
  const result: Record<string, string> = {};
  const section = systemPrompt.match(/Property knowledge:\n([\s\S]*?)(?:\n\n|$)/);
  if (!section) return result;
  for (const line of section[1].split('\n')) {
    const colon = line.indexOf(':');
    if (colon > 0) {
      const key = line.slice(0, colon).trim().toLowerCase();
      const value = line.slice(colon + 1).trim();
      if (key && value) result[key] = value;
    }
  }
  return result;
}

function parseGuestName(systemPrompt: string): string | null {
  const match = systemPrompt.match(/Guest name:\s*([^\n]+)/);
  if (!match) return null;
  return match[1].trim().split(' ')[0]; // first name only
}

function parsePropertyName(systemPrompt: string): string {
  const match = systemPrompt.match(/^Property:\s*([^\n]+)/m);
  return match?.[1]?.trim() ?? 'the property';
}
