import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';
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
    openai: DependencyHealth;
    twilio: DependencyHealth;
  };
};

@Injectable()
export class CommonService {
  constructor(private readonly prisma: PrismaService) {}

  async getHealthStatus(): Promise<HealthStatus> {
    const dependencies = {
      db: await this.checkDb(),
      redis: await this.checkRedis(),
      openai: this.checkRequiredEnv('OPENAI_API_KEY', 'OpenAI API key configured'),
      twilio: this.checkTwilioConfig(),
    };

    const status = Object.values(dependencies).every(
      (dependency) => dependency.status === 'ok',
    )
      ? 'ok'
      : 'degraded';

    return { status, dependencies };
  }

  private async checkDb(): Promise<DependencyHealth> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok' };
    } catch (error) {
      return {
        status: 'error',
        detail: 'DB_ERROR: PostgreSQL connection failed',
      };
    }
  }

  private async checkRedis(): Promise<DependencyHealth> {
    const redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT || 6379),
      connectTimeout: 1000,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });

    try {
      await redis.connect();
      await redis.ping();
      return { status: 'ok' };
    } catch (error) {
      return {
        status: 'error',
        detail: 'QUEUE_ERROR: Redis connection failed',
      };
    } finally {
      redis.disconnect();
    }
  }

  private checkTwilioConfig(): DependencyHealth {
    const required = [
      'TWILIO_ACCOUNT_SID',
      'TWILIO_AUTH_TOKEN',
      'TWILIO_WHATSAPP_NUMBER',
    ];
    const missing = required.filter((name) => !process.env[name]);

    if (missing.length > 0) {
      return {
        status: 'error',
        detail: `MESSAGING_SERVICE_ERROR: Missing ${missing.join(', ')}`,
      };
    }

    if (!process.env.TWILIO_WHATSAPP_NUMBER?.startsWith('whatsapp:')) {
      return {
        status: 'warning',
        detail:
          'MESSAGING_SERVICE_WARNING: TWILIO_WHATSAPP_NUMBER should include whatsapp:',
      };
    }

    return { status: 'ok', detail: 'Twilio configuration present' };
  }

  private checkRequiredEnv(name: string, okDetail: string): DependencyHealth {
    if (!process.env[name]) {
      return {
        status: 'error',
        detail: `AI_SERVICE_ERROR: Missing ${name}`,
      };
    }

    return { status: 'ok', detail: okDetail };
  }
}
