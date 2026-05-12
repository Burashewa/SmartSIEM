export function formatDateTime(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleString();
}

export function severityColor(severity: string): string {
  const normalized = severity.toLowerCase();
  if (normalized === 'critical') return 'text-[#ef4444]';
  if (normalized === 'high') return 'text-[#f59e0b]';
  if (normalized === 'medium') return 'text-[#eab308]';
  return 'text-[#3b82f6]';
}
