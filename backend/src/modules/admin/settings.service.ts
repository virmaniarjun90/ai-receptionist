import { Inject, Injectable } from '@nestjs/common';
import {
  APP_CONFIG,
  AppConfig,
  AppModeName,
  ChannelManagerProviderName,
  LlmProviderName,
} from '../../config/app.config';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async getAll(): Promise<Record<string, string>> {
    const rows = await this.prisma.setting.findMany();
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  async setMany(updates: Record<string, string>): Promise<void> {
    await Promise.all(
      Object.entries(updates).map(async ([key, value]) => {
        if (value === '') {
          await this.prisma.setting.deleteMany({ where: { key } });
        } else {
          await this.prisma.setting.upsert({
            where: { key },
            create: { key, value },
            update: { value },
          });
        }
      }),
    );
  }

  applyToConfig(settings: Record<string, string>): void {
    const c = this.config;
    for (const [key, value] of Object.entries(settings)) {
      switch (key) {
        case 'APP_MODE': c.appMode = value as AppModeName; break;
        case 'APP_URL': c.appUrl = value; break;
        case 'PII_MASKING_ENABLED': c.piiMaskingEnabled = value !== 'false'; break;
        case 'LLM_PROVIDER': c.llm.provider = value as LlmProviderName; break;
        case 'ANTHROPIC_API_KEY': c.llm.anthropicApiKey = value || undefined; break;
        case 'OPENAI_API_KEY': c.llm.openaiApiKey = value || undefined; break;
        case 'KIMI_API_KEY': c.llm.kimiApiKey = value || undefined; break;
        case 'CLAUDE_MODEL': c.llm.claudeModel = value || c.llm.claudeModel; break;
        case 'OPENAI_MODEL': c.llm.openaiModel = value || c.llm.openaiModel; break;
        case 'KIMI_MODEL': c.llm.kimiModel = value || c.llm.kimiModel; break;
        case 'TWILIO_ACCOUNT_SID': c.twilio.accountSid = value || undefined; break;
        case 'TWILIO_AUTH_TOKEN': c.twilio.authToken = value || undefined; break;
        case 'TWILIO_WHATSAPP_NUMBER': c.twilio.whatsappNumber = value || undefined; break;
        case 'CHANNEL_MANAGER_PROVIDER': c.channelManager.provider = value as ChannelManagerProviderName; break;
        case 'CM1_API_KEY': c.channelManager.cm1ApiKey = value || undefined; break;
        case 'CM1_CHANNEL_ID': c.channelManager.cm1ChannelId = value || undefined; break;
        case 'ADMIN_API_KEY': c.admin.apiKey = value || undefined; break;
      }
    }
  }

  async loadAndApply(): Promise<void> {
    const settings = await this.getAll();
    this.applyToConfig(settings);
  }
}
