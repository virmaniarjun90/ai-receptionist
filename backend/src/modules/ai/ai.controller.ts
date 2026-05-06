import { Body, Controller, Post } from '@nestjs/common';
import { AiService } from './ai.service';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('reply')
  async reply(@Body('message') message: string): Promise<{ reply: string }> {
    return {
      reply: await this.aiService.generateReply([
        { role: 'user', content: message },
      ]),
    };
  }
}
