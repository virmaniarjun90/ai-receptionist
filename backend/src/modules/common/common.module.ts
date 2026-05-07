import { Global, Module } from '@nestjs/common';
import { APP_CONFIG, buildAppConfig } from '../../config/app.config';
import { CommonController } from './common.controller';
import { CommonService } from './common.service';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  controllers: [CommonController],
  providers: [
    {
      provide: APP_CONFIG,
      useFactory: buildAppConfig,
    },
    CommonService,
    PrismaService,
  ],
  exports: [APP_CONFIG, CommonService, PrismaService],
})
export class CommonModule {}
