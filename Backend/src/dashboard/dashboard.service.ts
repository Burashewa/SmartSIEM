import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Alert } from '../alerts/alert.schema';
import { Agent } from '../agents/agent.schema';
import { Log } from '../logs/log.schema';
import { AuthJwtPayload } from '../auth/auth.types';

type TrendTone = 'positive' | 'negative' | 'neutral';

interface DashboardMetric {
  value: number;
  trend: string;
  trendLabel: string;
  trendTone: TrendTone;
}

interface LogActivityPoint {
  time: string;
  logs: number;
}

interface AlertSeverityPoint {
  name: string;
  value: number;
  color: string;
}

interface EventsBySourcePoint {
  source: string;
  events: number;
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(Log.name) private readonly logModel: Model<Log>,
    @InjectModel(Alert.name) private readonly alertModel: Model<Alert>,
    @InjectModel(Agent.name) private readonly agentModel: Model<Agent>,
  ) {}

  /**
   * Fast path: counts only (no chart aggregations). Use for frequent polling.
   */
  async getKpi(user: AuthJwtPayload) {
    return this.computeDashboardMetrics(user, new Date());
  }

  async getSummary(user: AuthJwtPayload) {
    const now = new Date();
    const lastDayStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const logFilter = this.buildOwnershipFilter(user);
    const alertFilter = this.buildOwnershipFilter(user);

    const [metricsBlock, logActivity, alertsBySeverity, eventsBySource] = await Promise.all([
      this.computeDashboardMetrics(user, now),
      this.buildLogActivity(now, logFilter),
      this.buildAlertsBySeverity(alertFilter),
      this.buildEventsBySource(lastDayStart, now, logFilter),
    ]);

    return {
      generatedAt: metricsBlock.generatedAt,
      metrics: metricsBlock.metrics,
      charts: {
        logActivity,
        alertsBySeverity,
        eventsBySource,
      },
    };
  }

  private async computeDashboardMetrics(user: AuthJwtPayload, now: Date) {
    const todayStart = startOfDay(now);
    const yesterdayStart = addDays(todayStart, -1);
    const lastHourStart = new Date(now.getTime() - 60 * 60 * 1000);
    const logFilter = this.buildOwnershipFilter(user);
    const alertFilter = this.buildOwnershipFilter(user);

    const [
      logsToday,
      logsYesterday,
      activeAlerts,
      newAlertsToday,
      criticalThreats,
      criticalTriggeredToday,
      recentHighSeverityLogs,
    ] = await Promise.all([
      this.logModel.countDocuments({
        ...logFilter,
        timestamp: { $gte: todayStart, $lte: now },
      }),
      this.logModel.countDocuments({
        ...logFilter,
        timestamp: { $gte: yesterdayStart, $lt: todayStart },
      }),
      this.alertModel.countDocuments({
        ...alertFilter,
        status: { $nin: ['resolved', 'false_positive'] },
      }),
      this.alertModel.countDocuments({
        ...alertFilter,
        triggeredAt: { $gte: todayStart, $lte: now },
      }),
      this.alertModel.countDocuments({
        ...alertFilter,
        severity: 'critical',
        status: { $nin: ['resolved', 'false_positive'] },
      }),
      this.alertModel.countDocuments({
        ...alertFilter,
        severity: 'critical',
        triggeredAt: { $gte: todayStart, $lte: now },
      }),
      this.logModel.countDocuments({
        ...logFilter,
        severity: { $in: ['high', 'critical'] },
        timestamp: { $gte: lastHourStart, $lte: now },
      }),
    ]);

    const systemHealth = this.computeSystemHealth({
      activeAlerts,
      criticalThreats,
      recentHighSeverityLogs,
    });

    return {
      generatedAt: now.toISOString(),
      metrics: {
        logsToday: this.buildLogsTodayMetric(logsToday, logsYesterday),
        activeAlerts: this.buildCountMetric(
          activeAlerts,
          `${newAlertsToday} new`,
          'today',
          newAlertsToday > 0 ? 'negative' : 'neutral',
        ),
        criticalThreats: this.buildCountMetric(
          criticalThreats,
          `${criticalTriggeredToday} triggered`,
          'today',
          criticalThreats > 0 ? 'negative' : 'positive',
        ),
        systemHealth: {
          value: systemHealth.score,
          trend: systemHealth.label,
          trendLabel: 'overall status',
          trendTone: systemHealth.tone,
        },
      },
    };
  }

  private buildLogsTodayMetric(logsToday: number, logsYesterday: number): DashboardMetric {
    if (logsYesterday === 0) {
      return {
        value: logsToday,
        trend: logsToday === 0 ? '0%' : '+100%',
        trendLabel: 'vs yesterday',
        trendTone: logsToday === 0 ? 'neutral' : 'positive',
      };
    }

    const deltaPercent = ((logsToday - logsYesterday) / logsYesterday) * 100;
    const sign = deltaPercent > 0 ? '+' : '';

    return {
      value: logsToday,
      trend: `${sign}${deltaPercent.toFixed(1)}%`,
      trendLabel: 'vs yesterday',
      trendTone: deltaPercent > 0 ? 'positive' : deltaPercent < 0 ? 'negative' : 'neutral',
    };
  }

  private buildCountMetric(
    value: number,
    trend: string,
    trendLabel: string,
    trendTone: TrendTone,
  ): DashboardMetric {
    return { value, trend, trendLabel, trendTone };
  }

  private async buildLogActivity(
    now: Date,
    filter: Record<string, unknown>,
  ): Promise<LogActivityPoint[]> {
    const bucketCount = 6;
    const bucketMs = 4 * 60 * 60 * 1000;
    const windowStart = new Date(now.getTime() - bucketCount * bucketMs);

    const counts = await Promise.all(
      Array.from({ length: bucketCount }, (_, index) => {
        const bucketStart = new Date(windowStart.getTime() + index * bucketMs);
        const bucketEnd =
          index === bucketCount - 1
            ? now
            : new Date(windowStart.getTime() + (index + 1) * bucketMs);

        return this.logModel
          .countDocuments({
            ...filter,
            timestamp: {
              $gte: bucketStart,
              $lt: bucketEnd,
            },
          })
          .then((logs) => ({
            time: formatHourLabel(bucketStart),
            logs,
          }));
      }),
    );

    return counts;
  }

  private async buildAlertsBySeverity(
    filter: Record<string, unknown>,
  ): Promise<AlertSeverityPoint[]> {
    const counts = await this.alertModel.aggregate<{ _id: string; value: number }>([
      { $match: { ...filter, status: { $ne: 'false_positive' } } },
      {
        $group: {
          _id: {
            $toLower: '$severity',
          },
          value: {
            $sum: 1,
          },
        },
      },
    ]);

    const countMap = new Map(counts.map((item) => [item._id, item.value]));

    return [
      { name: 'Critical', value: countMap.get('critical') ?? 0, color: '#ef4444' },
      { name: 'High', value: countMap.get('high') ?? 0, color: '#f59e0b' },
      { name: 'Medium', value: countMap.get('medium') ?? 0, color: '#eab308' },
      { name: 'Low', value: countMap.get('low') ?? 0, color: '#3b82f6' },
    ];
  }

  private async buildEventsBySource(
    start: Date,
    end: Date,
    filter: Record<string, unknown>,
  ): Promise<EventsBySourcePoint[]> {
    const rows = await this.logModel.aggregate<{
      source: string;
      events: number;
    }>([
      {
        $match: {
          ...filter,
          timestamp: { $gte: start, $lte: end },
          agentId: { $exists: true, $nin: [null, ''] },
        },
      },
      {
        $group: {
          _id: '$agentId',
          events: { $sum: 1 },
        },
      },
      { $sort: { events: -1 } },
      { $limit: 6 },
      {
        $lookup: {
          from: 'agents',
          localField: '_id',
          foreignField: 'agentId',
          as: 'agent',
        },
      },
      {
        $unwind: {
          path: '$agent',
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $project: {
          _id: 0,
          source: '$agent.name',
          events: 1,
        },
      },
    ]);

    return rows;
  }

  private buildOwnershipFilter(user: AuthJwtPayload): Record<string, unknown> {
    if (user.role === 'admin') {
      return {};
    }

    return { userId: new Types.ObjectId(user.sub) };
  }

  private computeSystemHealth(input: {
    activeAlerts: number;
    criticalThreats: number;
    recentHighSeverityLogs: number;
  }): { score: number; label: string; tone: TrendTone } {
    const penalty =
      input.activeAlerts * 1.5 +
      input.criticalThreats * 8 +
      input.recentHighSeverityLogs * 0.75;

    const score = roundToSingleDecimal(Math.max(0, Math.min(100, 100 - penalty)));

    if (score >= 95) {
      return { score, label: 'Optimal', tone: 'positive' };
    }

    if (score >= 85) {
      return { score, label: 'Stable', tone: 'neutral' };
    }

    if (score >= 70) {
      return { score, label: 'Watch', tone: 'negative' };
    }

    return { score, label: 'Degraded', tone: 'negative' };
  }
}

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function addDays(date: Date, amount: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function roundToSingleDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function formatHourLabel(value: Date): string {
  return value.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}
