import { Log } from '../../../logs/log.schema';
import {
  collectBodyStrings,
  extractAllRequestBodies,
} from './sqli-body.scan';
import { buildScanVariants, matchesAnyVariant } from './payload-normalize';

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

  const meta =
    log.metadata && typeof log.metadata === 'object' && !Array.isArray(log.metadata)
      ? log.metadata
      : undefined;
  if (meta) {
    for (const v of Object.values(meta)) {
      if (typeof v === 'string' && v.trim()) parts.push(v);
    }
  }

  return parts;
}

type XssPatternDef = { id: string; label: string; test: (variants: string[]) => boolean };

const XSS_PATTERNS: XssPatternDef[] = [
  {
    id: 'script_tag',
    label: 'HTML script tag (<script)',
    test: (v) => matchesAnyVariant(v, (t) => /<script[\s/>]/i.test(t) || /<\/script>/i.test(t)),
  },
  {
    id: 'encoded_script',
    label: 'Encoded script tag (entities/escapes)',
    test: (v) =>
      matchesAnyVariant(
        v,
        (t) =>
          /&#x0*(?:3c|74|54);?\s*script/i.test(t) ||
          /&#0*60;?\s*script/i.test(t) ||
          /\\u0*3c.*script/i.test(t) ||
          /\\x3c\s*script/i.test(t),
      ),
  },
  {
    id: 'javascript_uri',
    label: 'javascript: pseudo-URL',
    test: (v) => matchesAnyVariant(v, (t) => /javascript\s*:/i.test(t)),
  },
  {
    id: 'vbscript_uri',
    label: 'vbscript: pseudo-URL',
    test: (v) => matchesAnyVariant(v, (t) => /vbscript\s*:/i.test(t)),
  },
  {
    id: 'data_html_uri',
    label: 'data:text/html or data:image/svg+xml',
    test: (v) =>
      matchesAnyVariant(
        v,
        (t) => /data\s*:\s*text\/html/i.test(t) || /data\s*:\s*image\/svg\+xml/i.test(t),
      ),
  },
  {
    id: 'event_handler_attr',
    label: 'HTML event handler attribute',
    test: (v) =>
      matchesAnyVariant(
        v,
        (t) =>
          /\bon[a-z][\w-]*\s*=/i.test(t) ||
          /\bon(?:error|load|click|dblclick|mouse\w+|key\w+|focus|blur|change|submit|input|paste|copy|cut|drag|drop|wheel|pointer\w+|touch\w+|animation\w+|transition\w+|before|after|auxclick|toggle)\s*=/i.test(
            t,
          ),
      ),
  },
  {
    id: 'svg_tag_handler',
    label: '<svg with inline handler or script',
    test: (v) =>
      matchesAnyVariant(
        v,
        (t) =>
          /<svg\b/i.test(t) &&
          (/<script/i.test(t) || /\bon[a-z]+\s*=/i.test(t) || /href\s*=\s*['"]?\s*javascript/i.test(t)),
      ),
  },
  {
    id: 'img_onerror',
    label: '<img> with handler or javascript src',
    test: (v) =>
      matchesAnyVariant(
        v,
        (t) =>
          /<img\b[^>]{0,800}?(?:\bon\w+\s*=|src\s*=\s*['"]?\s*javascript:)/is.test(t),
      ),
  },
  {
    id: 'iframe_tag',
    label: 'HTML iframe',
    test: (v) => matchesAnyVariant(v, (t) => /<iframe\b/i.test(t)),
  },
  {
    id: 'object_embed',
    label: 'HTML object/embed/applet',
    test: (v) => matchesAnyVariant(v, (t) => /<(?:object|embed|applet)\b/i.test(t)),
  },
  {
    id: 'meta_refresh',
    label: 'Meta refresh / redirect',
    test: (v) =>
      matchesAnyVariant(
        v,
        (t) =>
          /<meta\b[^>]{0,400}?(?:http-equiv\s*=\s*['"]?refresh|content\s*=\s*['"][^'"]*url\s*=)/is.test(
            t,
          ),
      ),
  },
  {
    id: 'link_import',
    label: 'Link import / stylesheet javascript',
    test: (v) =>
      matchesAnyVariant(
        v,
        (t) =>
          /<link\b[^>]{0,400}?(?:rel\s*=\s*['"]?import|href\s*=\s*['"]?\s*javascript:)/is.test(t),
      ),
  },
  {
    id: 'base_href',
    label: '<base> tag hijack',
    test: (v) => matchesAnyVariant(v, (t) => /<base\b[^>]{0,200}?href\s*=/i.test(t)),
  },
  {
    id: 'formaction',
    label: 'formaction / formaction javascript',
    test: (v) =>
      matchesAnyVariant(v, (t) => /\bformaction\s*=\s*['"]?\s*javascript:/i.test(t)),
  },
  {
    id: 'srcdoc',
    label: 'srcdoc iframe payload',
    test: (v) => matchesAnyVariant(v, (t) => /\bsrcdoc\s*=/i.test(t)),
  },
  {
    id: 'style_injection',
    label: 'Style @import / expression / javascript',
    test: (v) =>
      matchesAnyVariant(
        v,
        (t) =>
          /<style\b/i.test(t) &&
          (/@import/i.test(t) || /expression\s*\(/i.test(t) || /javascript:/i.test(t)),
      ),
  },
  {
    id: 'document_sink',
    label: 'document.cookie / document.write / document.domain',
    test: (v) =>
      matchesAnyVariant(
        v,
        (t) => /document\s*\.\s*(?:cookie|write|domain|location)\b/i.test(t),
      ),
  },
  {
    id: 'window_sink',
    label: 'window.location / window.open',
    test: (v) =>
      matchesAnyVariant(
        v,
        (t) =>
          /window\s*\.\s*(?:location|open)\b/i.test(t) || /location\s*\.\s*(?:href|assign|replace)\s*=/i.test(t),
      ),
  },
  {
    id: 'js_exec_sink',
    label: 'eval / Function / setTimeout string exec',
    test: (v) =>
      matchesAnyVariant(
        v,
        (t) =>
          /\beval\s*\(/i.test(t) ||
          /\bnew\s+Function\s*\(/i.test(t) ||
          /\bset(?:Timeout|Interval)\s*\(\s*['"]/i.test(t),
      ),
  },
  {
    id: 'fromcharcode',
    label: 'String.fromCharCode obfuscation',
    test: (v) =>
      matchesAnyVariant(v, (t) => /String\s*\.\s*fromCharCode\s*\(/i.test(t)),
  },
  {
    id: 'dialog_sink',
    label: 'alert/confirm/prompt dialog',
    test: (v) =>
      matchesAnyVariant(v, (t) => /\b(?:alert|confirm|prompt)\s*\(\s*['"`]/i.test(t)),
  },
  {
    id: 'html5_vector',
    label: 'HTML5 vector (details/marquee/video/audio)',
    test: (v) =>
      matchesAnyVariant(
        v,
        (t) =>
          /<(?:details|marquee|video|audio|body|input|button|textarea|select)\b[^>]{0,500}?\bon\w+\s*=/is.test(
            t,
          ),
      ),
  },
  {
    id: 'template_injection',
    label: 'Template/literal injection (${, <%=)',
    test: (v) =>
      matchesAnyVariant(
        v,
        (t) =>
          /\$\{[^}]{0,120}\}/.test(t) ||
          /<%=\s*[^%]{0,120}%>/.test(t) ||
          /\{\{[^}]{0,120}\}\}/.test(t),
      ),
  },
];

/**
 * XSS heuristics with multi-pass decoding for obfuscated payloads.
 */
export function matchXssPatterns(haystack: string): XssPatternHit[] {
  const variants = buildScanVariants(haystack);
  const hits: XssPatternHit[] = [];
  const seen = new Set<string>();

  for (const pattern of XSS_PATTERNS) {
    if (seen.has(pattern.id)) continue;
    if (!pattern.test(variants)) continue;
    seen.add(pattern.id);
    hits.push({ id: pattern.id, label: pattern.label });
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
