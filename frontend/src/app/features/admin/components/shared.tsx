/* eslint-disable react-refresh/only-export-components */
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export const inputCls =
  'w-full rounded-md border border-[#1f1f2e] bg-[#0a0a0f] px-3 py-2 text-sm text-white placeholder:text-[#6b7280] focus:border-[#4f46e5] focus:outline-none';

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

export type SortDir = 'asc' | 'desc' | null;

export function SortIcon({ dir }: { dir: SortDir }) {
  if (dir === 'asc') return <ChevronUp className="ml-1 inline h-3 w-3" />;
  if (dir === 'desc') return <ChevronDown className="ml-1 inline h-3 w-3" />;
  return <ChevronsUpDown className="ml-1 inline h-3 w-3 opacity-30" />;
}

export function SortHeader<K extends string>({
  label,
  field,
  sortKey,
  sortDir,
  onSort,
}: {
  label: string;
  field: K;
  sortKey: K | null;
  sortDir: SortDir;
  onSort: (field: K) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className="group inline-flex items-center gap-0.5 font-medium hover:text-white"
    >
      {label}
      <SortIcon dir={sortKey === field ? sortDir : null} />
    </button>
  );
}

export function ActionBtn({
  onClick,
  variant = 'default',
  disabled,
  children,
}: {
  onClick: () => void;
  variant?: 'default' | 'danger' | 'primary';
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const cls = {
    default: 'border-[#1f1f2e] bg-[#0f0f17] text-white hover:bg-[#1a1a24]',
    danger: 'border-red-800/60 bg-red-900/20 text-red-400 hover:bg-red-900/40',
    primary: 'border-[#4f46e5]/60 bg-[#4f46e5]/20 text-[#818cf8] hover:bg-[#4f46e5]/30',
  }[variant];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md border px-3 py-1.5 text-xs transition disabled:cursor-not-allowed disabled:opacity-40 ${cls}`}
    >
      {children}
    </button>
  );
}

export function SelectNative({
  value,
  onChange,
  children,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`rounded-md border border-[#1f1f2e] bg-[#0f0f17] px-3 py-2 text-sm text-white focus:border-[#4f46e5] focus:outline-none ${className ?? ''}`}
    >
      {children}
    </select>
  );
}
