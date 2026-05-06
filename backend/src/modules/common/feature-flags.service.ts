import { Injectable } from '@nestjs/common';

@Injectable()
export class FeatureFlagsService {
  isQueueEnabled(): boolean {
    return this.enabled('FEATURE_QUEUE_ENABLED', true);
  }

  isAiEnabled(): boolean {
    return this.enabled('FEATURE_AI_ENABLED', true);
  }

  private enabled(name: string, defaultValue: boolean): boolean {
    const value = process.env[name];

    if (value === undefined || value === '') {
      return defaultValue;
    }

    return value.toLowerCase() === 'true';
  }
}
