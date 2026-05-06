import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { ClaudeProvider } from './llm/claude.provider';
import { KimiProvider } from './llm/kimi.provider';
import { LlmFactory } from './llm/llm.factory';
import { MockProvider } from './llm/mock.provider';
import { OpenAiProvider } from './llm/openai.provider';
import { PiiService } from './pii.service';
import { PromptService } from './prompt.service';

// AiModule isolates LLM-specific behavior from delivery channels like WhatsApp.
@Module({
  controllers: [AiController],
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
  exports: [AiService, PiiService],
})
export class AiModule {}
