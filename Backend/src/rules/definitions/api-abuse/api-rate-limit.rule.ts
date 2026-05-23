import { DetectionRule } from '../../interfaces/detection-rule.interface';
import { API_RATE_LIMIT_EVENT_NAMES, RULE_ID_API_RATE_LIMIT } from '../../rules.constants';

export const apiRateLimitRule: DetectionRule = {
  id: RULE_ID_API_RATE_LIMIT,
  name: 'API rate limit exceeded',
  description: 'Flags events that indicate API rate limiting or throttling.',
  severity: 'medium',
  tags: ['api-abuse', 'rate-limit'],
  matches: (log) => API_RATE_LIMIT_EVENT_NAMES.includes(log.event),
  async evaluate(log, context): Promise<void> {
    await context.emitAlert({
      ruleId: RULE_ID_API_RATE_LIMIT,
      message: `API rate limit exceeded by ${log.ip ?? 'unknown IP'}`,
      severity: 'medium',
      ip: log.ip,
      triggeredAt: new Date(),
      context: {
        event: log.event,
        source: log.source,
        timestamp: log.timestamp,
      },
    }, log);
  },
};
