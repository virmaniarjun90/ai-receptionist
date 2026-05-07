import { Inject, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import Twilio from 'twilio';
import { APP_CONFIG, AppConfig } from '../../../config/app.config';
import { MessagingProvider, SendMessageInput } from './messaging.interface';

@Injectable()
export class TwilioProvider implements MessagingProvider {
  private readonly logger = new Logger(TwilioProvider.name);
  private readonly client: ReturnType<typeof Twilio>;
  private readonly from: string;
  private readonly appMode: string;
  private readonly demoAllowedNumbers: Set<string>;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    const { accountSid, authToken, whatsappNumber } = config.twilio;

    if (!accountSid || !authToken || !whatsappNumber) {
      this.logger.warn(
        'MESSAGING_SERVICE_WARNING: Twilio credentials incomplete — outbound messages will fail',
      );
    }

    this.client = Twilio(accountSid ?? '', authToken ?? '');
    this.from = whatsappNumber ?? '';
    this.appMode = config.appMode;
    this.demoAllowedNumbers = new Set(config.demoAllowedNumbers);
  }

  async sendMessage(input: SendMessageInput): Promise<void> {
    if (this.appMode === 'demo' && this.demoAllowedNumbers.size > 0) {
      const normalized = input.to.replace(/^whatsapp:/, '');
      const allowed = [...this.demoAllowedNumbers].some(
        (n) => n.replace(/^whatsapp:/, '') === normalized,
      );
      if (!allowed) {
        this.logger.warn(
          `DEMO_MODE: Skipping send to ${input.to} — not in DEMO_ALLOWED_NUMBERS. ` +
          `To receive messages, the number must opt in to the Twilio sandbox first.`,
        );
        return;
      }
    }

    try {
      await this.client.messages.create({
        from: input.from ?? this.from,
        to: input.to,
        body: input.body,
      });
    } catch (error) {
      this.logger.error('MESSAGING_SERVICE_ERROR: Twilio send failed', error);
      throw new InternalServerErrorException('MESSAGING_SERVICE_ERROR: Twilio send failed');
    }
  }
}
