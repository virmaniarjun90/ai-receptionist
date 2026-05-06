import { Module } from '@nestjs/common';
import { KnowledgeService } from './knowledge.service';

// KnowledgeModule owns property-scoped facts used to enrich AI prompts.
@Module({
  providers: [KnowledgeService],
  exports: [KnowledgeService],
})
export class KnowledgeModule {}
