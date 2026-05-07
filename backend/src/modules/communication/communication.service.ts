import { Inject, Injectable } from '@nestjs/common';
import {
  MESSAGING_PROVIDER,
  MessagingProvider,
  SendMessageInput,
} from './providers/messaging.interface';

@Injectable()
export class CommunicationService {
  constructor(
    @Inject(MESSAGING_PROVIDER)
    private readonly messagingProvider: MessagingProvider,
  ) {}

  async sendWhatsAppMessage(input: SendMessageInput): Promise<void> {
    await this.messagingProvider.sendMessage(input);
  }
}
