import { Controller, Post, Body, BadRequestException, HttpCode, Res } from '@nestjs/common';
import { Response } from 'express';
import { HostLoginService } from './host-login.service';

@Controller('auth/host')
export class HostLoginController {
  constructor(private readonly hostLogin: HostLoginService) {}

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() body: { phone: string; pin: string },
    @Res() res: Response,
  ): Promise<void> {
    const { phone, pin } = body;
    if (!phone || !pin) {
      throw new BadRequestException('Phone and PIN required');
    }

    const result = await this.hostLogin.login(phone, pin);
    if (!result) {
      throw new BadRequestException('Invalid credentials');
    }

    res.cookie('host_token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.json({ success: true, host: result.host });
  }
}
