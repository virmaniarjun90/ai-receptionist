import { Global, Module } from '@nestjs/common';
import { CommonController } from './common.controller';
import { CommonService } from './common.service';
import { FeatureFlagsService } from './feature-flags.service';
import { PrismaService } from './prisma.service';

// CommonModule owns shared infrastructure used across business modules.
@Global()
@Module({
  controllers: [CommonController],
  providers: [CommonService, FeatureFlagsService, PrismaService],
  exports: [CommonService, FeatureFlagsService, PrismaService],
})
export class CommonModule {}
