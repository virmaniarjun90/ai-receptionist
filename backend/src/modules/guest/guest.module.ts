import { Module } from '@nestjs/common';
import { CommunicationModule } from '../communication/communication.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { PropertyModule } from '../property/property.module';
import { ReservationModule } from '../reservation/reservation.module';
import { GuestController } from './guest.controller';
import { GuestService } from './guest.service';

@Module({
  imports: [PropertyModule, ReservationModule, KnowledgeModule, CommunicationModule],
  controllers: [GuestController],
  providers: [GuestService],
  exports: [GuestService],
})
export class GuestModule {}
