import { Log } from '../../../logs/log.schema';
import { buildScanVariants, matchesAnyVariant, urlDecodeForScan } from './payload-normalize';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function pushBodyIfPresent(sink: Record<string, unknown>[], value: unknown): void {
  if (isRecord(value)) sink.push(value);
}

function collectBodiesFromEvents(
  bodies: Record<string, unknown>[],
  container: Record<string, unknown> | undefined,
): void {
  if (!container) return;
  const events = Array.isArray(container.events) ? container.events : [];
  for (const ev of events) {
    if (!isRecord(ev)) continue;
    const ctx = isRecord(ev.context) ? ev.context : undefined;
    pushBodyIfPresent(bodies, ctx?.body);
  }
}

/** Collect every `body` object from frontend / agent batch shapes. */
export function extractAllRequestBodies(log: Log): Record<string, unknown>[] {
  const bodies: Record<string, unknown>[] = [];
  const raw = isRecord(log.raw) ? log.raw : undefined;
  const payload = isRecord(log.payload) ? log.payload : undefined;

  if (raw) {
    pushBodyIfPresent(bodies, raw.body);
    collectBodiesFromEvents(bodies, raw);
    if (isRecord(raw.rawEvent)) {
      const ctx = isRecord(raw.rawEvent.context) ? raw.rawEvent.context : undefined;
      pushBodyIfPresent(bodies, ctx?.body);
    }
  }

  if (payload) {
    pushBodyIfPresent(bodies, payload.body);
    collectBodiesFromEvents(bodies, payload);
    if (isRecord(payload.rawEvent)) {
      const ctx = isRecord(payload.rawEvent.context) ? payload.rawEvent.context : undefined;
      pushBodyIfPresent(bodies, ctx?.body);
    }
  }

  return bodies;
}

/** Returns the first body found (legacy helper). */
export function extractRequestBody(log: Log): Record<string, unknown> | undefined {
  const all = extractAllRequestBodies(log);
  return all[0];
}

/** Flatten primitive string-ish fields from a JSON body for inspection. */
export function collectBodyStrings(body: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const value of Object.values(body)) {
    if (typeof value === 'string') out.push(value);
    else if (typeof value === 'number' || typeof value === 'boolean') out.push(String(value));
  }
  return out;
}

/** Re-export for XSS module compatibility. */
export { urlDecodeForScan } from './payload-normalize';

export type SqliPatternHit = { id: string; label: string };

/** Build text to scan: bodies plus URL/message fields where SQLi often appears. */
export function collectSqliHaystackParts(log: Log): string[] {
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

type SqliPatternDef = { id: string; label: string; test: (variants: string[]) => boolean };

const SQLI_PATTERNS: SqliPatternDef[] = [
  {
    id: 'or_true',
    label: 'OR numeric tautology (OR 1=1)',
    test: (v) =>
      matchesAnyVariant(
        v,
        (t) =>
          /['"]?\s*or\s+['"]?\s*\d+\s*=\s*['"]?\s*\d+/i.test(t) ||
          /['"]?\s*or\s+['"]?\s*true\b/i.test(t),
      ),
  },
  {
    id: 'and_true',
    label: 'AND numeric tautology (AND 1=1)',
    test: (v) =>
      matchesAnyVariant(v, (t) => /['"]?\s*and\s+['"]?\s*\d+\s*=\s*['"]?\s*\d+/i.test(t)),
  },
  {
    id: 'or_string_eq',
    label: "String tautology (OR 'a'='a')",
    test: (v) =>
      matchesAnyVariant(
        v,
        (t) => /\bor\s+['"][^'"]*['"]\s*=\s*['"][^'"]*['"]/i.test(t),
      ),
  },
  {
    id: 'quote_or',
    label: "Quote-terminated OR (' OR 1)",
    test: (v) =>
      matchesAnyVariant(v, (t) => /['"]\s*or\s+['"]?\d/i.test(t) || /['"]\s*;\s*or\b/i.test(t)),
  },
  {
    id: 'admin_comment',
    label: "Credential bypass (admin'--)",
    test: (v) =>
      matchesAnyVariant(
        v,
        (t) => /\badmin\s*['"]\s*--/i.test(t) || /['"]\s*or\s*['"][^'"]*['"]\s*--/i.test(t),
      ),
  },
  {
    id: 'union_select',
    label: 'UNION SELECT',
    test: (v) => matchesAnyVariant(v, (t) => /\bunion\s+(?:all\s+)?select\b/i.test(t)),
  },
  {
    id: 'obfuscated_union',
    label: 'Obfuscated UNION SELECT (comments/spacing)',
    test: (v) =>
      matchesAnyVariant(v, (t) => /\bun\s*ion\s+(?:all\s+)?se\s*lect\b/i.test(t)),
  },
  {
    id: 'select_from',
    label: 'SELECT ... FROM',
    test: (v) =>
      matchesAnyVariant(
        v,
        (t) =>
          /\bselect\s+(?:\*\s+|[\w@'"`,.\s]+\s+)from\b/i.test(t) ||
          /\bselect\s+\*\s+from\b/i.test(t),
      ),
  },
  {
    id: 'stacked_query',
    label: 'Stacked query (; SELECT/DROP/...)',
    test: (v) =>
      matchesAnyVariant(
        v,
        (t) =>
          /;\s*(?:select|insert|update|delete|drop|create|alter|truncate|exec|execute|declare)\b/i.test(
            t,
          ),
      ),
  },
  {
    id: 'drop_table',
    label: 'DROP TABLE/DATABASE',
    test: (v) =>
      matchesAnyVariant(v, (t) => /\bdrop\s+(?:table|database|schema)\b/i.test(t)),
  },
  {
    id: 'insert_into',
    label: 'INSERT INTO',
    test: (v) => matchesAnyVariant(v, (t) => /\binsert\s+into\b/i.test(t)),
  },
  {
    id: 'update_set',
    label: 'UPDATE ... SET',
    test: (v) => matchesAnyVariant(v, (t) => /\bupdate\s+[\w.]+\s+set\b/i.test(t)),
  },
  {
    id: 'delete_from',
    label: 'DELETE FROM',
    test: (v) => matchesAnyVariant(v, (t) => /\bdelete\s+from\b/i.test(t)),
  },
  {
    id: 'information_schema',
    label: 'information_schema probe',
    test: (v) =>
      matchesAnyVariant(
        v,
        (t) =>
          /\binformation_schema\b/i.test(t) ||
          /\bmysql\.(?:user|db)\b/i.test(t) ||
          /\bsys\.(?:tables|databases)\b/i.test(t),
      ),
  },
  {
    id: 'sqlite_master',
    label: 'sqlite_master probe',
    test: (v) => matchesAnyVariant(v, (t) => /\bsqlite_master\b/i.test(t)),
  },
  {
    id: 'pg_catalog',
    label: 'PostgreSQL pg_catalog/pg_sleep',
    test: (v) =>
      matchesAnyVariant(
        v,
        (t) => /\bpg_(?:catalog|sleep|read_file)\b/i.test(t) || /\bpg_sleep\s*\(/i.test(t),
      ),
  },
  {
    id: 'time_based',
    label: 'Time-based blind (sleep/benchmark/waitfor)',
    test: (v) =>
      matchesAnyVariant(
        v,
        (t) =>
          /\b(?:sleep|benchmark)\s*\(\s*\d/i.test(t) ||
          /\bwaitfor\s+delay\s+['"]/i.test(t) ||
          /\bpg_sleep\s*\(/i.test(t),
      ),
  },
  {
    id: 'mssql_exec',
    label: 'MSSQL EXEC/xp_cmdshell',
    test: (v) =>
      matchesAnyVariant(
        v,
        (t) =>
          /\bxp_cmdshell\b/i.test(t) ||
          /\b(?:exec|execute)\s+(?:\(|@|sp_)/i.test(t) ||
          /\bopenrowset\b/i.test(t),
      ),
  },
  {
    id: 'error_based',
    label: 'Error-based (extractvalue/updatexml/exp)',
    test: (v) =>
      matchesAnyVariant(
        v,
        (t) =>
          /\b(?:extractvalue|updatexml|exp|geometrycollection)\s*\(/i.test(t) ||
          /\band\s+\(\s*select\b/i.test(t),
      ),
  },
  {
    id: 'file_io',
    label: 'File read/write (LOAD_FILE/INTO OUTFILE)',
    test: (v) =>
      matchesAnyVariant(
        v,
        (t) =>
          /\bload_file\s*\(/i.test(t) ||
          /\binto\s+(?:outfile|dumpfile)\b/i.test(t),
      ),
  },
  {
    id: 'char_obfuscation',
    label: 'CHAR/CONCAT/hex obfuscation',
    test: (v) =>
      matchesAnyVariant(
        v,
        (t) =>
          /\b(?:char|chr|concat|concat_ws)\s*\(/i.test(t) ||
          /\b0x[0-9a-f]{6,}\b/i.test(t),
      ),
  },
  {
    id: 'cast_convert',
    label: 'CAST/CONVERT',
    test: (v) => matchesAnyVariant(v, (t) => /\b(?:cast|convert)\s*\(/i.test(t)),
  },
  {
    id: 'case_when',
    label: 'CASE WHEN blind',
    test: (v) => matchesAnyVariant(v, (t) => /\bcase\s+when\b/i.test(t)),
  },
  {
    id: 'order_group_having',
    label: 'ORDER/GROUP/HAVING injection',
    test: (v) =>
      matchesAnyVariant(
        v,
        (t) =>
          /\border\s+by\s+\d+\s*(?:--|#|\/\*|$)/i.test(t) ||
          /\bgroup\s+by\s+\d+/i.test(t) ||
          /\bhaving\s+\d+\s*=\s*\d+/i.test(t),
      ),
  },
  {
    id: 'from_dual',
    label: 'FROM dual (Oracle)',
    test: (v) => matchesAnyVariant(v, (t) => /\bfrom\s+dual\b/i.test(t)),
  },
  {
    id: 'line_comment',
    label: 'SQL line comment (--)',
    test: (v) =>
      matchesAnyVariant(v, (t) => /(?:^|[\s;,()])--(?:\s|$|[\r\n])/m.test(t)),
  },
  {
    id: 'hash_comment',
    label: 'SQL hash comment (#)',
    test: (v) =>
      matchesAnyVariant(v, (t) => /['"]\s*#\s*$/m.test(t) || /['"]\s*#\s+/i.test(t)),
  },
  {
    id: 'block_comment',
    label: 'SQL block comment (/* */)',
    test: (v) => matchesAnyVariant(v, (t) => /\/\*[\s\S]*?\*\//.test(t)),
  },
];

/**
 * SQLi heuristics with multi-pass decoding and obfuscation-aware patterns.
 */
export function matchSqliPatterns(haystack: string): SqliPatternHit[] {
  const variants = buildScanVariants(haystack);
  const hits: SqliPatternHit[] = [];
  const seen = new Set<string>();

  for (const pattern of SQLI_PATTERNS) {
    if (seen.has(pattern.id)) continue;
    if (!pattern.test(variants)) continue;
    seen.add(pattern.id);
    hits.push({ id: pattern.id, label: pattern.label });
  }

  return hits;
}

export function scanLogBodyForSqli(log: Log): { haystack: string; hits: SqliPatternHit[] } {
  const parts = collectSqliHaystackParts(log);
  const haystack = parts.join('\n');
  if (!haystack.trim()) return { haystack: '', hits: [] };
  return { haystack, hits: matchSqliPatterns(haystack) };
}
