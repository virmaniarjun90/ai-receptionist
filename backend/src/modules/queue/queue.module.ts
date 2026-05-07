import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { APP_CONFIG, AppConfig } from '../../config/app.config';
import { AiModule } from '../ai/ai.module';
import { CommunicationModule } from '../communication/communication.module';
import { ConversationModule } from '../conversation/conversation.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { PropertyModule } from '../property/property.module';
import { ReservationModule } from '../reservation/reservation.module';
import { QueueProcessor } from './queue.processor';
import { QueueService } from './queue.service';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        connection: {
          host: config.redis.host,
          port: config.redis.port,
          maxRetriesPerRequest: null,
        },
      }),
    }),
    BullModule.registerQueue({ name: 'message-processing' }),
    AiModule,
    CommunicationModule,
    ConversationModule,
    KnowledgeModule,
    PropertyModule,
    ReservationModule,
  ],
  providers: [QueueService, QueueProcessor],
  exports: [QueueService],
})
export class QueueModule {}
