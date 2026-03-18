import { DetectionRule } from '../../interfaces/detection-rule.interface';
import { COMMAND_INJECTION_EVENT_NAMES, RULE_ID_COMMAND_INJECTION } from '../../rules.constants';

export const commandInjectionRule: DetectionRule = {
  id: RULE_ID_COMMAND_INJECTION,
  name: 'Command injection attempt',
  description: 'Flags logs explicitly labeled as command injection attempts.',
  severity: 'critical',
  tags: ['web-attack', 'command-injection'],
  matches: (log) => COMMAND_INJECTION_EVENT_NAMES.includes(log.event),
  async evaluate(log, context): Promise<void> {
    await context.emitAlert({
      ruleId: RULE_ID_COMMAND_INJECTION,
      message: `Command injection indicator detected from ${log.ip ?? 'unknown IP'}`,
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
