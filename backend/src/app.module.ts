import { Module } from '@nestjs/common';
import { AiModule } from './modules/ai/ai.module';
import { CommonModule } from './modules/common/common.module';
import { CommunicationModule } from './modules/communication/communication.module';
import { ConversationModule } from './modules/conversation/conversation.module';
import { KnowledgeModule } from './modules/knowledge/knowledge.module';
import { PropertyModule } from './modules/property/property.module';
import { QueueModule } from './modules/queue/queue.module';

@Module({
  imports: [
    CommonModule,
    AiModule,
    PropertyModule,
    KnowledgeModule,
    ConversationModule,
    QueueModule,
    CommunicationModule,
  ],
})
export class AppModule {}
