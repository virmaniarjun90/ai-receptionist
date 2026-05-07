import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { WebhookController } from './webhook.controller';

// Owns the inbound Twilio webhook. Depends only on QueueModule.
// CommunicationModule (outbound) has NO dependency on this module,
// which is what eliminates the forwardRef circular dependency.
@Module({
  imports: [QueueModule],
  controllers: [WebhookController],
})
export class WebhookModule {}
