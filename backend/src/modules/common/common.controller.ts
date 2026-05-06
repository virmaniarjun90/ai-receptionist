import { Controller, Get } from '@nestjs/common';
import { CommonService, HealthStatus } from './common.service';

@Controller('health')
export class CommonController {
  constructor(private readonly commonService: CommonService) {}

  @Get()
  async check(): Promise<HealthStatus> {
    return this.commonService.getHealthStatus();
  }
}
