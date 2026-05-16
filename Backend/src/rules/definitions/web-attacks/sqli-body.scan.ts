import { Log } from '../../../logs/log.schema';

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

function urlDecodeOnce(input: string): string {
  try {
    return decodeURIComponent(input.replace(/\+/g, ' '));
  } catch {
    return input;
  }
}

/** Apply URL decoding up to a few passes (handles double-encoding). */
export function urlDecodeForScan(input: string, maxPasses = 3): string {
  let prev = '';
  let cur = input;
  for (let i = 0; i < maxPasses && cur !== prev; i += 1) {
    prev = cur;
    cur = urlDecodeOnce(cur);
  }
  return cur;
}

export type SqliPatternHit = { id: string; label: string };

/**
 * Case-insensitive SQLi heuristics on decoded text.
 * Covers OR 1=1, UNION SELECT, DROP/INSERT, SELECT * FROM, and -- / block comments.
 */
export function matchSqliPatterns(haystack: string): SqliPatternHit[] {
  const hits: SqliPatternHit[] = [];
  const decoded = urlDecodeForScan(haystack);
  const text = decoded;

  const tests: Array<{ id: string; label: string; re: RegExp }> = [
    {
      id: 'or_true',
      label: "OR 1=1 / tautology",
      re: /['"]?\s*or\s+['"]?\s*\d+\s*=\s*['"]?\s*\d+|['"]?\s*or\s+['"]?\s*true\b/i,
    },
    { id: 'union_select', label: 'UNION SELECT', re: /\bunion\s+select\b/i },
    { id: 'drop_table', label: 'DROP TABLE', re: /\bdrop\s+table\b/i },
    { id: 'insert_into', label: 'INSERT INTO', re: /\binsert\s+into\b/i },
    { id: 'select_star_from', label: 'SELECT * FROM', re: /\bselect\s+\*\s+from\b/i },
    {
      id: 'line_comment',
      label: 'SQL line comment (--)',
      re: /(?:^|[\s;,()])--(?:\s|$|[\r\n])/m,
    },
    {
      id: 'block_comment',
      label: 'SQL block comment (/* */)',
      re: /\/\*[\s\S]*?\*\//,
    },
  ];

  for (const t of tests) {
    if (t.re.test(text)) {
      hits.push({ id: t.id, label: t.label });
    }
  }

  return hits;
}

export function scanLogBodyForSqli(log: Log): { haystack: string; hits: SqliPatternHit[] } {
  const bodies = extractAllRequestBodies(log);
  if (bodies.length === 0) return { haystack: '', hits: [] };

  const parts: string[] = [];
  for (const body of bodies) {
    parts.push(...collectBodyStrings(body));
  }

  const haystack = parts.join('\n');
  if (!haystack.trim()) return { haystack: '', hits: [] };
  return { haystack, hits: matchSqliPatterns(haystack) };
}
