/** Analyst-updatable disposition after investigation (open is set by the engine only). */
export const ANALYST_ALERT_STATUSES = [
  'investigating',
  'threat',
  'resolved',
  'false_positive',
] as const;

export type AnalystAlertStatus = (typeof ANALYST_ALERT_STATUSES)[number];

export const ALL_ALERT_STATUSES = ['open', ...ANALYST_ALERT_STATUSES] as const;

export type AlertDisposition = (typeof ALL_ALERT_STATUSES)[number];

export function isAnalystAlertStatus(value: string): value is AnalystAlertStatus {
  return (ANALYST_ALERT_STATUSES as readonly string[]).includes(value);
}

export function formatAlertStatusLabel(status: string): string {
  switch (status) {
    case 'open':
      return 'Open';
    case 'investigating':
      return 'Investigating';
    case 'threat':
      return 'Confirmed Threat';
    case 'resolved':
      return 'Resolved';
    case 'false_positive':
      return 'False Positive';
    default:
      return status;
  }
}
