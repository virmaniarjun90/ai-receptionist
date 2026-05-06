import { Injectable, InternalServerErrorException } from '@nestjs/common';
import axios from 'axios';
import {
  MessagingProvider,
  SendMessageInput,
} from './messaging.interface';

@Injectable()
export class TwilioProvider implements MessagingProvider {
  async sendMessage(input: SendMessageInput): Promise<void> {
    const accountSid = this.requiredEnv('TWILIO_ACCOUNT_SID');
    const authToken = this.requiredEnv('TWILIO_AUTH_TOKEN');
    const from = this.requiredEnv('TWILIO_WHATSAPP_NUMBER');

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const payload = new URLSearchParams({
      From: from,
      To: input.to,
      Body: input.body,
    });

    try {
      await axios.post(url, payload, {
        auth: {
          username: accountSid,
          password: authToken,
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
    } catch (error) {
      throw new InternalServerErrorException(
        'MESSAGING_SERVICE_ERROR: Twilio request failed',
      );
    }
  }

  private requiredEnv(name: string): string {
    const value = process.env[name];

    if (!value) {
      throw new InternalServerErrorException(
        `MESSAGING_SERVICE_ERROR: Missing environment variable ${name}`,
      );
    }

    return value;
  }
}
