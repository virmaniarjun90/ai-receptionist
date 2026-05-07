import { Module } from '@nestjs/common';
import { AdminModule } from './modules/admin/admin.module';
import { CommonModule } from './modules/common/common.module';
import { GuestModule } from './modules/guest/guest.module';
import { WebhookModule } from './modules/webhook/webhook.module';

@Module({
  imports: [
    CommonModule,   // @Global — provides APP_CONFIG, PrismaService everywhere
    WebhookModule,  // → QueueModule → AiModule, CommunicationModule, ConversationModule, KnowledgeModule, PropertyModule, ReservationModule
    AdminModule,    // → PropertyModule, KnowledgeModule, ReservationModule, ConversationModule, ChannelManagerModule, GuestModule
    GuestModule,    // public /guest/* routes — registration form + welcome kit
  ],
})
export class AppModule {}
