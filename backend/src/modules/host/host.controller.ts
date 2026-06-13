import { Controller, Get, Post, Param, UseGuards, Req, BadRequestException, Body } from '@nestjs/common';
import { Request } from 'express';
import { HostGuard } from '../auth/host.guard';
import { HostService } from './host.service';

@Controller('host')
@UseGuards(HostGuard)
export class HostController {
  constructor(private readonly host: HostService) {}

  @Get('properties')
  async getProperties(@Req() req: any): Promise<any[]> {
    const hostPhone = req.hostData.phone;
    return this.host.getPropertiesForHost(hostPhone);
  }

  @Get('properties/:propertyId/reservations')
  async getReservations(
    @Param('propertyId') propertyId: string,
    @Req() req: any,
  ): Promise<any[]> {
    const hostPhone = req.hostData.phone;
    return this.host.getReservationsForProperty(hostPhone, propertyId);
  }

  @Get('properties/:propertyId/conversations')
  async getConversations(
    @Param('propertyId') propertyId: string,
    @Req() req: any,
  ): Promise<any[]> {
    const hostPhone = req.hostData.phone;
    return this.host.getConversationsForProperty(hostPhone, propertyId);
  }

  @Get('conversations/:conversationId')
  async getConversationDetail(
    @Param('conversationId') conversationId: string,
    @Req() req: any,
  ): Promise<any> {
    const hostPhone = req.hostData.phone;
    return this.host.getConversationDetail(hostPhone, conversationId);
  }

  @Get('properties/:propertyId')
  async getPropertyDetail(
    @Param('propertyId') propertyId: string,
    @Req() req: any,
  ): Promise<any> {
    const hostPhone = req.hostData.phone;
    return this.host.getPropertyDetail(hostPhone, propertyId);
  }

  @Post('conversations/:conversationId/takeover')
  async takeOverConversation(
    @Param('conversationId') conversationId: string,
    @Req() req: any,
  ): Promise<any> {
    const hostPhone = req.hostData.phone;
    const hostName = req.hostData.name;
    return this.host.takeOverConversation(conversationId, hostPhone, hostName);
  }

  @Post('conversations/:conversationId/handback')
  async handBackToAI(
    @Param('conversationId') conversationId: string,
    @Req() req: any,
  ): Promise<any> {
    const hostPhone = req.hostData.phone;
    return this.host.handBackToAI(conversationId, hostPhone);
  }

  @Post('conversations/:conversationId/messages')
  async sendMessage(
    @Param('conversationId') conversationId: string,
    @Body() body: { content: string },
    @Req() req: any,
  ): Promise<any> {
    const hostPhone = req.hostData.phone;
    return this.host.sendHostMessage(conversationId, hostPhone, body.content);
  }
}
