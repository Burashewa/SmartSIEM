/* eslint-disable react-refresh/only-export-components */
import { formatDistanceToNow } from 'date-fns';

export const cardCls = 'bg-[#0f0f17] border border-[#1f1f2e] rounded-xl';
export const mutedText = 'text-[#6b7280]';

export function relTime(iso?: string) {
  if (!iso) return '-';
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return '-';
  }
}

export function KPICard({
  label,
  value,
  subtext,
  tone,
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  subtext?: React.ReactNode;
  tone?: 'default' | 'danger' | 'warning';
  onClick?: () => void;
}) {
  const toneCls = tone === 'danger' ? 'text-red-400' : tone === 'warning' ? 'text-amber-400' : 'text-white';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`${cardCls} p-5 text-left transition ${onClick ? 'cursor-pointer hover:border-[#4f46e5]/60' : 'cursor-default'}`}
    >
      <div className={`text-xs uppercase tracking-wide ${mutedText}`}>{label}</div>
      <div className={`mt-2 text-3xl font-semibold ${toneCls}`}>{value}</div>
      {subtext && <div className={`mt-1 text-xs ${mutedText}`}>{subtext}</div>}
    </button>
  );
}

export function SkeletonRow({ cols = 5 }: { cols?: number }) {
  return (
    <div className="flex gap-4 py-3">
      {Array.from({ length: cols }).map((_, i) => (
        <div key={i} className="h-4 flex-1 animate-pulse rounded bg-[#1f1f2e]" />
      ))}
    </div>
  );
}

export function ErrorBanner({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div className="mb-4 flex items-center justify-between rounded-lg border border-red-800 bg-red-900/20 p-3 text-sm text-red-400">
      <span>{error}</span>
      {onRetry && (
        <button onClick={onRetry} className="rounded border border-red-800 px-3 py-1 hover:bg-red-900/40">
          Retry
        </button>
      )}
    </div>
  );
}

export function StatusBadge({ status }: { status: 'active' | 'disabled' | 'locked' }) {
  const map = {
    active: 'border-green-800 bg-green-900/40 text-green-400',
    disabled: 'border-gray-700 bg-gray-800/60 text-gray-400',
    locked: 'border-orange-800 bg-orange-900/40 text-orange-400',
  } as const;
  return <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs ${map[status]}`}>{status}</span>;
}

export function RoleBadge({ role }: { role: 'admin' | 'security_analyst' }) {
  const cls = role === 'admin' ? 'border-red-800 bg-red-900/40 text-red-400' : 'border-amber-800 bg-amber-900/40 text-amber-400';
  return <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs ${cls}`}>{role === 'admin' ? 'Admin' : 'Analyst'}</span>;
}

export function OutcomeBadge({ outcome }: { outcome: 'success' | 'failure' }) {
  const cls = outcome === 'success' ? 'border-green-800 bg-green-900/40 text-green-400' : 'border-red-800 bg-red-900/40 text-red-400';
  return <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs ${cls}`}>{outcome}</span>;
}
