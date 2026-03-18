import { DetectionRule } from '../../interfaces/detection-rule.interface';
import { DIRECTORY_SCAN_EVENT_NAMES, RULE_ID_DIRECTORY_SCAN } from '../../rules.constants';

export const directoryScanRule: DetectionRule = {
  id: RULE_ID_DIRECTORY_SCAN,
  name: 'Directory scan activity',
  description: 'Flags events indicating directory or path enumeration.',
  severity: 'medium',
  tags: ['reconnaissance', 'directory-scan'],
  matches: (log) => DIRECTORY_SCAN_EVENT_NAMES.includes(log.event),
  async evaluate(log, context): Promise<void> {
    await context.emitAlert({
      ruleId: RULE_ID_DIRECTORY_SCAN,
      message: `Directory scan indicator detected from ${log.ip ?? 'unknown IP'}`,
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
