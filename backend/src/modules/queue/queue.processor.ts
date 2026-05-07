import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Conversation, Property } from '@prisma/client';
import { Job } from 'bullmq';
import { AiService } from '../ai/ai.service';
import { CommunicationService } from '../communication/communication.service';
import { ConversationService } from '../conversation/conversation.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { PropertyService } from '../property/property.service';
import { ReservationService } from '../reservation/reservation.service';
import { HostForwardJobPayload, ProcessMessageJobPayload } from './queue.service';

const HANDOFF_PREFIX = '[HANDOFF]';

// Commands host can send via WhatsApp (case-insensitive)
const CMD_JOIN = new Set(['join', 'yes', 'takeover', 'take over']);
const CMD_DONE = new Set(['done', '/done', '/ai', 'bye', 'back', 'handback']);
const CMD_SKIP = new Set(['skip', 'no', 'pass']);

type JobPayload = ProcessMessageJobPayload | HostForwardJobPayload;

@Injectable()
@Processor('message-processing')
export class QueueProcessor extends WorkerHost {
  private readonly logger = new Logger(QueueProcessor.name);

  constructor(
    private readonly aiService: AiService,
    private readonly communicationService: CommunicationService,
    private readonly conversationService: ConversationService,
    private readonly knowledgeService: KnowledgeService,
    private readonly propertyService: PropertyService,
    private readonly reservationService: ReservationService,
  ) {
    super();
  }

  async process(job: Job<JobPayload>): Promise<void> {
    this.logger.log(`Processing job ${job.id} (${job.name}, attempt ${job.attemptsMade + 1})`);
    try {
      if (job.name === 'host-forward') {
        await this.processHostMessage(job as Job<HostForwardJobPayload>);
      } else if (job.name === 'process-message') {
        await this.processInbound(job as Job<ProcessMessageJobPayload>);
      } else {
        this.logger.warn(`Ignoring unsupported job: ${job.name}`);
      }
      this.logger.log(`Completed job ${job.id}`);
    } catch (error) {
      this.logger.error(
        `Failed job ${job.id} (attempt ${job.attemptsMade + 1})`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  // ─── Inbound from Twilio: route by sender identity ────────────────────────

  private async processInbound(job: Job<ProcessMessageJobPayload>): Promise<void> {
    const { userPhone, propertyPhone, message } = job.data;

    const property = await this.propertyService.getPropertyByPhone(propertyPhone);

    // Is this the host messaging in?
    if (property?.hostPhone && userPhone === property.hostPhone) {
      const activeConv = await this.conversationService.getActiveHostConversation(property.id);
      await this.processHostCommand(message, property, propertyPhone, activeConv);
      return;
    }

    await this.processGuestMessage(userPhone, propertyPhone, message, property);
  }

  // ─── Host command handler (via WhatsApp) ─────────────────────────────────

  private async processHostCommand(
    message: string,
    property: Property,
    propertyPhone: string,
    conversation: Conversation | null,
  ): Promise<void> {
    const cmd = message.trim().toLowerCase();

    if (!conversation) {
      // No active conversation — send a helpful hint
      await this.send(property.hostPhone!, propertyPhone,
        `No active guest conversation to manage. Your guests will appear here when they need help.`);
      return;
    }

    if (CMD_JOIN.has(cmd)) {
      // Host confirms takeover
      await this.conversationService.setStatus(conversation.id, 'host');
      await this.send(property.hostPhone!, propertyPhone,
        `You're now connected with ${conversation.userPhone}. ` +
        `Reply here and your messages will be forwarded to the guest. ` +
        `Send DONE when you're finished and the AI will take back over.`);
      await this.send(conversation.userPhone, propertyPhone,
        `You're now connected with the host. They'll reply to you shortly.`);
      return;
    }

    if (CMD_SKIP.has(cmd)) {
      // Host declines — hand back to AI
      await this.conversationService.setStatus(conversation.id, 'ai');
      await this.send(property.hostPhone!, propertyPhone,
        `Got it — the AI assistant will continue handling this conversation.`);
      await this.send(conversation.userPhone, propertyPhone,
        `I wasn't able to reach the host right now, but I'll do my best to help. What else can I assist with?`);
      return;
    }

    if (CMD_DONE.has(cmd)) {
      // Host hands back to AI
      await this.conversationService.setStatus(conversation.id, 'ai');
      await this.send(property.hostPhone!, propertyPhone,
        `Conversation handed back to the AI assistant. Thanks for helping!`);
      await this.send(conversation.userPhone, propertyPhone,
        `The host has stepped away. You're back with the AI assistant — how can I help?`);
      return;
    }

    // Any other message while active → forward to guest
    if (conversation.status === 'host' || conversation.status === 'pending') {
      await this.conversationService.addMessage(conversation.id, message, 'assistant');
      await this.conversationService.setStatus(conversation.id, 'host');
      await this.send(conversation.userPhone, propertyPhone, message);
      return;
    }

    // Host sent an unrecognised message while in awaiting_host state
    if (conversation.status === 'awaiting_host') {
      await this.send(property.hostPhone!, propertyPhone,
        `Reply JOIN to assist the guest, SKIP to let the AI handle it, or DONE when you're finished.`);
    }
  }

  // ─── Guest message handler ────────────────────────────────────────────────

  private async processGuestMessage(
    userPhone: string,
    propertyPhone: string,
    message: string,
    property: Property | null,
  ): Promise<void> {
    const propertyId = property?.id ?? null;

    const [knowledge, conversation] = await Promise.all([
      propertyId ? this.knowledgeService.getKnowledgeByProperty(propertyId) : Promise.resolve([]),
      this.conversationService.getOrCreateConversation(userPhone, propertyId ?? undefined),
    ]);

    await this.conversationService.addMessage(conversation.id, message, 'user');

    // Host has taken over — notify them of the new guest message, skip AI
    if (conversation.status === 'host' || conversation.status === 'pending' || conversation.status === 'awaiting_host') {
      await this.conversationService.setStatus(conversation.id,
        conversation.status === 'host' ? 'pending' : conversation.status);

      if (property?.hostPhone) {
        await this.send(property.hostPhone, propertyPhone,
          `[${property.name}] Guest sent: "${message}"\n\nReply to respond, or send DONE to hand back to AI.`);
      }
      return;
    }

    // AI handles it
    const reservation = propertyId
      ? await this.reservationService.getActiveReservationByPhone(userPhone, propertyId)
      : null;

    const recentMessages = await this.conversationService.getRecentMessages(conversation.id, 10);

    const rawReply = await this.aiService.generateReply(
      recentMessages.map((m) => ({ role: m.role, content: m.content })),
      property,
      knowledge,
      reservation,
    );

    // Detect AI-triggered handoff
    if (rawReply.startsWith(HANDOFF_PREFIX)) {
      const visibleMsg = rawReply.slice(HANDOFF_PREFIX.length).trim();

      await this.conversationService.addMessage(conversation.id, visibleMsg, 'assistant');
      await this.conversationService.setStatus(conversation.id, 'awaiting_host');
      await this.send(userPhone, propertyPhone, visibleMsg);

      if (property?.hostPhone) {
        const reservation2 = reservation;
        const guestLabel = reservation2?.guestName ?? userPhone;
        await this.send(property.hostPhone, propertyPhone,
          `[${property.name ?? 'Property'}] ${guestLabel} asked something the AI can't answer:\n` +
          `"${message}"\n\n` +
          `Reply JOIN to assist directly, or SKIP to let the AI try again.`);
      }
      return;
    }

    await this.conversationService.addMessage(conversation.id, rawReply, 'assistant');
    await this.send(userPhone, propertyPhone, rawReply);
  }

  // ─── Legacy job type from admin takeover ─────────────────────────────────

  private async processHostMessage(job: Job<HostForwardJobPayload>): Promise<void> {
    const { hostPhone, propertyPhone, message } = job.data;
    const property = await this.propertyService.getPropertyByPhone(propertyPhone);
    if (!property) return;
    const conversation = await this.conversationService.getActiveHostConversation(property.id);
    await this.processHostCommand(message, { ...property, hostPhone }, propertyPhone, conversation);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private async send(to: string, from: string, body: string): Promise<void> {
    await this.communicationService.sendWhatsAppMessage({ to, body, from });
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<JobPayload> | undefined, error: Error): void {
    this.logger.error(`Job failed: ${job?.id ?? 'unknown'} — ${error.message}`, error.stack);
  }

  @OnWorkerEvent('error')
  onError(error: Error): void {
    this.logger.error('QUEUE_ERROR: Worker connection error', error.stack);
  }
}
