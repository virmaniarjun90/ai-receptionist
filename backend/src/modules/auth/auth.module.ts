import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { HostLoginController } from './host-login.controller';
import { HostLoginService } from './host-login.service';
import { HostGuard } from './host.guard';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret',
      signOptions: { expiresIn: '24h' },
    }),
    CommonModule,
  ],
  controllers: [HostLoginController],
  providers: [HostLoginService, HostGuard],
  exports: [HostGuard],
})
export class AuthModule {}
