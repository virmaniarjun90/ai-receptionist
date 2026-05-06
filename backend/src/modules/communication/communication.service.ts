import { Inject, Injectable } from '@nestjs/common';
import {
  MESSAGING_PROVIDER,
  MessagingProvider,
} from './providers/messaging.interface';

type SendWhatsAppMessageInput = {
  to: string;
  body: string;
};

@Injectable()
export class CommunicationService {
  constructor(
    @Inject(MESSAGING_PROVIDER)
    private readonly messagingProvider: MessagingProvider,
  ) {}

  async sendWhatsAppMessage(input: SendWhatsAppMessageInput): Promise<void> {
    await this.messagingProvider.sendMessage(input);
  }
}
