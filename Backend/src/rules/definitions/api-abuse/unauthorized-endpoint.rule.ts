import { DetectionRule } from '../../interfaces/detection-rule.interface';
import { RULE_ID_UNAUTHORIZED_ENDPOINT, UNAUTHORIZED_ENDPOINT_EVENT_NAMES } from '../../rules.constants';

export const unauthorizedEndpointRule: DetectionRule = {
  id: RULE_ID_UNAUTHORIZED_ENDPOINT,
  name: 'Unauthorized endpoint access',
  description: 'Flags access attempts to endpoints without proper authorization.',
  severity: 'high',
  tags: ['api-abuse', 'authorization'],
  matches: (log) => UNAUTHORIZED_ENDPOINT_EVENT_NAMES.includes(log.event),
  async evaluate(log, context): Promise<void> {
    await context.emitAlert({
      ruleId: RULE_ID_UNAUTHORIZED_ENDPOINT,
      message: `Unauthorized endpoint access detected from ${log.ip ?? 'unknown IP'}`,
      severity: 'high',
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
