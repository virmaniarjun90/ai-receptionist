import { BullModule } from '@nestjs/bullmq';
import { forwardRef, Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { CommunicationModule } from '../communication/communication.module';
import { ConversationModule } from '../conversation/conversation.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { PropertyModule } from '../property/property.module';
import { QueueProcessor } from './queue.processor';
import { QueueService } from './queue.service';

// QueueModule decouples webhook receipt from slower AI and Twilio work.
@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT || 6379),
        maxRetriesPerRequest: null,
      },
    }),
    BullModule.registerQueue({
      name: 'message-processing',
    }),
    AiModule,
    ConversationModule,
    KnowledgeModule,
    PropertyModule,
    forwardRef(() => CommunicationModule),
  ],
  providers: [QueueService, QueueProcessor],
  exports: [QueueService],
})
export class QueueModule {}
