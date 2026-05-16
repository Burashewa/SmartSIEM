/**
 * Human-readable rule names for deduplicated alert summaries.
 * Keys must match `RULE_ID_*` values in rules.constants.ts.
 */
const ALERT_RULE_LABELS: Record<string, string> = {
  'failed-logins-5-in-5m': 'failed login burst',
  'impossible-traveler': 'impossible traveler',
  'impossible-travel-country-ip': 'impossible travel (country by IP)',
  'login-after-failures': 'login after failures',
  'credential-stuffing': 'credential stuffing',
  'distributed-brute-force': 'distributed brute force',
  'sql-injection-attempt': 'SQL injection',
  'xss-attempt': 'XSS',
  'command-injection-attempt': 'command injection',
  'api-rate-limit': 'API rate limit',
  'unauthorized-endpoint': 'unauthorized endpoint',
  'directory-scan': 'directory scan',
  'sensitive-file-access': 'sensitive file access',
  'known-malicious-ip': 'known malicious / blocklisted IP',
  'dos-high-volume-ip': 'suspected DoS / flood',
  'error-burst-ip': 'error burst from IP',
};

export function humanizeRuleId(ruleId: string): string {
  return ALERT_RULE_LABELS[ruleId] ?? ruleId.replace(/-/g, ' ');
}
