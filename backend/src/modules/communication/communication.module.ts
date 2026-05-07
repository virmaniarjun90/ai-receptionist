import { Module } from '@nestjs/common';
import { CommunicationService } from './communication.service';
import { MESSAGING_PROVIDER } from './providers/messaging.interface';
import { TwilioProvider } from './providers/twilio.provider';

// Owns outbound messaging only. No dependency on QueueModule or WebhookModule.
// The inbound webhook lives in WebhookModule; this keeps the dependency graph acyclic.
@Module({
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
