import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AiService } from '../ai/ai.service';
import { CommunicationService } from '../communication/communication.service';
import { FeatureFlagsService } from '../common/feature-flags.service';
import { ConversationService } from '../conversation/conversation.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { PropertyService } from '../property/property.service';
import { ProcessMessageJobPayload } from './queue.service';

@Injectable()
@Processor('message-processing')
export class QueueProcessor extends WorkerHost {
  private readonly logger = new Logger(QueueProcessor.name);

  constructor(
    private readonly aiService: AiService,
    private readonly featureFlags: FeatureFlagsService,
    private readonly communicationService: CommunicationService,
    private readonly conversationService: ConversationService,
    private readonly knowledgeService: KnowledgeService,
    private readonly propertyService: PropertyService,
  ) {
    super();
    console.log('[QueueProcessor] initialized');
  }

  async process(job: Job<ProcessMessageJobPayload>): Promise<void> {
    if (job.name !== 'process-message') {
      this.logger.warn(`Ignoring unsupported job: ${job.name}`);
      return;
    }

    try {
      const { userPhone, message } = job.data;
      if (!this.featureFlags.isQueueEnabled()) {
        this.logger.warn(
          `Skipped process-message job ${job.id}; FEATURE_QUEUE_ENABLED=false`,
        );
        return;
      }

      this.logger.log(
        `Started process-message job ${job.id}; attempt ${job.attemptsMade + 1}/${job.opts.attempts ?? 1}`,
      );
      console.log('Processing job:', job.data);

      const property = await this.propertyService.getDefaultProperty();
      const knowledge = property
        ? await this.knowledgeService.getKnowledgeByProperty(property.id)
        : [];
      const conversation =
        await this.conversationService.getOrCreateConversation(
          userPhone,
          property?.id,
        );

      await this.conversationService.addMessage(
        conversation.id,
        message,
        'user',
      );

      const recentMessages = await this.conversationService.getRecentMessages(
        conversation.id,
        10,
      );
      const reply = await this.aiService.generateReply(
        recentMessages.map((recentMessage) => ({
          role: recentMessage.role,
          content: recentMessage.content,
        })),
        property,
        knowledge,
      );

      await this.conversationService.addMessage(
        conversation.id,
        reply,
        'assistant',
      );

      await this.communicationService.sendWhatsAppMessage({
        to: userPhone,
        body: reply,
      });

      this.logger.log(`Completed process-message job ${job.id}`);
    } catch (error) {
      // Rethrow so BullMQ records the failure and applies the configured retries.
      this.logger.error(
        `Failed process-message job ${job.id}; attempt ${job.attemptsMade + 1}/${job.opts.attempts ?? 1}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  @OnWorkerEvent('active')
  onActive(job: Job<ProcessMessageJobPayload>): void {
    this.logger.log(`Job active: ${job.id}`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<ProcessMessageJobPayload>): void {
    this.logger.log(`Job completed: ${job.id}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<ProcessMessageJobPayload> | undefined, error: Error): void {
    this.logger.error(
      `Job failed: ${job?.id ?? 'unknown'}; ${error.message}`,
      error.stack,
    );
  }

  @OnWorkerEvent('error')
  onError(error: Error): void {
    this.logger.error('QUEUE_ERROR: Worker connection error', error.stack);
  }
}
