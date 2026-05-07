import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Inject,
  Logger,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import twilio from 'twilio';
import { APP_CONFIG, AppConfig } from '../../config/app.config';
import { QueueService } from '../queue/queue.service';

type TwilioWebhookBody = {
  Body?: string;
  From?: string;
  To?: string;
  [key: string]: string | undefined;
};

@ApiTags('Webhook')
@Controller('webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly queueService: QueueService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Post('whatsapp')
  @HttpCode(200)
  @ApiOperation({ summary: 'Twilio inbound WhatsApp webhook' })
  async receiveWhatsAppMessage(
    @Body() body: TwilioWebhookBody,
    @Headers('x-twilio-signature') signature: string,
    @Req() req: Request,
  ): Promise<{ status: 'queued' }> {
    if (this.config.twilio.validateWebhook) {
      this.validateTwilioSignature(signature, req, body);
    }

    const message = body.Body?.trim() ?? '';
    const userPhone = body.From ?? '';
    const propertyPhone = body.To ?? '';

    if (!userPhone || !message) {
      return { status: 'queued' };
    }

    await this.queueService.addMessageJob({ userPhone, propertyPhone, message });

    this.logger.log(`Queued message from ${userPhone} to ${propertyPhone}`);
    return { status: 'queued' };
  }

  private validateTwilioSignature(
    signature: string,
    req: Request,
    body: TwilioWebhookBody,
  ): void {
    const authToken = this.config.twilio.authToken;
    if (!authToken) {
      this.logger.warn('TWILIO_AUTH_TOKEN not set; skipping webhook signature validation');
      return;
    }

    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const params: Record<string, string> = {};
    for (const [k, v] of Object.entries(body)) {
      if (v !== undefined) params[k] = v;
    }

    if (!twilio.validateRequest(authToken, signature, url, params)) {
      throw new UnauthorizedException('WEBHOOK_ERROR: Invalid Twilio signature');
    }
  }
}
