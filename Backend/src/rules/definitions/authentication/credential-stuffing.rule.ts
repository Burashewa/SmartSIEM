import { DetectionRule } from '../../interfaces/detection-rule.interface';
import {
  CREDENTIAL_STUFFING_MIN_UNIQUE_USERS,
  CREDENTIAL_STUFFING_WINDOW_MINUTES,
  FAILED_LOGIN_EVENT_NAMES,
  RULE_ID_CREDENTIAL_STUFFING,
} from '../../rules.constants';

export const credentialStuffingRule: DetectionRule = {
  id: RULE_ID_CREDENTIAL_STUFFING,
  name: 'Credential stuffing',
  description: 'Detects failed login attempts from a single IP targeting many distinct users.',
  severity: 'high',
  tags: ['authentication', 'credential-stuffing'],
  matches: (log) => Boolean(log.ip) && Boolean(log.user) && FAILED_LOGIN_EVENT_NAMES.includes(log.event),
  async evaluate(log, context): Promise<void> {
    if (!log.ip) return;

    const windowStart = new Date(log.timestamp.getTime() - CREDENTIAL_STUFFING_WINDOW_MINUTES * 60 * 1000);

    const query = {
      ip: log.ip,
      event: { $in: FAILED_LOGIN_EVENT_NAMES },
      user: { $exists: true, $nin: [null, ''] },
      timestamp: { $gte: windowStart, $lte: log.timestamp },
    };

    const [uniqueUsers, totalAttempts] = await Promise.all([
      context.logModel.distinct('user', query),
      context.logModel.countDocuments(query),
    ]);

    if (uniqueUsers.length < CREDENTIAL_STUFFING_MIN_UNIQUE_USERS) return;

    await context.emitAlert({
      ruleId: RULE_ID_CREDENTIAL_STUFFING,
      message: `Credential stuffing suspected from IP ${log.ip}: ${uniqueUsers.length} users targeted in ${CREDENTIAL_STUFFING_WINDOW_MINUTES} minutes`,
      severity: 'high',
      ip: log.ip,
      triggeredAt: new Date(),
      context: {
        ip: log.ip,
        uniqueUsers: uniqueUsers.length,
        totalAttempts,
        windowMinutes: CREDENTIAL_STUFFING_WINDOW_MINUTES,
        lastEventAt: log.timestamp,
      },
    }, log);
  },
};
