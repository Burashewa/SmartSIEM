import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model } from 'mongoose';
import { Alert } from '../alerts/alert.schema';
import { AuthJwtPayload } from '../auth/auth.types';
import { ReportsService } from './reports.service';

/**
 * Writes one Markdown report per alert-owning user (by distinct userId on Alert docs).
 */
@Injectable()
export class ReportsSchedulerService {
  private readonly logger = new Logger(ReportsSchedulerService.name);

  constructor(
    private readonly reportsService: ReportsService,
    @InjectModel(Alert.name) private readonly alertModel: Model<Alert>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_7AM)
  async handleDailyReports(): Promise<void> {
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
    let ids: unknown[];
    try {
      ids = await this.alertModel.distinct('userId', { triggeredAt: { $gte: since } });
    } catch (e) {
      this.logger.error(`Daily report distinct failed: ${e instanceof Error ? e.message : e}`);
      return;
    }

    for (const uid of ids) {
      const user: AuthJwtPayload = {
        sub: String(uid),
        username: 'scheduled-daily-report',
        role: 'security_analyst',
        sid: 'cron',
        type: 'access',
      };
      try {
        const out = await this.reportsService.generateDailySecurityReport(user);
        this.logger.log(`Scheduled report for ${user.sub}: ${out.filePath}`);
      } catch (e) {
        this.logger.warn(`Scheduled report failed for ${user.sub}: ${e instanceof Error ? e.message : e}`);
      }
    }
  }
}
