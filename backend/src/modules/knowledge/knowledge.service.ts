import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Knowledge } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class KnowledgeService {
  constructor(private readonly prisma: PrismaService) {}

  async getKnowledgeByProperty(propertyId: string): Promise<Knowledge[]> {
    try {
      return await this.prisma.knowledge.findMany({
        where: { propertyId },
        orderBy: { key: 'asc' },
      });
    } catch (error) {
      throw new InternalServerErrorException(
        'KNOWLEDGE_SERVICE_ERROR: DB property knowledge query failed',
      );
    }
  }

  async upsert(propertyId: string, key: string, value: string): Promise<Knowledge> {
    try {
      return await this.prisma.knowledge.upsert({
        where: { propertyId_key: { propertyId, key } },
        update: { value },
        create: { propertyId, key, value },
      });
    } catch (error) {
      throw new InternalServerErrorException(
        'KNOWLEDGE_SERVICE_ERROR: DB upsert failed',
      );
    }
  }

  async delete(propertyId: string, key: string): Promise<void> {
    const existing = await this.prisma.knowledge.findUnique({
      where: { propertyId_key: { propertyId, key } },
    });
    if (!existing) throw new NotFoundException(`Knowledge key "${key}" not found`);

    try {
      await this.prisma.knowledge.delete({
        where: { propertyId_key: { propertyId, key } },
      });
    } catch (error) {
      throw new InternalServerErrorException(
        'KNOWLEDGE_SERVICE_ERROR: DB delete failed',
      );
    }
  }
}
