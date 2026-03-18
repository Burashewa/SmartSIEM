import { DetectionRule } from '../../interfaces/detection-rule.interface';
import { RULE_ID_XSS, XSS_EVENT_NAMES } from '../../rules.constants';

export const xssRule: DetectionRule = {
  id: RULE_ID_XSS,
  name: 'Cross-site scripting attempt',
  description: 'Flags logs explicitly labeled as XSS attempts.',
  severity: 'high',
  tags: ['web-attack', 'xss'],
  matches: (log) => XSS_EVENT_NAMES.includes(log.event),
  async evaluate(log, context): Promise<void> {
    await context.emitAlert({
      ruleId: RULE_ID_XSS,
      message: `XSS indicator detected from ${log.ip ?? 'unknown IP'}`,
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
