import { Log } from '../../../logs/log.schema';
import {
  collectBodyStrings,
  extractAllRequestBodies,
  urlDecodeForScan,
} from './sqli-body.scan';

export type XssPatternHit = { id: string; label: string };

/** Build text to scan: JSON body fields plus common top-level HTTP-ish fields agents send today. */
export function collectXssHaystackParts(log: Log): string[] {
  const parts: string[] = [];
  if (typeof log.message === 'string' && log.message.trim()) parts.push(log.message);
  if (typeof log.endpoint === 'string' && log.endpoint.trim()) parts.push(log.endpoint);
  if (typeof log.resource === 'string' && log.resource.trim()) parts.push(log.resource);

  const bodies = extractAllRequestBodies(log);
  for (const body of bodies) {
    parts.push(...collectBodyStrings(body));
  }

  const meta = log.metadata && typeof log.metadata === 'object' && !Array.isArray(log.metadata) ? log.metadata : undefined;
  if (meta) {
    for (const v of Object.values(meta)) {
      if (typeof v === 'string' && v.trim()) parts.push(v);
    }
  }

  return parts;
}

/**
 * XSS heuristics on URL-decoded, case-insensitive text.
 * Targets reflected/stored payloads in parameters and bodies typical of SIEM ingestion.
 */
export function matchXssPatterns(haystack: string): XssPatternHit[] {
  const hits: XssPatternHit[] = [];
  const text = urlDecodeForScan(haystack);

  const tests: Array<{ id: string; label: string; test: () => boolean }> = [
    {
      id: 'script_tag',
      label: 'HTML script tag (<script)',
      test: () => /<script\b/i.test(text),
    },
    {
      id: 'javascript_uri',
      label: 'javascript: pseudo-URL',
      test: () => /javascript\s*:/i.test(text),
    },
    {
      id: 'vbscript_uri',
      label: 'vbscript: pseudo-URL',
      test: () => /vbscript\s*:/i.test(text),
    },
    {
      id: 'data_html_uri',
      label: 'data:text/html URI (embedding HTML)',
      test: () => /data\s*:\s*text\/html/i.test(text),
    },
    {
      id: 'event_handler_attr',
      label: 'HTML event handler (onerror/onload/onclick/...)',
      test: () =>
        /\bon(?:error|load|click|dblclick|keypress|keyup|keydown|mousedown|mouseup|mousemove|mouseover|mouseout|focus|blur|change|submit|input|abort|wheel)\s*=/i.test(
          text,
        ),
    },
    {
      id: 'svg_onload',
      label: '<svg with inline event handler',
      test: () => /<svg\b[^>]{0,500}?\bon[a-z]+\s*=/is.test(text),
    },
    {
      id: 'iframe_tag',
      label: 'HTML iframe',
      test: () => /<iframe\b/i.test(text),
    },
    {
      id: 'object_embed',
      label: 'HTML object/embed',
      test: () => /<(?:object|embed)\b/i.test(text),
    },
    {
      id: 'document_sink',
      label: 'document.cookie / document.write',
      test: () => /document\s*\.\s*(?:cookie|write)\b/i.test(text),
    },
    {
      id: 'window_sink',
      label: 'window.location assignment',
      test: () => /window\s*\.\s*location\b/i.test(text),
    },
  ];

  const seen = new Set<string>();
  for (const t of tests) {
    if (!t.test()) continue;
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    hits.push({ id: t.id, label: t.label });
  }

  return hits;
}

export function scanLogForXss(log: Log): { haystack: string; hits: XssPatternHit[] } {
  const parts = collectXssHaystackParts(log);
  const haystack = parts.join('\n');
  if (!haystack.trim()) return { haystack: '', hits: [] };

  const hits = matchXssPatterns(haystack);
  return { haystack, hits };
}
