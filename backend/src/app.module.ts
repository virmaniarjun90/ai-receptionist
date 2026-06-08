import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AdminModule } from './modules/admin/admin.module';
import { CommonModule } from './modules/common/common.module';
import { GuestModule } from './modules/guest/guest.module';
import { WebhookModule } from './modules/webhook/webhook.module';

@Module({
  imports: [
    // Serves admin/dist as a SPA — falls back to index.html for unknown routes.
    // API controllers (/admin/*, /webhook/*, /guest/*, /health) always take precedence.
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), '..', 'admin', 'dist'),
      renderPath: '/*',
      serveStaticOptions: { index: false },
    }),
    CommonModule,
    WebhookModule,
    AdminModule,
    GuestModule,
  ],
})
export class AppModule {}
