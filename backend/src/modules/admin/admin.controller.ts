import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Knowledge, Message, Property, PropertyHost, Reservation } from '@prisma/client';
import { APP_CONFIG, AppConfig } from '../../config/app.config';
import { SyncService, SyncResult } from '../channel-manager/sync.service';
import { SyncScheduler } from '../channel-manager/sync.scheduler';
import { CommunicationService } from '../communication/communication.service';
import { ConversationService } from '../conversation/conversation.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { PropertyService, CreatePropertyInput, CreatePropertyHostInput, UpdatePropertyInput } from '../property/property.service';
import { ReservationService, CreateReservationInput, UpdateReservationInput } from '../reservation/reservation.service';
import { AdminGuard } from './admin.guard';
import { SettingsService } from './settings.service';

function maskSecret(value: string): string {
  if (value.length <= 8) return '••••••••';
  return value.slice(0, 4) + '••••••••' + value.slice(-4);
}

function maskDatabaseUrl(url: string): string {
  return url.replace(/(:\/\/[^:]+:)([^@]+)(@)/, '$1••••••••$3');
}

@ApiTags('Admin')
@ApiHeader({ name: 'x-admin-key', description: 'Admin API key (required when ADMIN_API_KEY is set)', required: false })
@UseGuards(AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly propertyService: PropertyService,
    private readonly knowledgeService: KnowledgeService,
    private readonly reservationService: ReservationService,
    private readonly conversationService: ConversationService,
    private readonly communicationService: CommunicationService,
    private readonly syncService: SyncService,
    private readonly syncScheduler: SyncScheduler,
    private readonly settingsService: SettingsService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  // ─── System Config ───────────────────────────────────────────────────────────

  @Get('config')
  @ApiOperation({ summary: 'Current system configuration (secrets masked)' })
  getConfig() {
    const llm = this.config.llm;
    const activeModel =
      llm.provider === 'claude' ? llm.claudeModel
      : llm.provider === 'openai' ? llm.openaiModel
      : llm.provider === 'kimi' ? llm.kimiModel
      : 'n/a';
    const activeKey =
      llm.provider === 'claude' ? llm.anthropicApiKey
      : llm.provider === 'openai' ? llm.openaiApiKey
      : llm.provider === 'kimi' ? llm.kimiApiKey
      : null;

    return {
      appMode: this.config.appMode,
      appUrl: this.config.appUrl,
      piiMasking: this.config.piiMaskingEnabled,
      admin: {
        apiKeySet: !!this.config.admin.apiKey,
      },
      llm: {
        provider: llm.provider,
        model: activeModel,
        apiKey: activeKey ? maskSecret(activeKey) : null,
        apiKeySet: !!activeKey,
        claudeModel: llm.claudeModel,
        openaiModel: llm.openaiModel,
        kimiModel: llm.kimiModel,
      },
      twilio: {
        accountSid: this.config.twilio.accountSid ? maskSecret(this.config.twilio.accountSid) : null,
        authTokenSet: !!this.config.twilio.authToken,
        whatsappNumber: this.config.twilio.whatsappNumber ?? null,
        webhookValidation: this.config.twilio.validateWebhook,
      },
      channelManager: {
        provider: this.config.channelManager.provider,
        configured: !!(
          this.config.channelManager.airbnbAccessToken ||
          this.config.channelManager.airbnbClientId ||
          this.config.channelManager.cm1ApiKey
        ),
        cm1ChannelId: this.config.channelManager.cm1ChannelId ?? null,
        cm1ApiKeySet: !!this.config.channelManager.cm1ApiKey,
      },
      database: {
        url: this.config.database.url ? maskDatabaseUrl(this.config.database.url) : null,
        urlSet: !!this.config.database.url,
      },
      redis: {
        host: this.config.redis.host,
        port: this.config.redis.port,
        passwordSet: !!this.config.redis.password,
        tls: this.config.redis.tls,
      },
    };
  }

  @Patch('config')
  @ApiOperation({ summary: 'Update system configuration (requires confirmation key)' })
  async updateConfig(
    @Body() body: { confirmKey: string; updates: Record<string, string> },
  ) {
    if (!this.config.admin.apiKey) {
      throw new UnauthorizedException(
        'No ADMIN_API_KEY is set — set one in backend/.env before using config edit',
      );
    }
    if (body.confirmKey !== this.config.admin.apiKey) {
      throw new UnauthorizedException('Invalid confirmation key');
    }
    const filtered: Record<string, string> = {};
    for (const [k, v] of Object.entries(body.updates)) {
      if (v !== undefined && v !== null) filtered[k] = v;
    }
    await this.settingsService.setMany(filtered);
    this.settingsService.applyToConfig(filtered);
    return { saved: true };
  }

  // ─── Properties ─────────────────────────────────────────────────────────────

  @Get('properties')
  @ApiOperation({ summary: 'List all properties' })
  listProperties(): Promise<Property[]> {
    return this.propertyService.listProperties();
  }

  @Get('properties/:id')
  @ApiOperation({ summary: 'Get a property by ID' })
  getProperty(@Param('id') id: string): Promise<Property> {
    return this.propertyService.getById(id);
  }

  @Post('properties')
  @ApiOperation({ summary: 'Create a new property' })
  createProperty(@Body() input: CreatePropertyInput): Promise<Property> {
    return this.propertyService.createProperty(input);
  }

  @Patch('properties/:id')
  @ApiOperation({ summary: 'Update a property' })
  updateProperty(
    @Param('id') id: string,
    @Body() input: UpdatePropertyInput,
  ): Promise<Property> {
    return this.propertyService.updateProperty(id, input);
  }

  @Delete('properties/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a property' })
  deleteProperty(@Param('id') id: string): Promise<void> {
    return this.propertyService.deleteProperty(id);
  }

  // ─── Knowledge ──────────────────────────────────────────────────────────────

  @Get('properties/:id/knowledge')
  @ApiOperation({ summary: 'List all knowledge entries for a property' })
  listKnowledge(@Param('id') id: string): Promise<Knowledge[]> {
    return this.knowledgeService.getKnowledgeByProperty(id);
  }

  @Post('properties/:id/knowledge')
  @ApiOperation({ summary: 'Upsert a knowledge entry (key-value fact for the AI)' })
  upsertKnowledge(
    @Param('id') propertyId: string,
    @Body() body: { key: string; value: string },
  ): Promise<Knowledge> {
    return this.knowledgeService.upsert(propertyId, body.key, body.value);
  }

  @Delete('properties/:id/knowledge/:key')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a knowledge entry' })
  deleteKnowledge(@Param('id') propertyId: string, @Param('key') key: string): Promise<void> {
    return this.knowledgeService.delete(propertyId, key);
  }

  // ─── Hosts ──────────────────────────────────────────────────────────────────

  @Get('properties/:id/hosts')
  @ApiOperation({ summary: 'List all hosts for a property' })
  listHosts(@Param('id') propertyId: string): Promise<PropertyHost[]> {
    return this.propertyService.listHosts(propertyId);
  }

  @Post('properties/:id/hosts')
  @ApiOperation({ summary: 'Add a host to a property' })
  addHost(
    @Param('id') propertyId: string,
    @Body() input: CreatePropertyHostInput,
  ): Promise<PropertyHost> {
    return this.propertyService.addHost(propertyId, input);
  }

  @Delete('properties/:id/hosts/:hostId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove a host from a property' })
  removeHost(
    @Param('id') propertyId: string,
    @Param('hostId') hostId: string,
  ): Promise<void> {
    return this.propertyService.removeHost(propertyId, hostId);
  }

  // ─── Reservations ───────────────────────────────────────────────────────────

  @Get('properties/:id/reservations')
  @ApiOperation({ summary: 'List all reservations for a property' })
  listReservations(@Param('id') propertyId: string): Promise<Reservation[]> {
    return this.reservationService.listByProperty(propertyId);
  }

  @Post('properties/:id/reservations')
  @ApiOperation({ summary: 'Create a reservation manually' })
  createReservation(
    @Param('id') propertyId: string,
    @Body() input: Omit<CreateReservationInput, 'propertyId'>,
  ): Promise<Reservation> {
    return this.reservationService.create({ ...input, propertyId });
  }

  @Patch('reservations/:id')
  @ApiOperation({ summary: 'Update a reservation' })
  updateReservation(
    @Param('id') id: string,
    @Body() input: UpdateReservationInput,
  ): Promise<Reservation> {
    return this.reservationService.update(id, input);
  }

  @Post('reservations/:id/cancel')
  @ApiOperation({ summary: 'Cancel a reservation' })
  cancelReservation(@Param('id') id: string): Promise<Reservation> {
    return this.reservationService.cancel(id);
  }

  // ─── Channel Manager Sync ───────────────────────────────────────────────────

  @Post('properties/:id/sync')
  @ApiOperation({
    summary: 'Trigger a channel manager sync for one property',
    description: 'Pulls listing details and reservations from the configured channel manager (mock or Airbnb) and updates the property and its reservations.',
  })
  syncProperty(@Param('id') propertyId: string): Promise<SyncResult> {
    return this.syncService.syncProperty(propertyId);
  }

  @Post('sync')
  @ApiOperation({
    summary: 'Trigger a full sync for all properties with an externalId',
    description: 'Runs the same job as the hourly cron. Safe to call manually at any time.',
  })
  syncAll(): Promise<void> {
    return this.syncScheduler.syncAllProperties();
  }

  // ─── Conversations (read-only) ───────────────────────────────────────────────

  @Get('conversations')
  @ApiOperation({ summary: 'List all conversations with last message' })
  listConversations() {
    return this.conversationService.listConversations();
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Get a conversation with full message history' })
  getConversation(@Param('id') id: string) {
    return this.conversationService.getConversationById(id);
  }

  @Get('conversations/by-phone/:phoneNumber')
  @ApiOperation({ summary: 'Get all messages for a phone number (across all conversations)' })
  listMessagesByPhone(@Param('phoneNumber') phoneNumber: string): Promise<Message[]> {
    return this.conversationService.listMessagesForParticipant(phoneNumber);
  }

  @Post('conversations/:id/takeover')
  @ApiOperation({
    summary: 'Host takes over a conversation — AI stops, host is notified on WhatsApp',
  })
  async takeoverConversation(@Param('id') id: string) {
    const conversation = await this.conversationService.getConversationById(id);
    const property = conversation.property;

    await this.conversationService.setStatus(id, 'awaiting_host');
    await this.conversationService.setActiveHost(id, null);

    if (property) {
      const hosts = await this.propertyService.getHostsForProperty(property.id);
      const lastMsg = conversation.messages.at(-1);
      const context = lastMsg ? `\nLast guest message: "${lastMsg.content}"` : '';

      for (const host of hosts) {
        await this.communicationService.sendWhatsAppMessage({
          to: host.phone,
          body:
            `Hi ${host.name}! [${property.name ?? 'Property'}] Admin requested host takeover for ${conversation.userPhone}.${context}\n\n` +
            `Reply JOIN to assist the guest directly, or SKIP to let the AI handle it.\nSend DONE when finished.`,
          from: property.phoneNumber ?? undefined,
        });
      }
    }

    await this.communicationService.sendWhatsAppMessage({
      to: conversation.userPhone,
      body: "I'm connecting you with the host — they'll be with you shortly.",
      from: property?.phoneNumber ?? undefined,
    });

    return { status: 'awaiting_host', conversationId: id };
  }

  @Post('conversations/:id/handback')
  @ApiOperation({ summary: 'Hand conversation back to AI assistant' })
  async handbackConversation(@Param('id') id: string) {
    await this.conversationService.setStatus(id, 'ai');
    await this.conversationService.setActiveHost(id, null);

    const conversation = await this.conversationService.getConversationById(id);
    await this.communicationService.sendWhatsAppMessage({
      to: conversation.userPhone,
      body: "You're back with the AI assistant. How can I help?",
      from: conversation.property?.phoneNumber ?? undefined,
    });

    return { status: 'ai', conversationId: id };
  }

  // ─── Guest data deletion (GDPR / right to erasure) ─────────────────────────

  @Delete('guests/:phone')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Erase all personal data for a guest phone number',
    description:
      'Anonymises conversations, messages, and reservations linked to this phone. ' +
      'Deletes guest tokens. This action is irreversible.',
  })
  async deleteGuestData(@Param('phone') phone: string) {
    const decodedPhone = decodeURIComponent(phone);
    const [convResult, resResult] = await Promise.all([
      this.conversationService.anonymizeGuest(decodedPhone),
      this.reservationService.anonymizeGuest(decodedPhone),
    ]);
    return {
      phone: decodedPhone,
      anonymised: {
        conversations: convResult.conversations,
        messages: convResult.messages,
        reservations: resResult.reservations,
      },
    };
  }
}
