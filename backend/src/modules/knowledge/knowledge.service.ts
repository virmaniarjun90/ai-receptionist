import { Injectable, InternalServerErrorException } from '@nestjs/common';
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
}
