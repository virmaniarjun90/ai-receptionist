import { forwardRef, Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { CommunicationController } from './communication.controller';
import { CommunicationService } from './communication.service';
import { MESSAGING_PROVIDER } from './providers/messaging.interface';
import { TwilioProvider } from './providers/twilio.provider';

// CommunicationModule owns external channels; today that is Twilio WhatsApp.
@Module({
  imports: [forwardRef(() => QueueModule)],
  controllers: [CommunicationController],
  providers: [
    CommunicationService,
    TwilioProvider,
    {
      provide: MESSAGING_PROVIDER,
      useExisting: TwilioProvider,
    },
  ],
  exports: [CommunicationService],
})
export class CommunicationModule {}
