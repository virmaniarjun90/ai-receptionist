import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

@Injectable()
export class HostGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<any>();
    const token = req.cookies['host_token'];

    if (!token) {
      throw new UnauthorizedException('No host token');
    }

    try {
      const payload = this.jwt.verify(token);
      req.hostData = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid host token');
    }
  }
}
