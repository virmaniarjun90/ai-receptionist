import { Body, Controller, Get, Post } from '@nestjs/common';
import { Property } from '@prisma/client';
import { CreatePropertyInput, PropertyService } from './property.service';

@Controller('properties')
export class PropertyController {
  constructor(private readonly propertyService: PropertyService) {}

  @Get()
  async listProperties(): Promise<Property[]> {
    return this.propertyService.listProperties();
  }

  @Post()
  async createProperty(@Body() input: CreatePropertyInput): Promise<Property> {
    return this.propertyService.createProperty(input);
  }
}
