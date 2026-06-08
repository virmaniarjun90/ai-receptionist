import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_CONFIG, AppConfig, ChannelManagerProviderName } from '../../config/app.config';
import { CHANNEL_MANAGER_PROVIDER, ChannelManagerProvider } from './channel-manager.interface';
import { AirbnbProvider } from './providers/airbnb.provider';
import { Cm1Provider } from './providers/cm1.provider';
import { MockChannelManagerProvider } from './providers/mock.provider';
import { SyncScheduler } from './sync.scheduler';
import { SyncService } from './sync.service';

const PROVIDERS: Record<ChannelManagerProviderName, unknown> = {
  mock: MockChannelManagerProvider,
  airbnb: AirbnbProvider,
  cm1: Cm1Provider,
};

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [
    MockChannelManagerProvider,
    AirbnbProvider,
    Cm1Provider,
    {
      provide: CHANNEL_MANAGER_PROVIDER,
      useFactory: (
        config: AppConfig,
        mock: MockChannelManagerProvider,
        airbnb: AirbnbProvider,
        cm1: Cm1Provider,
      ): ChannelManagerProvider => {
        if (config.channelManager.provider === 'airbnb') return airbnb;
        if (config.channelManager.provider === 'cm1') return cm1;
        return mock;
      },
      inject: [APP_CONFIG, MockChannelManagerProvider, AirbnbProvider, Cm1Provider],
    },
    SyncService,
    SyncScheduler,
  ],
  exports: [CHANNEL_MANAGER_PROVIDER, SyncService, SyncScheduler],
})
export class ChannelManagerModule {
  // Adding a new channel manager: create providers/<name>.provider.ts,
  // implement ChannelManagerProvider, register above, add to ChannelManagerProviderName.
  static readonly supportedProviders = Object.keys(PROVIDERS) as ChannelManagerProviderName[];
}
