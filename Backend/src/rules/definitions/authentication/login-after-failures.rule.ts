import { DetectionRule } from '../../interfaces/detection-rule.interface';
import {
  FAILED_LOGIN_EVENT_NAMES,
  LOGIN_AFTER_FAILURES_LOOKBACK_MINUTES,
  LOGIN_AFTER_FAILURES_MIN_FAILURES,
  LOGIN_SUCCESS_EVENT_NAMES,
  RULE_ID_LOGIN_AFTER_FAILURES,
} from '../../rules.constants';

export const loginAfterFailuresRule: DetectionRule = {
  id: RULE_ID_LOGIN_AFTER_FAILURES,
  name: 'Login after multiple failures',
  description: 'Detects a successful login that follows a burst of failed logins for the same user.',
  severity: 'medium',
  tags: ['authentication', 'account-takeover'],
  matches: (log) => Boolean(log.user) && LOGIN_SUCCESS_EVENT_NAMES.includes(log.event),
  async evaluate(log, context): Promise<void> {
    if (!log.user) return;

    const lookbackStart = new Date(
      log.timestamp.getTime() - LOGIN_AFTER_FAILURES_LOOKBACK_MINUTES * 60 * 1000,
    );

    const failures = await context.logModel.countDocuments({
      user: log.user,
      event: { $in: FAILED_LOGIN_EVENT_NAMES },
      timestamp: { $gte: lookbackStart, $lt: log.timestamp },
    });

    if (failures < LOGIN_AFTER_FAILURES_MIN_FAILURES) return;

    await context.emitAlert({
      ruleId: RULE_ID_LOGIN_AFTER_FAILURES,
      message: `Successful login for user ${log.user} after ${failures} failed attempts in ${LOGIN_AFTER_FAILURES_LOOKBACK_MINUTES} minutes`,
      severity: 'medium',
      ip: log.ip,
      triggeredAt: new Date(),
      context: {
        user: log.user,
        failures,
        lookbackMinutes: LOGIN_AFTER_FAILURES_LOOKBACK_MINUTES,
        successEventAt: log.timestamp,
      },
    }, log);
  },
};
