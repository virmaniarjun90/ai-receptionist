import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { APP_CONFIG, AppConfig } from '../../../config/app.config';
import { ClaudeProvider } from './claude.provider';
import { KimiProvider } from './kimi.provider';
import { LlmProvider } from './llm.interface';
import { MockProvider } from './mock.provider';
import { OpenAiProvider } from './openai.provider';

export const LLM_PROVIDER = Symbol('LLM_PROVIDER');

@Injectable()
export class LlmFactory implements OnModuleInit {
  private readonly logger = new Logger(LlmFactory.name);
  private provider!: LlmProvider;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly openAiProvider: OpenAiProvider,
    private readonly claudeProvider: ClaudeProvider,
    private readonly kimiProvider: KimiProvider,
    private readonly mockProvider: MockProvider,
  ) {}

  onModuleInit(): void {
    this.provider = this.resolveProvider();
    this.logger.log(`LLM provider resolved: ${this.config.llm.provider}`);
  }

  getProvider(): LlmProvider {
    return this.provider;
  }

  private resolveProvider(): LlmProvider {
    const name = this.config.llm.provider;

    if (name === 'openai' && !this.config.llm.openaiApiKey) {
      this.logger.warn('OPENAI_API_KEY missing — falling back to mock provider');
      return this.mockProvider;
    }
    if (name === 'claude' && !this.config.llm.anthropicApiKey) {
      this.logger.warn('ANTHROPIC_API_KEY missing — falling back to mock provider');
      return this.mockProvider;
    }
    if (name === 'kimi' && !this.config.llm.kimiApiKey) {
      this.logger.warn('KIMI_API_KEY missing — falling back to mock provider');
      return this.mockProvider;
    }

    switch (name) {
      case 'claude': return this.claudeProvider;
      case 'kimi':   return this.kimiProvider;
      case 'mock':   return this.mockProvider;
      case 'openai':
      default:       return this.openAiProvider;
    }
  }
}
