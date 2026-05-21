import { DetectionRule } from '../../interfaces/detection-rule.interface';
import { RULE_ID_SQL_INJECTION, SQL_INJECTION_EVENT_NAMES } from '../../rules.constants';
import { scanLogBodyForSqli } from './sqli-body.scan';

function isExplicitSqliEvent(log: { event?: string }): boolean {
  return Boolean(log.event && SQL_INJECTION_EVENT_NAMES.includes(log.event));
}

export const sqlInjectionRule: DetectionRule = {
  id: RULE_ID_SQL_INJECTION,
  name: 'SQL injection attempt',
  description:
    'Flags WAF/labeled SQL injection events, and inspects request bodies, URLs, and messages for SQLi patterns including obfuscated UNION, stacked queries, time/error-based probes, and comment/encoding bypasses (multi-pass URL/HTML/escape decoding).',
  severity: 'critical',
  tags: ['web-attack', 'sql-injection'],
  matches: (log) => isExplicitSqliEvent(log) || scanLogBodyForSqli(log).hits.length > 0,
  async evaluate(log, context): Promise<void> {
    const explicit = isExplicitSqliEvent(log);
    const { haystack, hits } = scanLogBodyForSqli(log);

    if (!explicit && hits.length === 0) return;

    const severity = explicit ? 'critical' : 'high';
    const patternSummary = hits.map((h) => h.label).join(', ');
    const message = explicit
      ? `SQL injection indicator detected from ${log.ip ?? 'unknown IP'} (labeled event: ${log.event})`
      : `Possible SQL injection in request body (${patternSummary}) from ${log.ip ?? 'unknown IP'}`;

    await context.emitAlert(
      {
        ruleId: RULE_ID_SQL_INJECTION,
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
            bodyScanned: Boolean(haystack),
            matchedPatterns: hits,
          },
        },
      },
      log,
    );
  },
};
