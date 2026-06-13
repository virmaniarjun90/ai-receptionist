import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AdminModule } from './modules/admin/admin.module';
import { CommonModule } from './modules/common/common.module';
import { GuestModule } from './modules/guest/guest.module';
import { WebhookModule } from './modules/webhook/webhook.module';
import { AuthModule } from './modules/auth/auth.module';
import { HostModule } from './modules/host/host.module';

@Module({
  imports: [
    CommonModule,
    AuthModule,
    WebhookModule,
    AdminModule,
    HostModule,
    GuestModule,
    // Serves admin/dist as a SPA — falls back to index.html for unknown routes.
    // Must come LAST so API routes (/admin/*, /auth/*, /host/*, /webhook/*, /guest/*, /health) match first.
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), '..', 'admin', 'dist'),
      renderPath: '/*',
      serveStaticOptions: { index: false },
    }),
  ],
})
export class AppModule {}
