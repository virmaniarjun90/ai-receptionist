import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG, AppConfig } from '../../config/app.config';
import { PrismaService } from './prisma.service';

export type DependencyHealth = {
  status: 'ok' | 'error' | 'warning';
  detail?: string;
};

export type HealthStatus = {
  status: 'ok' | 'degraded';
  dependencies: {
    db: DependencyHealth;
    redis: DependencyHealth;
    llm: DependencyHealth;
    twilio: DependencyHealth;
  };
};

@Injectable()
export class CommonService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async getHealthStatus(): Promise<HealthStatus> {
    const [db, redis] = await Promise.all([this.checkDb(), this.checkRedis()]);

    const dependencies = {
      db,
      redis,
      llm: this.checkLlmConfig(),
      twilio: this.checkTwilioConfig(),
    };

    const status = Object.values(dependencies).every((d) => d.status === 'ok') ? 'ok' : 'degraded';
    return { status, dependencies };
  }

  private async checkDb(): Promise<DependencyHealth> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok' };
    } catch {
      return { status: 'error', detail: 'DB_ERROR: PostgreSQL connection failed' };
    }
  }

  private async checkRedis(): Promise<DependencyHealth> {
    // Re-use the BullMQ connection by pinging through Prisma's redis client is not
    // available here; we do a lightweight check via ioredis but share config values
    // from AppConfig so there is a single source of truth.
    const { default: Redis } = await import('ioredis');
    const redis = new Redis({
      host: this.config.redis.host,
      port: this.config.redis.port,
      connectTimeout: 1000,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
    try {
      await redis.connect();
      await redis.ping();
      return { status: 'ok' };
    } catch {
      return { status: 'error', detail: 'QUEUE_ERROR: Redis connection failed' };
    } finally {
      redis.disconnect();
    }
  }

  /** Reports LLM health for whichever provider is actually configured. */
  private checkLlmConfig(): DependencyHealth {
    const { provider, openaiApiKey, anthropicApiKey, kimiApiKey } = this.config.llm;

    if (provider === 'mock') {
      return { status: 'ok', detail: 'LLM provider: mock (no credentials required)' };
    }
    if (provider === 'openai' && !openaiApiKey) {
      return { status: 'error', detail: 'AI_SERVICE_ERROR: OPENAI_API_KEY is not set' };
    }
    if (provider === 'claude' && !anthropicApiKey) {
      return { status: 'error', detail: 'AI_SERVICE_ERROR: ANTHROPIC_API_KEY is not set' };
    }
    if (provider === 'kimi' && !kimiApiKey) {
      return { status: 'error', detail: 'AI_SERVICE_ERROR: KIMI_API_KEY is not set' };
    }

    return { status: 'ok', detail: `LLM provider: ${provider}` };
  }

  private checkTwilioConfig(): DependencyHealth {
    const { accountSid, authToken, whatsappNumber } = this.config.twilio;
    const missing = [
      !accountSid && 'TWILIO_ACCOUNT_SID',
      !authToken && 'TWILIO_AUTH_TOKEN',
      !whatsappNumber && 'TWILIO_WHATSAPP_NUMBER',
    ].filter(Boolean);

    if (missing.length > 0) {
      return { status: 'error', detail: `MESSAGING_SERVICE_ERROR: Missing ${missing.join(', ')}` };
    }
    if (!whatsappNumber?.startsWith('whatsapp:')) {
      return { status: 'warning', detail: 'MESSAGING_SERVICE_WARNING: TWILIO_WHATSAPP_NUMBER should start with "whatsapp:"' };
    }
    return { status: 'ok', detail: 'Twilio configuration present' };
  }
}
