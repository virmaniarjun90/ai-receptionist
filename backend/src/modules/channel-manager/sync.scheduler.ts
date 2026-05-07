import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { PrismaService } from '../common/prisma.service';
import { SyncService } from './sync.service';

// Default: every hour. Override with SYNC_CRON env var (standard 5-field cron).
// e.g. SYNC_CRON="*/30 * * * *" for every 30 min, "0 */6 * * *" for every 6 h.
const DEFAULT_CRON = '0 * * * *';

@Injectable()
export class SyncScheduler implements OnModuleInit {
  private readonly logger = new Logger(SyncScheduler.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly syncService: SyncService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    const expression = process.env.SYNC_CRON ?? DEFAULT_CRON;
    const job = new CronJob(expression, () => void this.syncAllProperties());
    this.schedulerRegistry.addCronJob('channel-manager-sync', job);
    job.start();
    this.logger.log(`Channel manager sync scheduled: "${expression}"`);
  }

  async syncAllProperties(): Promise<void> {
    if (this.running) {
      this.logger.warn('Sync already in progress — skipping this tick');
      return;
    }

    this.running = true;
    this.logger.log('Scheduled sync started');

    try {
      const properties = await this.prisma.property.findMany({
        where: { externalId: { not: null } },
        select: { id: true, name: true },
      });

      if (properties.length === 0) {
        this.logger.log('No properties with externalId — nothing to sync');
        return;
      }

      this.logger.log(`Syncing ${properties.length} propert${properties.length === 1 ? 'y' : 'ies'}`);

      const results = await Promise.allSettled(
        properties.map((p) => this.syncService.syncProperty(p.id)),
      );

      let synced = 0;
      let failed = 0;

      for (const [i, result] of results.entries()) {
        if (result.status === 'fulfilled') {
          const r = result.value;
          this.logger.log(
            `${properties[i].name}: ${r.reservationsSynced} reservations, ${r.knowledgeEntriesSynced} knowledge entries`,
          );
          synced++;
        } else {
          this.logger.error(`${properties[i].name} sync failed: ${result.reason}`);
          failed++;
        }
      }

      this.logger.log(`Sync complete: ${synced} succeeded, ${failed} failed`);
    } finally {
      this.running = false;
    }
  }
}
