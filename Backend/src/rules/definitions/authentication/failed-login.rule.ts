import { DetectionRule } from '../../interfaces/detection-rule.interface';
import {
  FAILED_LOGIN_EVENT_NAMES,
  FAILED_LOGIN_THRESHOLD,
  FAILED_LOGIN_WINDOW_MINUTES,
  RULE_ID_FAILED_LOGINS,
} from '../../rules.constants';

export const failedLoginRule: DetectionRule = {
  id: RULE_ID_FAILED_LOGINS,
  name: 'Failed logins in short window',
  description: 'Detects repeated failed logins from the same IP within a short timeframe.',
  severity: 'high',
  tags: ['authentication', 'bruteforce'],
  matches: (log) => Boolean(log.ip) && FAILED_LOGIN_EVENT_NAMES.includes(log.event),
  async evaluate(log, context): Promise<void> {
    if (!log.ip) return;

    const windowStart = new Date(log.timestamp.getTime() - FAILED_LOGIN_WINDOW_MINUTES * 60 * 1000);

    const count = await context.logModel.countDocuments({
      ip: log.ip,
      event: { $in: FAILED_LOGIN_EVENT_NAMES },
      timestamp: { $gte: windowStart, $lte: log.timestamp },
    });

    if (count < FAILED_LOGIN_THRESHOLD) return;

    await context.emitAlert({
      ruleId: RULE_ID_FAILED_LOGINS,
      message: `Detected ${count} failed logins from IP ${log.ip} within ${FAILED_LOGIN_WINDOW_MINUTES} minutes`,
      severity: 'high',
      ip: log.ip,
      triggeredAt: new Date(),
      context: {
        count,
        windowMinutes: FAILED_LOGIN_WINDOW_MINUTES,
        ip: log.ip,
        lastEventAt: log.timestamp,
      },
    }, log);
  },
};
