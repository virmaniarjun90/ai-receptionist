import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { QueueService } from '../queue/queue.service';

type TwilioWebhookBody = {
  Body?: string;
  From?: string;
  To?: string;
};

@Controller('webhook')
export class CommunicationController {
  constructor(private readonly queueService: QueueService) {}

  @Post('whatsapp')
  @HttpCode(200)
  async receiveWhatsAppMessage(
    @Body() body: TwilioWebhookBody,
  ): Promise<{ status: 'queued' }> {
    const message = body.Body?.trim() ?? '';
    const from = body.From ?? '';

    // Keep webhook latency low: acknowledge Twilio after enqueuing background work.
    await this.queueService.addMessageJob({
      userPhone: from,
      message,
    });

    return { status: 'queued' };
  }
}
