import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_CONFIG, AppConfig } from '../../config/app.config';
import { CHANNEL_MANAGER_PROVIDER } from './channel-manager.interface';
import { AirbnbProvider } from './providers/airbnb.provider';
import { MockChannelManagerProvider } from './providers/mock.provider';
import { SyncScheduler } from './sync.scheduler';
import { SyncService } from './sync.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [
    MockChannelManagerProvider,
    AirbnbProvider,
    {
      provide: CHANNEL_MANAGER_PROVIDER,
      useFactory: (
        config: AppConfig,
        mock: MockChannelManagerProvider,
        airbnb: AirbnbProvider,
      ): MockChannelManagerProvider | AirbnbProvider => {
        return config.channelManager.provider === 'airbnb' ? airbnb : mock;
      },
      inject: [APP_CONFIG, MockChannelManagerProvider, AirbnbProvider],
    },
    SyncService,
    SyncScheduler,
  ],
  exports: [CHANNEL_MANAGER_PROVIDER, SyncService, SyncScheduler],
})
export class ChannelManagerModule {}
