import { DetectionRule } from '../../interfaces/detection-rule.interface';
import { RULE_ID_SQL_INJECTION, SQL_INJECTION_EVENT_NAMES } from '../../rules.constants';

export const sqlInjectionRule: DetectionRule = {
  id: RULE_ID_SQL_INJECTION,
  name: 'SQL injection attempt',
  description: 'Flags logs explicitly labeled as SQL injection attempts.',
  severity: 'critical',
  tags: ['web-attack', 'sql-injection'],
  matches: (log) => SQL_INJECTION_EVENT_NAMES.includes(log.event),
  async evaluate(log, context): Promise<void> {
    await context.emitAlert({
      ruleId: RULE_ID_SQL_INJECTION,
      message: `SQL injection indicator detected from ${log.ip ?? 'unknown IP'}`,
      severity: 'critical',
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
