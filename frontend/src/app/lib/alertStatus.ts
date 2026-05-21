/** Matches backend `alert-status.ts` analyst-updatable values. */
export type AnalystAlertStatus = 'investigating' | 'threat' | 'resolved' | 'false_positive';

export type AlertUiStatus = 'open' | AnalystAlertStatus;

export const ANALYST_ALERT_STATUSES: AnalystAlertStatus[] = [
  'investigating',
  'threat',
  'resolved',
  'false_positive',
];

export function normalizeAlertUiStatus(status: string | undefined): AlertUiStatus {
  const normalized = (status ?? 'open').trim().toLowerCase();
  if (normalized === 'new') return 'open';
  if (normalized === 'open') return 'open';
  if (normalized === 'investigating' || normalized === 'acknowledged') return 'investigating';
  if (normalized === 'threat' || normalized === 'confirmed_threat') return 'threat';
  if (normalized === 'resolved' || normalized === 'closed') return 'resolved';
  if (normalized === 'false_positive') return 'false_positive';
  return 'open';
}

export function getAlertStatusLabel(status: AlertUiStatus): string {
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

export function getAlertStatusColor(status: AlertUiStatus): string {
  switch (status) {
    case 'open':
      return 'bg-[#ef4444]/20 text-[#ef4444]';
    case 'investigating':
      return 'bg-[#f59e0b]/20 text-[#f59e0b]';
    case 'threat':
      return 'bg-[#dc2626]/25 text-[#f87171] border border-[#ef4444]/40';
    case 'resolved':
      return 'bg-[#10b981]/20 text-[#10b981]';
    case 'false_positive':
      return 'bg-[#6b7280]/20 text-[#9ca3af]';
    default:
      return 'bg-gray-700/20 text-gray-400';
  }
}
