import { Search, Plus } from 'lucide-react';
import type { Role, UserStatus } from '../../api/adminApi';
import { SelectNative } from '../shared';

interface FilterCounts {
  total: number;
  active: number;
  disabled: number;
  locked: number;
  admins: number;
}

const CHIP_TONES = {
  total: 'border-[#1f1f2e] bg-[#0f0f17] text-white',
  active: 'border-green-800 bg-green-900/30 text-green-400',
  disabled: 'border-gray-700 bg-gray-800/40 text-gray-400',
  locked: 'border-orange-800 bg-orange-900/30 text-orange-400',
  admins: 'border-red-800 bg-red-900/30 text-red-400',
} as const;

function Chip({ label, value, tone }: { label: string; value: number; tone: keyof typeof CHIP_TONES }) {
  return (
    <span className={`rounded-full border px-3 py-1 text-xs ${CHIP_TONES[tone]}`}>
      {label}: <span className="font-semibold">{value}</span>
    </span>
  );
}

export function UserFilters({
  query,
  roleFilter,
  statusFilter,
  counts,
  onQuery,
  onRole,
  onStatus,
  onCreate,
}: {
  query: string;
  roleFilter: 'all' | Role;
  statusFilter: 'all' | UserStatus;
  counts: FilterCounts;
  onQuery: (q: string) => void;
  onRole: (r: 'all' | Role) => void;
  onStatus: (s: 'all' | UserStatus) => void;
  onCreate: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b7280]" />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search by username…"
            className="w-full rounded-md border border-[#1f1f2e] bg-[#0f0f17] py-2 pl-9 pr-3 text-sm text-white placeholder:text-[#6b7280] focus:border-[#4f46e5] focus:outline-none"
          />
        </div>
        <SelectNative value={roleFilter} onChange={(v) => onRole(v as 'all' | Role)}>
          <option value="all">All roles</option>
          <option value="admin">Admin</option>
          <option value="security_analyst">Security Analyst</option>
        </SelectNative>
        <SelectNative value={statusFilter} onChange={(v) => onStatus(v as 'all' | UserStatus)}>
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
          <option value="locked">Locked</option>
        </SelectNative>
        <button
          type="button"
          onClick={onCreate}
          className="inline-flex items-center gap-1 rounded-md bg-[#4f46e5] px-3 py-2 text-sm font-medium text-white hover:bg-[#4338ca]"
        >
          <Plus className="h-4 w-4" />
          Create User
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Chip label="Total" value={counts.total} tone="total" />
        <Chip label="Active" value={counts.active} tone="active" />
        <Chip label="Disabled" value={counts.disabled} tone="disabled" />
        <Chip label="Locked" value={counts.locked} tone="locked" />
        <Chip label="Admins" value={counts.admins} tone="admins" />
      </div>
    </div>
  );
}
