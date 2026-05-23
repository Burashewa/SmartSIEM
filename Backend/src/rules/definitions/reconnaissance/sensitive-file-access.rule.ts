import { DetectionRule } from '../../interfaces/detection-rule.interface';
import { RULE_ID_SENSITIVE_FILE_ACCESS, SENSITIVE_FILE_ACCESS_EVENT_NAMES } from '../../rules.constants';

export const sensitiveFileAccessRule: DetectionRule = {
  id: RULE_ID_SENSITIVE_FILE_ACCESS,
  name: 'Sensitive file access',
  description: 'Flags access attempts to sensitive files or paths.',
  severity: 'high',
  tags: ['reconnaissance', 'sensitive-file'],
  matches: (log) => SENSITIVE_FILE_ACCESS_EVENT_NAMES.includes(log.event),
  async evaluate(log, context): Promise<void> {
    await context.emitAlert({
      ruleId: RULE_ID_SENSITIVE_FILE_ACCESS,
      message: `Sensitive file access indicator detected from ${log.ip ?? 'unknown IP'}`,
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
