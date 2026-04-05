import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AlertsService } from '../../alerts/alerts.service';
import { Alert } from '../../alerts/alert.schema';
import { Log } from '../../logs/log.schema';
import {
  AlertEnrichment,
  AlertInput,
  RuleContext,
} from '../interfaces/detection-rule.interface';
import { FAILED_LOGIN_EVENT_NAMES } from '../rules.constants';
import { RecommendationsService } from '../../recommendations/recommendations.service';

@Injectable()
export class RuleContextService {
  constructor(
    @InjectModel(Log.name) private readonly logModel: Model<Log>,
    @InjectModel(Alert.name) private readonly alertModel: Model<Alert>,
    private readonly alertsService: AlertsService,
    private readonly recommendationsService: RecommendationsService,
  ) {}

  build(ruleId: string): RuleContext {
    const logger = new Logger(`Rule:${ruleId}`);

    return {
      logModel: this.logModel,
      alertsService: this.alertsService,
      logger,
      emitAlert: async (input: AlertInput, log: Log): Promise<void> => {
        const enrichment = await this.buildEnrichment(log);
        const recommendations = this.recommendationsService.getRecommendations(input);
        
        const context = {
          ...(input.context ?? {}),
          enrichment,
          recommendations,
        };

        await this.alertsService.create({
          ruleId: input.ruleId,
          message: input.message,
          severity: input.severity,
          ip: input.ip,
          triggeredAt: input.triggeredAt ?? new Date(),
          context,
        });
      },
    };
  }

  private async buildEnrichment(log: Log): Promise<AlertEnrichment> {
    const [previousAlertsFromIp, userRiskScore] = await Promise.all([
      this.countAlertsFromIp(log.ip),
      this.computeUserRiskScore(log),
    ]);

    return {
      ipReputation: this.getIpReputation(log.ip),
      geo: this.getGeoLocation(log),
      previousAlertsFromIp,
      userRiskScore,
    };
  }

  private async countAlertsFromIp(ip?: string): Promise<number | undefined> {
    if (!ip) return undefined;
    return this.alertModel.countDocuments({ ip });
  }

  private async computeUserRiskScore(log: Log): Promise<number | undefined> {
    if (!log.user) return undefined;

    const lookbackStart = new Date(log.timestamp.getTime() - 24 * 60 * 60 * 1000);

    const failedLogins = await this.logModel.countDocuments({
      user: log.user,
      event: { $in: FAILED_LOGIN_EVENT_NAMES },
      timestamp: { $gte: lookbackStart, $lte: log.timestamp },
    });

    const previousAlertsFromIp = await this.countAlertsFromIp(log.ip);
    const ipScore = typeof previousAlertsFromIp === 'number' ? previousAlertsFromIp * 3 : 0;
    const score = Math.min(100, failedLogins * 5 + ipScore);

    return score;
  }

  private getIpReputation(ip?: string): AlertEnrichment['ipReputation'] {
    if (!ip) {
      return { classification: 'unknown', source: 'missing-ip' };
    }

    if (isPrivateIpv4(ip)) {
      return { classification: 'internal', source: 'rfc1918' };
    }

    return { classification: 'unknown', source: 'local-heuristic' };
  }

  private getGeoLocation(log: Log): AlertEnrichment['geo'] {
    const location = extractGeoPoint(log);
    if (!location) return undefined;
    return { ...location, source: 'log' };
  }
}

function extractGeoPoint(log: Log): { latitude: number; longitude: number } | undefined {
  const raw = readRecord(log.raw);
  const topLevelLat = readNumber(log.latitude);
  const topLevelLon = readNumber(log.longitude);

  if (
    topLevelLat !== undefined &&
    topLevelLon !== undefined &&
    topLevelLat >= -90 &&
    topLevelLat <= 90 &&
    topLevelLon >= -180 &&
    topLevelLon <= 180
  ) {
    return { latitude: topLevelLat, longitude: topLevelLon };
  }

  const lat =
    readNumber(raw?.latitude) ??
    readNumber(raw?.lat) ??
    readNumber(readRecord(raw?.geo)?.latitude) ??
    readNumber(readRecord(raw?.geo)?.lat) ??
    readNumber(readRecord(raw?.location)?.latitude) ??
    readNumber(readRecord(raw?.location)?.lat) ??
    readNumber(readRecord(readRecord(raw?.parsed)?.geo)?.latitude) ??
    readNumber(readRecord(readRecord(raw?.parsed)?.geo)?.lat);

  const lon =
    readNumber(raw?.longitude) ??
    readNumber(raw?.lon) ??
    readNumber(readRecord(raw?.geo)?.longitude) ??
    readNumber(readRecord(raw?.geo)?.lon) ??
    readNumber(readRecord(raw?.location)?.longitude) ??
    readNumber(readRecord(raw?.location)?.lon) ??
    readNumber(readRecord(readRecord(raw?.parsed)?.geo)?.longitude) ??
    readNumber(readRecord(readRecord(raw?.parsed)?.geo)?.lon);

  if (lat === undefined || lon === undefined) return undefined;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return undefined;

  return { latitude: lat, longitude: lon };
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;

  return false;
}
