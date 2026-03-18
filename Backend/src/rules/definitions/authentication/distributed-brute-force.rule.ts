import { DetectionRule } from '../../interfaces/detection-rule.interface';
import {
  DISTRIBUTED_BRUTE_FORCE_MIN_UNIQUE_IPS,
  DISTRIBUTED_BRUTE_FORCE_WINDOW_MINUTES,
  FAILED_LOGIN_EVENT_NAMES,
  RULE_ID_DISTRIBUTED_BRUTE_FORCE,
} from '../../rules.constants';

export const distributedBruteForceRule: DetectionRule = {
  id: RULE_ID_DISTRIBUTED_BRUTE_FORCE,
  name: 'Distributed brute force',
  description: 'Detects many distinct IPs failing to log in as the same user in a short window.',
  severity: 'high',
  tags: ['authentication', 'bruteforce', 'distributed'],
  matches: (log) => Boolean(log.user) && FAILED_LOGIN_EVENT_NAMES.includes(log.event),
  async evaluate(log, context): Promise<void> {
    if (!log.user) return;

    const windowStart = new Date(log.timestamp.getTime() - DISTRIBUTED_BRUTE_FORCE_WINDOW_MINUTES * 60 * 1000);

    const query = {
      user: log.user,
      event: { $in: FAILED_LOGIN_EVENT_NAMES },
      ip: { $exists: true, $nin: [null, ''] },
      timestamp: { $gte: windowStart, $lte: log.timestamp },
    };

    const [uniqueIps, totalAttempts] = await Promise.all([
      context.logModel.distinct('ip', query),
      context.logModel.countDocuments(query),
    ]);

    if (uniqueIps.length < DISTRIBUTED_BRUTE_FORCE_MIN_UNIQUE_IPS) return;

    await context.emitAlert({
      ruleId: RULE_ID_DISTRIBUTED_BRUTE_FORCE,
      message: `Distributed brute force suspected for user ${log.user}: ${uniqueIps.length} IPs in ${DISTRIBUTED_BRUTE_FORCE_WINDOW_MINUTES} minutes`,
      severity: 'high',
      ip: log.ip,
      triggeredAt: new Date(),
      context: {
        user: log.user,
        uniqueIps: uniqueIps.length,
        totalAttempts,
        windowMinutes: DISTRIBUTED_BRUTE_FORCE_WINDOW_MINUTES,
        lastEventAt: log.timestamp,
      },
    }, log);
  },
};
