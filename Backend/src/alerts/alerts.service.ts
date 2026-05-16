import { randomUUID } from 'crypto';
import { InjectModel } from '@nestjs/mongoose';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Model, Types } from 'mongoose';
import { Alert } from './alert.schema';
import { AuthJwtPayload } from '../auth/auth.types';
import { IpGeoLocation, IpGeolocationService } from '../geo/ip-geolocation.service';
import { humanizeRuleId } from './alert-rule-labels';

const DEFAULT_DEDUP_WINDOW_MINUTES = 5;

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: number }).code === 11000
  );
}

export type AlertResponse = Record<string, unknown> & {
  _id?: unknown;
  id?: unknown;
  /** Alias for clients; stored as `rule_id` in MongoDB. */
  ruleId?: string;
  rule_id?: string;
  message?: string;
  severity?: string;
  ip?: string;
  status?: string;
  triggeredAt?: string | Date;
  firstTriggeredAt?: string | Date;
  occurrenceCount?: number;
  dedupeGroupKey?: string;
  context?: Record<string, unknown>;
  geo?: IpGeoLocation;
  attackerLocation?: string;
};

@Injectable()
export class AlertsService {
  constructor(
    @InjectModel(Alert.name) private readonly alertModel: Model<Alert>,
    private readonly ipGeolocation: IpGeolocationService,
    private readonly config: ConfigService,
  ) {}

  async create(
    data: Partial<Alert> & { ruleId?: string; rule_id?: string; dedup_bucket?: string },
    attempt = 0,
  ): Promise<Alert> {
    const rule_id = data.rule_id ?? data.ruleId;
    if (!rule_id || typeof rule_id !== 'string') {
      throw new BadRequestException('Alert rule_id (or ruleId) is required');
    }
    if (!data.userId) {
      throw new BadRequestException('Alert userId is required');
    }
    if (attempt > 8) {
      throw new BadRequestException('Alert deduplication retry limit exceeded');
    }

    const triggeredAt = data.triggeredAt ? new Date(data.triggeredAt) : new Date();
    const windowDurationMs = this.resolveDedupWindowMs();
    const windowMinutes = Math.max(1, Math.round(windowDurationMs / 60_000));

    const normalizedIp = typeof data.ip === 'string' ? data.ip.trim() : '';
    const agentKey =
      typeof data.agentId === 'string' && data.agentId.trim() !== '' ? data.agentId.trim() : '_';
    const userIdStr = String(data.userId);
    const bucketStart = Math.floor(triggeredAt.getTime() / windowDurationMs) * windowDurationMs;
    const dedupeGroupKey = `v1|${userIdStr}|${bucketStart}|${rule_id}|${normalizedIp}|${agentKey}`;

    const mergeFilter = {
      userId: data.userId,
      dedupeGroupKey,
      status: { $in: ['open', 'investigating'] as const },
    };

    const setFields: Record<string, unknown> = {
      triggeredAt,
      severity: String(data.severity ?? 'medium'),
      context: data.context,
      rule_id,
    };
    if (normalizedIp) {
      setFields.ip = normalizedIp;
    }
    if (data.agentId) {
      setFields.agentId = data.agentId;
    }

    const updated = await this.alertModel.findOneAndUpdate(
      mergeFilter,
      {
        $inc: { occurrenceCount: 1 },
        $set: setFields,
      },
      { new: true },
    );

    if (updated) {
      const count = updated.occurrenceCount ?? 1;
      const message = this.formatDedupSummaryMessage({
        ip: normalizedIp,
        ruleId: rule_id,
        count,
        windowMinutes,
      });

      if (updated.message !== message) {
        const finalDoc = await this.alertModel.findByIdAndUpdate(
          updated._id,
          { $set: { message } },
          { new: true },
        );
        return finalDoc ?? updated;
      }
      return updated;
    }

    const dedup_bucket =
      data.dedup_bucket && typeof data.dedup_bucket === 'string'
        ? data.dedup_bucket
        : `${dedupeGroupKey}:${randomUUID()}`;

    try {
      return await this.alertModel.create({
        userId: data.userId,
        agentId: data.agentId,
        rule_id,
        dedup_bucket,
        dedupeGroupKey,
        message: data.message ?? '',
        severity: String(data.severity ?? 'medium'),
        ip: normalizedIp || undefined,
        status: data.status ?? 'open',
        triggeredAt,
        firstTriggeredAt: triggeredAt,
        occurrenceCount: 1,
        context: data.context,
      });
    } catch (e) {
      if (isDuplicateKeyError(e)) {
        return this.create(data, attempt + 1);
      }
      throw e;
    }
  }

  private resolveDedupWindowMs(): number {
    const msRaw = this.config.get<string>('ALERT_DEDUP_WINDOW_MS');
    if (msRaw !== undefined && msRaw !== '') {
      const n = Number(msRaw);
      if (Number.isFinite(n) && n >= 10_000) {
        return n;
      }
    }
    const minutesRaw = this.config.get<string>('ALERT_DEDUP_WINDOW_MINUTES');
    const minutes =
      minutesRaw !== undefined && minutesRaw !== ''
        ? Number(minutesRaw)
        : DEFAULT_DEDUP_WINDOW_MINUTES;
    const m = Number.isFinite(minutes) && minutes > 0 ? minutes : DEFAULT_DEDUP_WINDOW_MINUTES;
    return Math.round(m * 60_000);
  }

  private formatDedupSummaryMessage(opts: {
    ip: string;
    ruleId: string;
    count: number;
    windowMinutes: number;
  }): string {
    const ipLabel = opts.ip.trim() || 'unknown IP';
    const ruleName = humanizeRuleId(opts.ruleId);
    const { count, windowMinutes } = opts;
    const timeUnit = windowMinutes === 1 ? 'minute' : 'minutes';
    const times = count === 1 ? 'time' : 'times';
    return `${ipLabel} triggered the ${ruleName} rule ${count} ${times} in ${windowMinutes} ${timeUnit}`;
  }

  async list(user: AuthJwtPayload): Promise<AlertResponse[]> {
    const alerts = await this.alertModel
      .find(this.buildOwnershipFilter(user))
      .sort({ triggeredAt: -1 })
      .exec();
    return Promise.all(alerts.map((alert) => this.enrichWithGeo(alert)));
  }

  async findById(id: string, user: AuthJwtPayload): Promise<AlertResponse> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Alert not found');
    }
    const doc = await this.alertModel
      .findOne({ _id: id, ...this.buildOwnershipFilter(user) })
      .exec();
    if (!doc) {
      throw new NotFoundException('Alert not found');
    }
    return this.enrichWithGeo(doc);
  }

  /** Plain alert documents for reporting (no geo enrichment). */
  async findTriggeredInRange(
    user: AuthJwtPayload,
    since: Date,
    until: Date = new Date(),
  ): Promise<Alert[]> {
    return this.alertModel
      .find({
        ...this.buildOwnershipFilter(user),
        triggeredAt: { $gte: since, $lte: until },
      })
      .sort({ triggeredAt: -1 })
      .exec();
  }

  // Clear all alerts from the database
  async clearAll(user: AuthJwtPayload): Promise<{ deletedCount: number }> {
    const result = await this.alertModel.deleteMany(this.buildOwnershipFilter(user));
    return { deletedCount: result.deletedCount ?? 0 };
  }

  private buildOwnershipFilter(user: AuthJwtPayload): Record<string, unknown> {
    if (user.role === 'admin') {
      return {};
    }

    return { userId: new Types.ObjectId(user.sub) };
  }

  private async enrichWithGeo(alert: Alert): Promise<AlertResponse> {
    const plain = alert.toObject({ virtuals: true }) as AlertResponse;
    const context = alert.context;
    const geo = await this.ipGeolocation.locate(alert.ip, context);
    const rule_id = plain.rule_id as string | undefined;
    const ruleId = plain.ruleId ?? rule_id;

    return {
      ...plain,
      ruleId,
      rule_id,
      geo,
      attackerLocation: this.formatLocation(geo),
    };
  }

  private formatLocation(geo?: IpGeoLocation): string | undefined {
    if (!geo) return undefined;
    const parts = [geo.city, geo.region, geo.country].filter(
      (value): value is string => Boolean(value),
    );
    if (parts.length > 0) return parts.join(', ');
    if (geo.source === 'private') return 'Private network';
    return undefined;
  }
}
