import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Conversation, Property, PropertyHost } from '@prisma/client';
import { Job } from 'bullmq';
import { AiService } from '../ai/ai.service';
import { CommunicationService } from '../communication/communication.service';
import { ConversationService } from '../conversation/conversation.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { PropertyService, getPropertyFeatures } from '../property/property.service';
import { ReservationService } from '../reservation/reservation.service';
import { HostForwardJobPayload, HostTimeoutJobPayload, ProcessMessageJobPayload, QueueService } from './queue.service';

const HANDOFF_PREFIX = '[HANDOFF]';
const AI_COST_PER_CALL_USD = 0.004; // approximate per Claude Sonnet call

// Commands host can send via WhatsApp (case-insensitive)
const CMD_JOIN = new Set(['join', 'yes', 'takeover', 'take over']);
const CMD_DONE = new Set(['done', '/done', '/ai', 'bye', 'back', 'handback']);
const CMD_SKIP = new Set(['skip', 'no', 'pass']);

type JobPayload = ProcessMessageJobPayload | HostForwardJobPayload | HostTimeoutJobPayload;

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
    private readonly queueService: QueueService,
  ) {
    super();
  }

  async process(job: Job<JobPayload>): Promise<void> {
    this.logger.log(`Processing job ${job.id} (${job.name}, attempt ${job.attemptsMade + 1})`);
    try {
      if (job.name === 'host-forward') {
        await this.processHostMessage(job as Job<HostForwardJobPayload>);
      } else if (job.name === 'host-timeout') {
        await this.processHostTimeout(job as Job<HostTimeoutJobPayload>);
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
    const hosts = property
      ? await this.propertyService.getHostsForProperty(property.id)
      : [];

    const cleanUserPhone = userPhone.replace(/^whatsapp:/, '');
    const isHost = hosts.some((h) => h.phone.replace(/^whatsapp:/, '') === cleanUserPhone);

    if (isHost && property) {
      const activeConv = await this.conversationService.getActiveHostConversation(property.id);
      await this.processHostCommand(message, property, propertyPhone, activeConv, userPhone, hosts);
      return;
    }

    await this.processGuestMessage(userPhone, propertyPhone, message, property, hosts);
  }

  // ─── Host command handler (via WhatsApp) ─────────────────────────────────

  private async processHostCommand(
    message: string,
    property: Property,
    propertyPhone: string,
    conversation: Conversation | null,
    senderPhone: string,
    hosts: PropertyHost[],
  ): Promise<void> {
    const cmd = message.trim().toLowerCase();

    if (!conversation) {
      await this.send(senderPhone, propertyPhone,
        `No active guest conversation right now. The guest may have already been helped by the AI, or the request timed out. Check the admin dashboard to review recent conversations.`);
      return;
    }

    if (CMD_JOIN.has(cmd)) {
      // Another host already claimed this conversation
      if (conversation.activeHostPhone) {
        const activeHost = hosts.find((h) => h.phone === conversation.activeHostPhone);
        await this.send(senderPhone, propertyPhone,
          `${activeHost?.name ?? 'Another host'} has already joined this conversation. No action needed from you.`);
        return;
      }

      await this.conversationService.setStatus(conversation.id, 'host');
      const joiningHost = hosts.find((h) => h.phone === senderPhone);
      await this.conversationService.setActiveHost(conversation.id, senderPhone, joiningHost?.name);

      // Send recent message backlog to the joining host
      const recentMessages = await this.conversationService.getRecentMessages(conversation.id, 5);
      const guestMessages = recentMessages.filter((m) => m.role === 'user');
      if (guestMessages.length > 1) {
        const backlog = guestMessages
          .slice(0, -1) // All except the most recent
          .map((m) => `• "${m.content}"`)
          .join('\n');
        await this.send(senderPhone, propertyPhone,
          `📋 **Guest's previous messages:**\n${backlog}\n\n(Latest message below)`);
      }

      await this.send(senderPhone, propertyPhone,
        `You're now connected with the guest. ` +
        `Reply here and your messages will be forwarded to them. ` +
        `Send DONE when finished and the AI will take back over.`);

      // Notify all other hosts with the name of who joined
      for (const host of hosts.filter((h) => h.phone !== senderPhone)) {
        await this.send(host.phone, propertyPhone,
          `${joiningHost?.name ?? 'Another host'} has joined this conversation. No action needed from you.`);
      }

      // Guest receives no host name — seamless experience
      await this.send(conversation.userPhone, propertyPhone,
        `You're now connected with the host. They'll reply to you shortly.`);
      return;
    }

    if (CMD_SKIP.has(cmd)) {
      // Block SKIP if a different host is already handling the conversation
      if (conversation.activeHostPhone && conversation.activeHostPhone !== senderPhone) {
        await this.send(senderPhone, propertyPhone,
          `Another host is currently handling this conversation.`);
        return;
      }
      await this.conversationService.setStatus(conversation.id, 'ai');
      await this.conversationService.setActiveHost(conversation.id, null);
      await this.send(senderPhone, propertyPhone,
        `Got it — the AI assistant will continue handling this conversation.`);
      await this.send(conversation.userPhone, propertyPhone,
        `I wasn't able to reach the host right now, but I'll do my best to help. What else can I assist with?`);
      return;
    }

    if (CMD_DONE.has(cmd)) {
      // Only the active host can hand back to AI
      if (conversation.activeHostPhone && conversation.activeHostPhone !== senderPhone) {
        await this.send(senderPhone, propertyPhone,
          `You're not currently handling this conversation.`);
        return;
      }
      await this.conversationService.setStatus(conversation.id, 'ai');
      await this.conversationService.setActiveHost(conversation.id, null);
      await this.send(senderPhone, propertyPhone,
        `Conversation handed back to the AI assistant. Thanks for helping!`);
      await this.send(conversation.userPhone, propertyPhone,
        `The host has stepped away. You're back with the AI assistant — how can I help?`);
      return;
    }

    // Any other text while host is active → forward to guest (active host only)
    if (conversation.status === 'host' || conversation.status === 'pending') {
      if (conversation.activeHostPhone && conversation.activeHostPhone !== senderPhone) {
        await this.send(senderPhone, propertyPhone,
          `Another host is currently handling this conversation.`);
        return;
      }
      await this.conversationService.addMessage(conversation.id, message, 'assistant');
      await this.conversationService.setStatus(conversation.id, 'host');
      await this.send(conversation.userPhone, propertyPhone, message);
      return;
    }

    // Unrecognised command while waiting for a host to join
    if (conversation.status === 'awaiting_host') {
      await this.send(senderPhone, propertyPhone,
        `Reply JOIN to assist the guest, SKIP to let the AI handle it, or DONE when you're finished.`);
    }
  }

  // ─── Host availability timeout ────────────────────────────────────────────

  private async processHostTimeout(job: Job<HostTimeoutJobPayload>): Promise<void> {
    const { conversationId, propertyPhone, userPhone } = job.data;

    const status = await this.conversationService.getStatus(conversationId);
    if (status !== 'awaiting_host') return; // host already responded or conversation ended

    await this.conversationService.setStatus(conversationId, 'ai');
    await this.send(userPhone, propertyPhone,
      `The host isn't available right now. I'll do my best to help — what else can I assist you with?`);
  }

  // ─── Guest message handler ────────────────────────────────────────────────

  private async processGuestMessage(
    userPhone: string,
    propertyPhone: string,
    message: string,
    property: Property | null,
    hosts: PropertyHost[],
  ): Promise<void> {
    const propertyId = property?.id ?? null;
    const features = property ? getPropertyFeatures(property) : null;

    const [knowledge, conversation] = await Promise.all([
      propertyId ? this.knowledgeService.getKnowledgeByProperty(propertyId) : Promise.resolve([]),
      this.conversationService.getOrCreateConversation(userPhone, propertyId ?? undefined),
    ]);

    await this.conversationService.addMessage(conversation.id, message, 'user');

    // Host has taken over — forward to the active host, skip AI
    if (conversation.status === 'host' || conversation.status === 'pending') {
      await this.conversationService.setStatus(conversation.id, 'pending');
      const notifyPhone = conversation.activeHostPhone;
      if (notifyPhone) {
        await this.send(notifyPhone, propertyPhone,
          `[${property?.name ?? 'Property'}] Guest sent: "${message}"\n\nReply to respond, or send DONE to hand back to AI.`);
      }
      return;
    }

    // Handoff already triggered — nudge all hosts again with the new message
    if (conversation.status === 'awaiting_host') {
      for (const host of hosts) {
        await this.send(host.phone, propertyPhone,
          `[${property?.name ?? 'Property'}] Guest sent another message: "${message}"`);
      }
      return;
    }

    const reservation = propertyId
      ? await this.reservationService.getActiveReservationByPhone(userPhone, propertyId)
      : null;

    // AI processing lock — prevent concurrent AI calls for same conversation
    const freshConversation = await this.conversationService.getOrCreateConversation(userPhone, propertyId ?? undefined);
    if (freshConversation.processingAiMessage) {
      this.logger.log(`AI processing already in progress for ${userPhone}, skipping this message`);
      return;
    }

    await this.conversationService.setProcessing(conversation.id, true);

    try {
      // Budget quota check — count AI replies as a cost proxy
      if (features?.budgetQuota) {
        const aiCallCount = await this.conversationService.countAiMessages(conversation.id);
        const estimatedCost = aiCallCount * AI_COST_PER_CALL_USD;

        if (estimatedCost >= features.budgetLimitUsd) {
          const hasRelay = features.hostRelay && hosts.length > 0;
          const budgetMsg = hasRelay
            ? `I've reached my limit for this conversation. Let me connect you with the host.`
            : `I've reached my limit for this conversation. Please reach out to the host directly for further help.`;

          await this.conversationService.addMessage(conversation.id, budgetMsg, 'assistant');
          await this.send(userPhone, propertyPhone, budgetMsg);

          if (hasRelay && property) {
            await this.triggerHostRelay(
              conversation.id, property, propertyPhone, userPhone,
              reservation?.guestName ?? userPhone, message,
              features.hostAvailabilityTimeoutMin, hosts,
              `AI budget reached for ${reservation?.guestName ?? 'guest'}. They may need direct assistance.`,
            );
          }
          return;
        }
      }

      // AI handles the message
      const recentMessages = await this.conversationService.getRecentMessages(conversation.id, 10);

      const rawReply = await this.aiService.generateReply(
        recentMessages.map((m) => ({ role: m.role, content: m.content })),
        property,
        knowledge,
        reservation,
      );

      // AI-triggered handoff
      if (rawReply.startsWith(HANDOFF_PREFIX)) {
        const visibleMsg = rawReply.slice(HANDOFF_PREFIX.length).trim();
        await this.conversationService.addMessage(conversation.id, visibleMsg, 'assistant');
        await this.send(userPhone, propertyPhone, visibleMsg);

        const hasRelay = features?.hostRelay && hosts.length > 0;
        if (hasRelay && property) {
          await this.triggerHostRelay(
            conversation.id, property, propertyPhone, userPhone,
            reservation?.guestName ?? userPhone, message,
            features!.hostAvailabilityTimeoutMin, hosts,
            `${reservation?.guestName ?? 'A guest'} asked something the AI can't answer:\n"${message}"\n\nReply JOIN to assist directly, or SKIP to let the AI try again.`,
          );
        }
        return;
      }

      await this.conversationService.addMessage(conversation.id, rawReply, 'assistant');
      await this.send(userPhone, propertyPhone, rawReply);
    } finally {
      await this.conversationService.setProcessing(conversation.id, false);
    }
  }

  // ─── Shared relay trigger — notifies ALL hosts ────────────────────────────

  private async triggerHostRelay(
    conversationId: string,
    property: Property,
    propertyPhone: string,
    userPhone: string,
    guestLabel: string,
    _guestMessage: string,
    timeoutMinutes: number,
    hosts: PropertyHost[],
    hostNotification: string,
  ): Promise<void> {
    await this.conversationService.setStatus(conversationId, 'awaiting_host');

    // Send personalised notification to every host — first to reply JOIN wins
    for (const host of hosts) {
      await this.send(host.phone, propertyPhone,
        `Hi ${host.name}! [${property.name ?? 'Property'} - Guest: ${guestLabel}] ${hostNotification}`);
    }

    await this.queueService.addHostTimeoutJob(
      { conversationId, propertyPhone, userPhone },
      timeoutMinutes * 60 * 1000,
    );
    this.logger.log(
      `Host relay triggered for conversation ${conversationId} (guest: ${guestLabel}), ` +
      `hosts: ${hosts.length}, timeout: ${timeoutMinutes}min`,
    );
  }

  // ─── Admin-initiated host forward ─────────────────────────────────────────

  private async processHostMessage(job: Job<HostForwardJobPayload>): Promise<void> {
    const { hostPhone, propertyPhone, message } = job.data;
    const property = await this.propertyService.getPropertyByPhone(propertyPhone);
    if (!property) return;
    const hosts = await this.propertyService.getHostsForProperty(property.id);
    const conversation = await this.conversationService.getActiveHostConversation(property.id);
    await this.processHostCommand(message, property, propertyPhone, conversation, hostPhone, hosts);
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
