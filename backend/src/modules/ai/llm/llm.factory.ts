import { Injectable, Logger } from '@nestjs/common';
import { ClaudeProvider } from './claude.provider';
import { KimiProvider } from './kimi.provider';
import { LlmProvider } from './llm.interface';
import { MockProvider } from './mock.provider';
import { OpenAiProvider } from './openai.provider';

type LlmProviderName = 'openai' | 'claude' | 'kimi' | 'mock';

@Injectable()
export class LlmFactory {
  private readonly logger = new Logger(LlmFactory.name);

  constructor(
    private readonly openAiProvider: OpenAiProvider,
    private readonly claudeProvider: ClaudeProvider,
    private readonly kimiProvider: KimiProvider,
    private readonly mockProvider: MockProvider,
  ) {}

  getProvider(): LlmProvider {
    const provider = (process.env.LLM_PROVIDER ?? 'openai') as LlmProviderName;

    if (provider === 'openai' && !process.env.OPENAI_API_KEY) {
      this.logger.warn(
        'AI_SERVICE_WARNING: OPENAI_API_KEY is missing; using mock LLM provider',
      );
      return this.mockProvider;
    }

    switch (provider) {
      case 'mock':
        return this.mockProvider;
      case 'claude':
        return this.claudeProvider;
      case 'kimi':
        return this.kimiProvider;
      case 'openai':
      default:
        return this.openAiProvider;
    }
  }
}
