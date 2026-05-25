import { useEffect, useMemo, useState } from 'react';
import { getSession } from '../../../api/auth';
import { adminApi, type AdminUser, type Role, type UserStatus } from '../api/adminApi';
import { isAbortError } from '../api/adminApi';
import { ErrorBanner } from '../components/shared';
import { statusOf, UserTable } from '../components/users/UserTable';
import { UserFilters } from '../components/users/UserFilters';
import { UserDrawer } from '../components/users/UserDrawer';
import { CreateUserModal } from '../components/users/CreateUserModal';
import { ChangeRoleModal } from '../components/users/ChangeRoleModal';
import { ResetPasswordModal } from '../components/users/ResetPasswordModal';
import { DisableUserDialog } from '../components/users/DisableUserDialog';

export default function UsersTab({
  refreshKey,
  initialQuery = '',
}: {
  refreshKey: number;
  initialQuery?: string;
}) {
  const currentUsername = getSession()?.username ?? '';

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState(initialQuery);
  const [roleFilter, setRoleFilter] = useState<'all' | Role>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | UserStatus>('all');

  const [createOpen, setCreateOpen] = useState(false);
  const [drawerUser, setDrawerUser] = useState<AdminUser | null>(null);
  const [roleModal, setRoleModal] = useState<AdminUser | null>(null);
  const [resetModal, setResetModal] = useState<AdminUser | null>(null);
  const [confirmDisable, setConfirmDisable] = useState<AdminUser | null>(null);

  // Sync initialQuery when parent changes it (e.g. navigating from AgentsTab)
  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    adminApi
      .getUsers(controller.signal)
      .then(setUsers)
      .catch((e: unknown) => {
        if (!isAbortError(e)) {
          setError(e instanceof Error ? e.message : 'Failed to load users');
        }
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [refreshKey]);

  const filtered = useMemo(
    () =>
      users.filter((user) => {
        if (query && !user.username.toLowerCase().includes(query.toLowerCase())) return false;
        if (roleFilter !== 'all' && user.role !== roleFilter) return false;
        if (statusFilter !== 'all' && statusOf(user) !== statusFilter) return false;
        return true;
      }),
    [users, query, roleFilter, statusFilter],
  );

  const counts = useMemo(
    () => ({
      total: users.length,
      active: users.filter((u) => statusOf(u) === 'active').length,
      disabled: users.filter((u) => statusOf(u) === 'disabled').length,
      locked: users.filter((u) => statusOf(u) === 'locked').length,
      admins: users.filter((u) => u.role === 'admin').length,
    }),
    [users],
  );

  const reload = () => {
    setLoading(true);
    setError(null);
    adminApi
      .getUsers()
      .then(setUsers)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load users'))
      .finally(() => setLoading(false));
  };

  if (error) return <ErrorBanner error={error} onRetry={reload} />;

  return (
    <div className="space-y-4">
      <UserFilters
        query={query}
        roleFilter={roleFilter}
        statusFilter={statusFilter}
        counts={counts}
        onQuery={setQuery}
        onRole={setRoleFilter}
        onStatus={setStatusFilter}
        onCreate={() => setCreateOpen(true)}
      />

      <UserTable
        users={filtered}
        loading={loading}
        currentUsername={currentUsername}
        onView={setDrawerUser}
        onRole={setRoleModal}
        onReset={setResetModal}
        onDisable={setConfirmDisable}
        onChanged={reload}
      />

      <CreateUserModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          reload();
        }}
      />

      <UserDrawer
        user={drawerUser}
        currentUsername={currentUsername}
        onClose={() => setDrawerUser(null)}
        onChanged={reload}
        onChangeRole={setRoleModal}
        onResetPassword={setResetModal}
        onDisable={setConfirmDisable}
      />

      <ChangeRoleModal
        user={roleModal}
        currentUsername={currentUsername}
        onClose={() => setRoleModal(null)}
        onSaved={() => {
          setRoleModal(null);
          reload();
        }}
      />

      <ResetPasswordModal
        user={resetModal}
        onClose={() => setResetModal(null)}
        onSaved={() => setResetModal(null)}
      />

      <DisableUserDialog
        user={confirmDisable}
        onClose={() => setConfirmDisable(null)}
        onDisabled={() => {
          setConfirmDisable(null);
          reload();
        }}
      />
    </div>
  );
}
