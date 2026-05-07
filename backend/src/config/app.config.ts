/**
 * Single source of truth for all environment configuration.
 * Read once at module init; each consuming service injects AppConfig.
 * Adding a new provider or channel = add one field here.
 */
export interface AppConfig {
  port: number;
  redis: {
    host: string;
    port: number;
  };
  llm: {
    provider: LlmProviderName;
    openaiApiKey?: string;
    anthropicApiKey?: string;
    kimiApiKey?: string;
    kimiModel: string;
    openaiModel: string;
    claudeModel: string;
  };
  twilio: {
    accountSid?: string;
    authToken?: string;
    whatsappNumber?: string;
    validateWebhook: boolean;
  };
  channelManager: {
    provider: ChannelManagerProviderName;
    airbnbClientId?: string;
    airbnbClientSecret?: string;
    airbnbAccessToken?: string;
  };
  admin: {
    apiKey?: string;
  };
  piiMaskingEnabled: boolean;
  appUrl: string;
}

export type LlmProviderName = 'openai' | 'claude' | 'kimi' | 'mock';
export type ChannelManagerProviderName = 'mock' | 'airbnb';

export const APP_CONFIG = Symbol('APP_CONFIG');

export function buildAppConfig(): AppConfig {
  return {
    port: Number(process.env.PORT ?? 3000),
    redis: {
      host: process.env.REDIS_HOST ?? 'localhost',
      port: Number(process.env.REDIS_PORT ?? 6379),
    },
    llm: {
      provider: (process.env.LLM_PROVIDER ?? 'mock') as LlmProviderName,
      openaiApiKey: process.env.OPENAI_API_KEY,
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      kimiApiKey: process.env.KIMI_API_KEY,
      openaiModel: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
      claudeModel: process.env.CLAUDE_MODEL ?? 'claude-sonnet-4-6',
      kimiModel: process.env.KIMI_MODEL ?? 'moonshot-v1-8k',
    },
    twilio: {
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN,
      whatsappNumber: process.env.TWILIO_WHATSAPP_NUMBER,
      // Disable only in dev/test by setting TWILIO_VALIDATE_WEBHOOK=false.
      validateWebhook: process.env.TWILIO_VALIDATE_WEBHOOK !== 'false',
    },
    channelManager: {
      provider: (process.env.CHANNEL_MANAGER_PROVIDER ?? 'mock') as ChannelManagerProviderName,
      airbnbClientId: process.env.AIRBNB_CLIENT_ID,
      airbnbClientSecret: process.env.AIRBNB_CLIENT_SECRET,
      airbnbAccessToken: process.env.AIRBNB_ACCESS_TOKEN,
    },
    admin: {
      apiKey: process.env.ADMIN_API_KEY,
    },
    piiMaskingEnabled: process.env.PII_MASKING_ENABLED !== 'false',
    appUrl: process.env.APP_URL ?? 'http://localhost:3000',
  };
}

/** Validates required env vars at startup; throws with a clear message if missing. */
export function validateConfig(config: AppConfig): void {
  const errors: string[] = [];

  if (config.llm.provider === 'openai' && !config.llm.openaiApiKey) {
    errors.push('OPENAI_API_KEY is required when LLM_PROVIDER=openai');
  }
  if (config.llm.provider === 'claude' && !config.llm.anthropicApiKey) {
    errors.push('ANTHROPIC_API_KEY is required when LLM_PROVIDER=claude');
  }
  if (config.llm.provider === 'kimi' && !config.llm.kimiApiKey) {
    errors.push('KIMI_API_KEY is required when LLM_PROVIDER=kimi');
  }
  if (config.channelManager.provider === 'airbnb') {
    const hasToken = !!config.channelManager.airbnbAccessToken;
    const hasClientCreds = !!(config.channelManager.airbnbClientId && config.channelManager.airbnbClientSecret);
    if (!hasToken && !hasClientCreds) {
      errors.push(
        'CHANNEL_MANAGER_PROVIDER=airbnb requires either AIRBNB_ACCESS_TOKEN ' +
        'or both AIRBNB_CLIENT_ID + AIRBNB_CLIENT_SECRET',
      );
    }
  }

  if (errors.length > 0) {
    throw new Error(`Configuration errors:\n  ${errors.join('\n  ')}`);
  }
}
