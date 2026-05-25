/** Normalize .env values (trim, strip wrapping quotes). */
export function normalizeEnvValue(value: string | undefined): string {
  if (!value) return '';
  let next = value.trim();
  if (
    (next.startsWith('"') && next.endsWith('"')) ||
    (next.startsWith("'") && next.endsWith("'"))
  ) {
    next = next.slice(1, -1).trim();
  }
  return next;
}
