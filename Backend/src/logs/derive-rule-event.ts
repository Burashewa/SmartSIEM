/**
 * Maps structured logs (event + action + status) to canonical event names used by detection rules.
 * Legacy flat names (e.g. login_failed) pass through unchanged.
 */
export function deriveRuleFacingEvent(
  normalizedEvent: string,
  action?: string,
  status?: string,
): string {
  const e = normalizedEvent;
  const a = action ?? '';
  const s = status ?? '';

  if (e === 'authentication' || e === 'auth') {
    if (a === 'login') {
      if (['failed', 'failure', 'error', 'denied', 'deny'].includes(s)) return 'login_failed';
      if (['success', 'succeeded', 'ok', 'authenticated', 'pass', 'passed'].includes(s)) {
        return 'login_success';
      }
    }
  }

  if (e === 'api' || e === 'http') {
    if (a === 'rate_limit' || s === 'rate_limited' || s === '429') return 'rate_limit_exceeded';
    if (a === 'unauthorized' || s === '403' || s === 'forbidden') return 'unauthorized_endpoint';
  }

  if (e === 'web_attack' || e === 'injection' || e === 'security') {
    if (a === 'sql' || a === 'sql_injection') return 'sql_injection_attempt';
    if (a === 'xss') return 'xss_attempt';
    if (a === 'command' || a === 'command_injection') return 'command_injection_attempt';
  }

  if (e === 'reconnaissance' || e === 'recon') {
    if (a === 'directory_scan' || a === 'dir_scan') return 'directory_scan';
    if (a === 'sensitive_file' || a === 'sensitive_file_access') return 'sensitive_file_access';
  }

  return e;
}
