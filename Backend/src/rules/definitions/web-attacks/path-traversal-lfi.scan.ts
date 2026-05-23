import { Log } from '../../../logs/log.schema';
import { buildScanVariants, matchesAnyVariant } from './payload-normalize';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export type PathTraversalFieldSource =
  | 'raw.rawEvent.context.pageUrl'
  | 'raw.rawEvent.context.url'
  | 'raw.rawEvent.context.pagePath'
  | 'raw.rawEvent.context.path'
  | 'raw.rawEvent.context.apiRequestUrl'
  | 'raw.rawEvent.context.body'
  | 'payload.rawEvent.context.pageUrl'
  | 'payload.rawEvent.context.url'
  | 'payload.rawEvent.context.pagePath'
  | 'payload.rawEvent.context.path'
  | 'payload.rawEvent.context.apiRequestUrl'
  | 'payload.rawEvent.context.body';

export type ExtractedPathField = {
  source: PathTraversalFieldSource;
  value: string;
};

export type PathTraversalPatternHit = {
  id: string;
  label: string;
  source: PathTraversalFieldSource;
  snippet: string;
};

type PathPatternDef = {
  id: string;
  label: string;
  test: (variants: string[]) => boolean;
};

const PATH_TRAVERSAL_PATTERNS: PathPatternDef[] = [
  {
    id: 'dot_dot_slash',
    label: 'Directory traversal (../ or ..\\)',
    test: (v) =>
      matchesAnyVariant(
        v,
        (t) =>
          /\.\.(?:\/|\\)/.test(t) ||
          /(?:^|\/|\\)\.\.(?:\/|\\|$)/.test(t),
      ),
  },
  {
    id: 'encoded_dot_dot',
    label: 'Encoded traversal (%2e%2e / ..%2f)',
    test: (v) =>
      matchesAnyVariant(
        v,
        (t) =>
          /%2e%2e(?:%2f|%5c|\/|\\)/i.test(t) ||
          /\.\.%2f/i.test(t) ||
          /%252e%252e/i.test(t),
      ),
  },
  {
    id: 'double_dot_bypass',
    label: 'Traversal bypass (....// / ..;/ )',
    test: (v) =>
      matchesAnyVariant(v, (t) => /\.\.{2,}\//.test(t) || /\.\.;\//.test(t) || /\.\.\/\.\//.test(t)),
  },
  {
    id: 'unix_sensitive_file',
    label: 'Unix sensitive path (/etc/passwd, /proc/self, …)',
    test: (v) =>
      matchesAnyVariant(
        v,
        (t) =>
          /\/etc\/(?:passwd|shadow|hosts|group)/i.test(t) ||
          /\/proc\/(?:self|version)/i.test(t) ||
          /\/var\/log\//i.test(t),
      ),
  },
  {
    id: 'windows_sensitive_path',
    label: 'Windows sensitive path (win.ini, system32, …)',
    test: (v) =>
      matchesAnyVariant(
        v,
        (t) =>
          /(?:c:)?[\\/]+windows[\\/]/i.test(t) ||
          /win\.ini/i.test(t) ||
          /boot\.ini/i.test(t) ||
          /system32/i.test(t),
      ),
  },
  {
    id: 'app_secret_file',
    label: 'Application secret file (.env, web.config, id_rsa, …)',
    test: (v) =>
      matchesAnyVariant(
        v,
        (t) =>
          /(?:^|\/|\\)\.env(?:\b|$|[?&#])/i.test(t) ||
          /web\.config/i.test(t) ||
          /id_rsa/i.test(t) ||
          /authorized_keys/i.test(t) ||
          /wp-config\.php/i.test(t) ||
          /config\.php/i.test(t),
      ),
  },
  {
    id: 'php_stream_wrapper',
    label: 'PHP stream wrapper (php://filter, php://input)',
    test: (v) => matchesAnyVariant(v, (t) => /php:\/\/(?:filter|input|stdin|memory|temp)/i.test(t)),
  },
  {
    id: 'dangerous_uri_scheme',
    label: 'Dangerous URI scheme (file://, expect://, zip://)',
    test: (v) =>
      matchesAnyVariant(
        v,
        (t) => /(?:file|expect|zip|phar|data|glob):\/\//i.test(t),
      ),
  },
  {
    id: 'null_byte_truncation',
    label: 'Null-byte path truncation (%00)',
    test: (v) => matchesAnyVariant(v, (t) => /%00/i.test(t) || /\x00/.test(t)),
  },
];

/** Recursively collect string leaves from a JSON body object. */
export function collectBodyStringFields(
  body: Record<string, unknown>,
  sourcePrefix: PathTraversalFieldSource,
): ExtractedPathField[] {
  const out: ExtractedPathField[] = [];

  const walk = (obj: Record<string, unknown>) => {
    for (const value of Object.values(obj)) {
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed) out.push({ source: sourcePrefix, value: trimmed });
      } else if (isRecord(value)) {
        walk(value);
      } else if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string' && item.trim()) {
            out.push({ source: sourcePrefix, value: item.trim() });
          } else if (isRecord(item)) {
            walk(item);
          }
        }
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        out.push({ source: sourcePrefix, value: String(value) });
      }
    }
  };

  walk(body);
  return out;
}

function extractFromContext(
  ctx: Record<string, unknown>,
  sourceRoot: 'raw.rawEvent.context' | 'payload.rawEvent.context',
): ExtractedPathField[] {
  const fields: ExtractedPathField[] = [];

  const add = (key: string, suffix: string) => {
    const value = readString(ctx[key]);
    if (value) {
      fields.push({ source: `${sourceRoot}.${suffix}` as PathTraversalFieldSource, value });
    }
  };

  add('pageUrl', 'pageUrl');
  add('url', 'url');
  add('pagePath', 'pagePath');
  add('path', 'path');
  add('apiRequestUrl', 'apiRequestUrl');

  const body = isRecord(ctx.body) ? ctx.body : undefined;
  if (body) {
    fields.push(
      ...collectBodyStringFields(
        body,
        `${sourceRoot}.body` as PathTraversalFieldSource,
      ),
    );
  }

  return fields;
}

function extractFromRawEventContainer(
  container: Record<string, unknown> | undefined,
  sourceRoot: 'raw' | 'payload',
): ExtractedPathField[] {
  if (!container) return [];
  const rawEvent = isRecord(container.rawEvent) ? container.rawEvent : undefined;
  if (!rawEvent) return [];
  const ctx = isRecord(rawEvent.context) ? rawEvent.context : undefined;
  if (!ctx) return [];
  return extractFromContext(ctx, `${sourceRoot}.rawEvent.context` as 'raw.rawEvent.context' | 'payload.rawEvent.context');
}

/**
 * Extract path-related targets per log schema (pageUrl, path, apiRequestUrl, body strings).
 */
export function extractPathTraversalTargets(log: Log): ExtractedPathField[] {
  const fields: ExtractedPathField[] = [];
  const seen = new Set<string>();

  const push = (item: ExtractedPathField) => {
    const key = `${item.source}\0${item.value}`;
    if (seen.has(key)) return;
    seen.add(key);
    fields.push(item);
  };

  const raw = isRecord(log.raw) ? log.raw : undefined;
  const payload = isRecord(log.payload) ? log.payload : undefined;

  for (const item of extractFromRawEventContainer(raw, 'raw')) push(item);
  for (const item of extractFromRawEventContainer(payload, 'payload')) push(item);

  return fields;
}

function snippet(value: string, maxLen = 120): string {
  const oneLine = value.replace(/\s+/g, ' ');
  return oneLine.length <= maxLen ? oneLine : `${oneLine.slice(0, maxLen)}…`;
}

export function matchPathTraversalInValue(
  value: string,
  source: PathTraversalFieldSource,
): PathTraversalPatternHit[] {
  const variants = buildScanVariants(value);
  const hits: PathTraversalPatternHit[] = [];
  const seen = new Set<string>();

  for (const pattern of PATH_TRAVERSAL_PATTERNS) {
    const key = `${source}:${pattern.id}`;
    if (seen.has(key)) continue;
    if (!pattern.test(variants)) continue;
    seen.add(key);
    hits.push({
      id: pattern.id,
      label: pattern.label,
      source,
      snippet: snippet(value),
    });
  }

  return hits;
}

export function scanLogForPathTraversal(log: Log): {
  fields: ExtractedPathField[];
  hits: PathTraversalPatternHit[];
} {
  const fields = extractPathTraversalTargets(log);
  const hits: PathTraversalPatternHit[] = [];
  const seenHit = new Set<string>();

  for (const field of fields) {
    for (const hit of matchPathTraversalInValue(field.value, field.source)) {
      const key = `${hit.id}:${hit.source}:${hit.snippet}`;
      if (seenHit.has(key)) continue;
      seenHit.add(key);
      hits.push(hit);
    }
  }

  return { fields, hits };
}
