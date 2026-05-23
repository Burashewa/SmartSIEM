/** URL-decode repeatedly (handles double/triple encoding). */
export function urlDecodeOnce(input: string): string {
  try {
    return decodeURIComponent(input.replace(/\+/g, ' '));
  } catch {
    return input;
  }
}

export function urlDecodeForScan(input: string, maxPasses = 4): string {
  let prev = '';
  let cur = input;
  for (let i = 0; i < maxPasses && cur !== prev; i += 1) {
    prev = cur;
    cur = urlDecodeOnce(cur);
  }
  return cur;
}

/** Decode common HTML entities used to hide tags and quotes. */
export function htmlEntityDecode(input: string): string {
  let out = input;
  out = out.replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
    const code = parseInt(hex, 16);
    return Number.isFinite(code) ? String.fromCharCode(code) : '';
  });
  out = out.replace(/&#(\d+);/g, (_, num) => {
    const code = parseInt(num, 10);
    return Number.isFinite(code) ? String.fromCharCode(code) : '';
  });
  return out
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&amp;/gi, '&');
}

/** Decode \\xNN and \\uNNNN escapes often used in XSS payloads. */
export function decodeJsEscapes(input: string): string {
  let out = input;
  out = out.replace(/\\x([0-9a-f]{2})/gi, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16)),
  );
  out = out.replace(/\\u([0-9a-f]{4})/gi, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16)),
  );
  return out;
}

/** Remove block comments without inserting spaces (e.g. UN+comment+ION becomes UNION). */
export function stripBlockComments(input: string): string {
  return input.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Collapse whitespace for `union%0aselect` / tab-newline splits. */
export function collapseWhitespace(input: string): string {
  return input.replace(/\s+/g, ' ');
}

/**
 * Apply chained decoding passes used before pattern matching.
 */
export function normalizePayloadForScan(raw: string, maxPasses = 4): string {
  let cur = raw;
  for (let i = 0; i < maxPasses; i += 1) {
    const next = decodeJsEscapes(htmlEntityDecode(urlDecodeOnce(cur)));
    if (next === cur) break;
    cur = next;
  }
  return cur;
}

/**
 * Build multiple views of the same payload (raw, decoded, comment-stripped, etc.).
 */
export function buildScanVariants(raw: string): string[] {
  const decoded = normalizePayloadForScan(raw);
  const noComments = stripBlockComments(decoded);
  const compact = collapseWhitespace(noComments);
  const lower = compact.toLowerCase();
  return [...new Set([raw, decoded, noComments, compact, lower])];
}

export function matchesAnyVariant(variants: string[], test: (text: string) => boolean): boolean {
  return variants.some(test);
}
