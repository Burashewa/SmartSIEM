import { useMemo, useState } from 'react';
import { MoreVertical } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi, type AdminUser, type UserStatus } from '../../api/adminApi';
import {
  cardCls,
  mutedText,
  relTime,
  RoleBadge,
  SkeletonRow,
  SortHeader,
  StatusBadge,
  type SortDir,
} from '../shared';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../../ui/dropdown-menu';

type SortKey = 'username' | 'role' | 'status' | 'agentCount' | 'lastLoginAt';

export const statusOf = (user: AdminUser): UserStatus =>
  user.status ?? (user.isLocked ? 'locked' : !user.isActive ? 'disabled' : 'active');

const PAGE_SIZE = 25;

function sortUsers(users: AdminUser[], key: SortKey | null, dir: SortDir): AdminUser[] {
  if (!key || !dir) return users;
  return [...users].sort((a, b) => {
    let cmp = 0;
    if (key === 'username') cmp = a.username.localeCompare(b.username);
    else if (key === 'role') cmp = a.role.localeCompare(b.role);
    else if (key === 'status') cmp = statusOf(a).localeCompare(statusOf(b));
    else if (key === 'agentCount') cmp = a.agentCount - b.agentCount;
    else if (key === 'lastLoginAt') {
      const ta = a.lastLoginAt ? new Date(a.lastLoginAt).getTime() : 0;
      const tb = b.lastLoginAt ? new Date(b.lastLoginAt).getTime() : 0;
      cmp = ta - tb;
    }
    return dir === 'asc' ? cmp : -cmp;
  });
}

export function UserTable({
  users,
  loading,
  currentUsername,
  onView,
  onRole,
  onReset,
  onDisable,
  onChanged,
}: {
  users: AdminUser[];
  loading: boolean;
  currentUsername: string;
  onView: (user: AdminUser) => void;
  onRole: (user: AdminUser) => void;
  onReset: (user: AdminUser) => void;
  onDisable: (user: AdminUser) => void;
  onChanged: () => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey | null>('username');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(0);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : d === 'desc' ? null : 'asc'));
      if (sortDir === null) setSortKey(null);
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(0);
  };

  const sorted = useMemo(() => sortUsers(users, sortKey, sortDir), [users, sortKey, sortDir]);
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visible = sorted.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const thCls = `px-4 py-3 font-medium ${mutedText}`;

  return (
    <div className={`${cardCls} overflow-hidden`}>
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase">
          <tr className="border-b border-[#1f1f2e]">
            <th className={thCls}>
              <SortHeader label="Username" field="username" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
            </th>
            <th className={thCls}>
              <SortHeader label="Role" field="role" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
            </th>
            <th className={thCls}>
              <SortHeader label="Status" field="status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
            </th>
            <th className={thCls}>
              <SortHeader label="Agents" field="agentCount" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
            </th>
            <th className={thCls}>
              <SortHeader label="Last Login" field="lastLoginAt" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
            </th>
            <th className={`${thCls} text-right`}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={6} className="p-4">
                <SkeletonRow cols={6} />
                <SkeletonRow cols={6} />
                <SkeletonRow cols={6} />
              </td>
            </tr>
          )}
          {!loading && visible.length === 0 && (
            <tr>
              <td colSpan={6} className={`p-8 text-center ${mutedText}`}>
                No users match these filters.
              </td>
            </tr>
          )}
          {!loading &&
            visible.map((user) => {
              const status = statusOf(user);
              return (
                <tr
                  key={user.username}
                  onClick={() => onView(user)}
                  className="cursor-pointer border-b border-[#1f1f2e] last:border-0 hover:bg-[#1a1a24]"
                >
                  <td className="px-4 py-3 font-mono text-white">{user.username}</td>
                  <td className="px-4 py-3">
                    <RoleBadge role={user.role} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={status} />
                  </td>
                  <td className="px-4 py-3 text-white">{user.agentCount}</td>
                  <td className={`px-4 py-3 ${mutedText}`}>{relTime(user.lastLoginAt)}</td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <UserActions
                      user={user}
                      status={status}
                      currentUsername={currentUsername}
                      onView={onView}
                      onRole={onRole}
                      onReset={onReset}
                      onDisable={onDisable}
                      onChanged={onChanged}
                    />
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>

      {!loading && sorted.length > 0 && (
        <div className="flex items-center justify-between border-t border-[#1f1f2e] px-4 py-2 text-xs">
          <span className={mutedText}>
            {sorted.length === 0
              ? '0 users'
              : `${safePage * PAGE_SIZE + 1}–${Math.min((safePage + 1) * PAGE_SIZE, sorted.length)} of ${sorted.length} users`}
          </span>
          {pageCount > 1 && (
            <div className="flex gap-2">
              <button
                type="button"
                disabled={safePage === 0}
                onClick={() => setPage((p) => p - 1)}
                className="rounded border border-[#1f1f2e] px-3 py-1 text-white hover:bg-[#1a1a24] disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={safePage >= pageCount - 1}
                onClick={() => setPage((p) => p + 1)}
                className="rounded border border-[#1f1f2e] px-3 py-1 text-white hover:bg-[#1a1a24] disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function UserActions({
  user,
  status,
  currentUsername,
  onView,
  onRole,
  onReset,
  onDisable,
  onChanged,
}: {
  user: AdminUser;
  status: UserStatus;
  currentUsername: string;
  onView: (user: AdminUser) => void;
  onRole: (user: AdminUser) => void;
  onReset: (user: AdminUser) => void;
  onDisable: (user: AdminUser) => void;
  onChanged: () => void;
}) {
  const isSelf = user.username === currentUsername;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded p-1 hover:bg-[#1f1f2e]">
        <MoreVertical className="h-4 w-4 text-[#9ca3af]" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="border-[#1f1f2e] bg-[#0f0f17] text-white">
        <DropdownMenuItem onClick={() => onView(user)}>View Details</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onRole(user)} disabled={isSelf}>
          Change Role
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-[#1f1f2e]" />
        {user.isActive ? (
          user.role !== 'admin' && !isSelf && (
            <DropdownMenuItem
              onClick={() => onDisable(user)}
              className="text-red-400 focus:text-red-400"
            >
              Disable
            </DropdownMenuItem>
          )
        ) : (
          <DropdownMenuItem
            onClick={async () => {
              try {
                await adminApi.updateUser(user.username, { isActive: true });
                toast.success(`${user.username} enabled`);
                onChanged();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Failed to enable user');
              }
            }}
          >
            Enable
          </DropdownMenuItem>
        )}
        {status === 'locked' && !isSelf && (
          <DropdownMenuItem
            onClick={async () => {
              try {
                await adminApi.unlockUser(user.username);
                toast.success(`${user.username} unlocked`);
                onChanged();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Failed to unlock user');
              }
            }}
          >
            Unlock
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => onReset(user)}>Reset Password</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
