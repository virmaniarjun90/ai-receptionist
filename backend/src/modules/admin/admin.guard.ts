import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { APP_CONFIG, AppConfig } from '../../config/app.config';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const apiKey = this.config.admin.apiKey;

    // No key configured → open access (dev/local mode).
    if (!apiKey) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const provided = req.headers['x-admin-key'];

    if (provided !== apiKey) {
      throw new UnauthorizedException('ADMIN_ERROR: Invalid or missing X-Admin-Key header');
    }

    return true;
  }
}
