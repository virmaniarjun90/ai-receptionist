import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { Queue } from 'bullmq';

export type ProcessMessageJobPayload = {
  userPhone: string;
  /** The Twilio WhatsApp number the message was sent TO — used for property routing. */
  propertyPhone: string;
  message: string;
};

export type HostForwardJobPayload = {
  hostPhone: string;
  propertyPhone: string;
  message: string;
};

type JobPayload = ProcessMessageJobPayload | HostForwardJobPayload;

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue('message-processing')
    private readonly messageQueue: Queue<JobPayload>,
  ) {}

  async addMessageJob(payload: ProcessMessageJobPayload): Promise<void> {
    try {
      const job = await this.messageQueue.add('process-message', payload, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: true,
        removeOnFail: false,
      });
      this.logger.log(`Job ${job.id} queued: ${payload.userPhone} → ${payload.propertyPhone}`);
    } catch (error) {
      this.logger.error('QUEUE_ERROR: Redis enqueue failed', error instanceof Error ? error.stack : String(error));
      throw new ServiceUnavailableException('QUEUE_ERROR: Redis enqueue failed');
    }
  }

  async addHostForwardJob(payload: HostForwardJobPayload): Promise<void> {
    try {
      const job = await this.messageQueue.add('host-forward', payload, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: true,
        removeOnFail: false,
      });
      this.logger.log(`Host-forward job ${job.id}: ${payload.hostPhone} → ${payload.propertyPhone}`);
    } catch (error) {
      this.logger.error('QUEUE_ERROR: Redis enqueue failed', error instanceof Error ? error.stack : String(error));
      throw new ServiceUnavailableException('QUEUE_ERROR: Redis enqueue failed');
    }
  }
}
