import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { FeatureFlagsService } from '../common/feature-flags.service';

export type ProcessMessageJobPayload = {
  userPhone: string;
  message: string;
};

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue('message-processing')
    private readonly messageQueue: Queue<ProcessMessageJobPayload>,
    private readonly featureFlags: FeatureFlagsService,
  ) {}

  async addMessageJob(payload: ProcessMessageJobPayload): Promise<void> {
    if (!this.featureFlags.isQueueEnabled()) {
      throw new ServiceUnavailableException(
        'QUEUE_ERROR: Queue processing is disabled by FEATURE_QUEUE_ENABLED',
      );
    }

    try {
      const job = await this.messageQueue.add('process-message', payload, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      });

      this.logger.log(
        `Job added: ${job.id} (${job.name}) for user ${payload.userPhone}`,
      );
    } catch (error) {
      this.logger.error(
        'QUEUE_ERROR: Redis enqueue failed',
        error instanceof Error ? error.stack : String(error),
      );
      throw new ServiceUnavailableException('QUEUE_ERROR: Redis enqueue failed');
    }
  }
}
