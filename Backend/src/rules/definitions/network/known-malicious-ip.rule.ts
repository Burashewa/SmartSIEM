import { DetectionRule } from '../../interfaces/detection-rule.interface';
import { RULE_ID_KNOWN_MALICIOUS_IP } from '../../rules.constants';

export const knownMaliciousIpRule: DetectionRule = {
  id: RULE_ID_KNOWN_MALICIOUS_IP,
  name: 'Known malicious / blocklisted IP',
  description:
    'Fires when a log source IP matches the configured blocklist (MALICIOUS_IPS) or demo TEST-NET entries.',
  severity: 'critical',
  tags: ['threat-intel', 'network', 'ip-reputation'],
  matches: (log) => Boolean(log.ip?.trim()),
  async evaluate(log, context): Promise<void> {
    if (!log.ip || !context.isMaliciousIp(log.ip)) return;

    await context.emitAlert(
      {
        ruleId: RULE_ID_KNOWN_MALICIOUS_IP,
        message: `Activity from blocklisted / known-malicious IP ${log.ip}`,
        severity: 'critical',
        ip: log.ip,
        triggeredAt: new Date(),
        context: {
          event: log.event,
          source: log.source,
          endpoint: log.endpoint,
          timestamp: log.timestamp,
          blocklist: 'MALICIOUS_IPS / built-in demo entries',
        },
      },
      log,
    );
    context.logger.warn(`Malicious IP match: ${log.ip}`);
  },
};
