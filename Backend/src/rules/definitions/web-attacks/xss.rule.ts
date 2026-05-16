import { DetectionRule } from '../../interfaces/detection-rule.interface';
import { RULE_ID_XSS, XSS_EVENT_NAMES } from '../../rules.constants';
import { scanLogForXss } from './xss-body.scan';

function isExplicitXssEvent(log: { event?: string }): boolean {
  return Boolean(log.event && XSS_EVENT_NAMES.includes(log.event));
}

export const xssRule: DetectionRule = {
  id: RULE_ID_XSS,
  name: 'Cross-site scripting attempt',
  description:
    'Flags WAF/labeled XSS events, and inspects message, endpoint, request JSON bodies, and metadata strings for common XSS patterns (after URL decoding).',
  severity: 'high',
  tags: ['web-attack', 'xss'],
  matches: (log) => isExplicitXssEvent(log) || scanLogForXss(log).hits.length > 0,
  async evaluate(log, context): Promise<void> {
    const explicit = isExplicitXssEvent(log);
    const { haystack, hits } = scanLogForXss(log);

    if (!explicit && hits.length === 0) return;

    const severity = explicit ? 'critical' : 'high';
    const patternSummary = hits.map((h) => h.label).join(', ');
    const message = explicit
      ? `XSS indicator from ${log.ip ?? 'unknown IP'} (labeled event: ${log.event})`
      : `Possible XSS in log content (${patternSummary}) from ${log.ip ?? 'unknown IP'}`;

    await context.emitAlert(
      {
        ruleId: RULE_ID_XSS,
        message,
        severity,
        ip: log.ip,
        triggeredAt: new Date(),
        context: {
          event: log.event,
          source: log.source,
          timestamp: log.timestamp,
          detection: {
            explicitLabel: explicit,
            contentScanned: Boolean(haystack.trim()),
            matchedPatterns: hits,
          },
        },
      },
      log,
    );
  },
};
