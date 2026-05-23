import { DetectionRule } from '../../interfaces/detection-rule.interface';
import {
  FAILED_LOGIN_BURST_CRITICAL_MIN,
  FAILED_LOGIN_EVENT_NAMES,
  FAILED_LOGIN_RAPID_THRESHOLD,
  FAILED_LOGIN_RAPID_WINDOW_MINUTES,
  FAILED_LOGIN_SLOW_THRESHOLD,
  FAILED_LOGIN_SLOW_WINDOW_MINUTES,
  FAILED_LOGIN_THRESHOLD,
  FAILED_LOGIN_WINDOW_MINUTES,
  RULE_ID_FAILED_LOGINS,
} from '../../rules.constants';

function windowStartMinutes(anchor: Date, minutes: number): Date {
  return new Date(anchor.getTime() - minutes * 60 * 1000);
}

export const failedLoginRule: DetectionRule = {
  id: RULE_ID_FAILED_LOGINS,
  name: 'Failed-login brute force',
  description:
    'Detects repeated failed logins from the same IP: rapid burst, sustained guessing, or threshold within a sliding window (scoped to tenant).',
  severity: 'high',
  tags: ['authentication', 'bruteforce'],
  matches: (log) => Boolean(log.ip) && FAILED_LOGIN_EVENT_NAMES.includes(log.event),
  async evaluate(log, context): Promise<void> {
    if (!log.ip) return;

    const ts = log.timestamp;
    const userId = log.userId;

    const baseFilter = {
      ip: log.ip,
      ...(userId != null ? { userId } : {}),
      event: { $in: FAILED_LOGIN_EVENT_NAMES },
    } as const;

    const [rapidCount, burstCount, slowCount] = await Promise.all([
      context.logModel.countDocuments({
        ...baseFilter,
        timestamp: {
          $gte: windowStartMinutes(ts, FAILED_LOGIN_RAPID_WINDOW_MINUTES),
          $lte: ts,
        },
      }),
      context.logModel.countDocuments({
        ...baseFilter,
        timestamp: {
          $gte: windowStartMinutes(ts, FAILED_LOGIN_WINDOW_MINUTES),
          $lte: ts,
        },
      }),
      context.logModel.countDocuments({
        ...baseFilter,
        timestamp: {
          $gte: windowStartMinutes(ts, FAILED_LOGIN_SLOW_WINDOW_MINUTES),
          $lte: ts,
        },
      }),
    ]);

    const rapidHit = rapidCount >= FAILED_LOGIN_RAPID_THRESHOLD;
    const burstHit = burstCount >= FAILED_LOGIN_THRESHOLD;
    const slowHit = slowCount >= FAILED_LOGIN_SLOW_THRESHOLD;

    if (!rapidHit && !burstHit && !slowHit) return;

    const burstEscalated = burstHit && burstCount >= FAILED_LOGIN_BURST_CRITICAL_MIN;
    const severity = burstEscalated ? 'critical' : 'high';

    const tiers: string[] = [];
    if (rapidHit) {
      tiers.push(
        `${rapidCount} failed logins in ${FAILED_LOGIN_RAPID_WINDOW_MINUTES}m (rapid)`,
      );
    }
    if (burstHit) {
      tiers.push(
        `${burstCount} failed logins in ${FAILED_LOGIN_WINDOW_MINUTES}m (burst)`,
      );
    }
    if (slowHit) {
      tiers.push(
        `${slowCount} failed logins in ${FAILED_LOGIN_SLOW_WINDOW_MINUTES}m (sustained)`,
      );
    }

    await context.emitAlert(
      {
        ruleId: RULE_ID_FAILED_LOGINS,
        message: `Brute-force pattern from IP ${log.ip}: ${tiers.join('; ')}`,
        severity,
        ip: log.ip,
        triggeredAt: new Date(),
        context: {
          ip: log.ip,
          lastEventAt: log.timestamp,
          rapid: {
            count: rapidCount,
            threshold: FAILED_LOGIN_RAPID_THRESHOLD,
            windowMinutes: FAILED_LOGIN_RAPID_WINDOW_MINUTES,
            triggered: rapidHit,
          },
          burst: {
            count: burstCount,
            threshold: FAILED_LOGIN_THRESHOLD,
            windowMinutes: FAILED_LOGIN_WINDOW_MINUTES,
            triggered: burstHit,
            criticalAt: FAILED_LOGIN_BURST_CRITICAL_MIN,
            escalatedToCritical: burstEscalated,
          },
          sustained: {
            count: slowCount,
            threshold: FAILED_LOGIN_SLOW_THRESHOLD,
            windowMinutes: FAILED_LOGIN_SLOW_WINDOW_MINUTES,
            triggered: slowHit,
          },
        },
      },
      log,
    );
  },
};
