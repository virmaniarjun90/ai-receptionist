import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { HostController } from './host.controller';
import { HostService } from './host.service';
import { CommonModule } from '../common/common.module';
import { AuthModule } from '../auth/auth.module';
import { HostGuard } from '../auth/host.guard';
import { CommunicationModule } from '../communication/communication.module';

@Module({
  imports: [
    CommonModule,
    AuthModule,
    CommunicationModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret',
      signOptions: { expiresIn: '24h' },
    }),
  ],
  controllers: [HostController],
  providers: [HostService, HostGuard],
})
export class HostModule {}
