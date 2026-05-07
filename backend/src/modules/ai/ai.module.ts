import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { ClaudeProvider } from './llm/claude.provider';
import { KimiProvider } from './llm/kimi.provider';
import { LlmFactory } from './llm/llm.factory';
import { MockProvider } from './llm/mock.provider';
import { OpenAiProvider } from './llm/openai.provider';
import { PiiService } from './pii.service';
import { PromptService } from './prompt.service';

@Module({
  providers: [
    AiService,
    PiiService,
    PromptService,
    LlmFactory,
    OpenAiProvider,
    ClaudeProvider,
    KimiProvider,
    MockProvider,
  ],
  exports: [AiService],
})
export class AiModule {}
