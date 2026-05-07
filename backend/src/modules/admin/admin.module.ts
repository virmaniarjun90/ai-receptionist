import { Module } from '@nestjs/common';
import { ChannelManagerModule } from '../channel-manager/channel-manager.module';
import { CommunicationModule } from '../communication/communication.module';
import { ConversationModule } from '../conversation/conversation.module';
import { GuestModule } from '../guest/guest.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { PropertyModule } from '../property/property.module';
import { ReservationModule } from '../reservation/reservation.module';
import { AdminController } from './admin.controller';
import { AdminGuard } from './admin.guard';

@Module({
  imports: [
    PropertyModule,
    KnowledgeModule,
    ReservationModule,
    ConversationModule,
    CommunicationModule,
    ChannelManagerModule,
    GuestModule,
  ],
  controllers: [AdminController],
  providers: [AdminGuard],
})
export class AdminModule {}
