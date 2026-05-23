import { DetectionRule } from '../../interfaces/detection-rule.interface';
import {
  PATH_TRAVERSAL_LFI_EVENT_NAMES,
  RULE_ID_PATH_TRAVERSAL_LFI,
} from '../../rules.constants';
import { scanLogForPathTraversal } from './path-traversal-lfi.scan';

function isExplicitPathTraversalEvent(log: { event?: string }): boolean {
  return Boolean(log.event && PATH_TRAVERSAL_LFI_EVENT_NAMES.includes(log.event));
}

export const pathTraversalLfiRule: DetectionRule = {
  id: RULE_ID_PATH_TRAVERSAL_LFI,
  name: 'Path traversal / LFI attempt',
  description:
    'Deterministic detection of path traversal and local file inclusion in raw.rawEvent.context pageUrl, url, pagePath, path, apiRequestUrl, and body string fields (including URL-encoded and wrapper-based LFI payloads).',
  severity: 'high',
  tags: ['web-attack', 'path-traversal', 'lfi'],
  matches: (log) =>
    isExplicitPathTraversalEvent(log) || scanLogForPathTraversal(log).hits.length > 0,
  async evaluate(log, context): Promise<void> {
    const explicit = isExplicitPathTraversalEvent(log);
    const { fields, hits } = scanLogForPathTraversal(log);

    if (!explicit && hits.length === 0) return;

    const severity = explicit ? 'critical' : 'high';
    const patternSummary = [...new Set(hits.map((h) => h.label))].join(', ');
    const fieldSummary = [...new Set(hits.map((h) => h.source))].join(', ');
    const message = explicit
      ? `Path traversal / LFI indicator from ${log.ip ?? 'unknown IP'} (labeled event: ${log.event})`
      : `Possible path traversal / LFI in ${fieldSummary} (${patternSummary}) from ${log.ip ?? 'unknown IP'}`;

    await context.emitAlert(
      {
        ruleId: RULE_ID_PATH_TRAVERSAL_LFI,
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
            scannedFieldCount: fields.length,
            scannedFields: fields.map((f) => ({ source: f.source, value: f.value })),
            matchedPatterns: hits,
          },
        },
      },
      log,
    );
  },
};
