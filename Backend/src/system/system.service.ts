import { Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { Alert } from '../alerts/alert.schema';
import { Log } from '../logs/log.schema';

type OverallStatus = 'healthy' | 'critical';
type DatabaseState = 'disconnected' | 'connected' | 'connecting' | 'disconnecting';

@Injectable()
export class SystemService {
  constructor(
    @InjectModel(Log.name) private readonly logModel: Model<Log>,
    @InjectModel(Alert.name) private readonly alertModel: Model<Alert>,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  async getStatus() {
    const now = new Date();
    const lastMinuteStart = new Date(now.getTime() - 60 * 1000);

    const [logsLastMinute, activeAlerts, criticalThreats] = await Promise.all([
      this.logModel.countDocuments({
        timestamp: { $gte: lastMinuteStart, $lte: now },
      }),
      this.alertModel.countDocuments({ status: { $ne: 'resolved' } }),
      this.alertModel.countDocuments({
        severity: 'critical',
        status: { $ne: 'resolved' },
      }),
    ]);

    const databaseState = this.mapReadyState(this.connection.readyState);
    const databaseConnected = databaseState === 'connected';
    const ingestionRate = Math.round(logsLastMinute / 60);
    const systemStatus = this.computeOverallStatus({
      databaseConnected,
      activeAlerts,
      criticalThreats,
    });

    return {
      generatedAt: now.toISOString(),
      ingestionRate: {
        eps: ingestionRate,
        windowSeconds: 60,
        logsLastMinute,
      },
      database: {
        connected: databaseConnected,
        state: databaseState,
        provider: 'MongoDB',
      },
      systemStatus: {
        status: systemStatus,
        activeAlerts,
        criticalThreats,
      },
    };
  }

  private mapReadyState(readyState: number): DatabaseState {
    switch (readyState) {
      case 1:
        return 'connected';
      case 2:
        return 'connecting';
      case 3:
        return 'disconnecting';
      default:
        return 'disconnected';
    }
  }

  private computeOverallStatus(input: {
    databaseConnected: boolean;
    activeAlerts: number;
    criticalThreats: number;
  }): OverallStatus {
    if (!input.databaseConnected) {
      return 'critical';
    }

    if (input.criticalThreats > 0) {
      return 'critical';
    }

    if (input.activeAlerts > 25) {
      return 'critical';
    }

    return 'healthy';
  }
}
