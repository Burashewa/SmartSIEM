/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, MoreVertical, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi, type AdminUser, type Role, type UserStatus } from '../api/adminApi';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../ui/sheet';
import { cardCls, ErrorBanner, mutedText, relTime, RoleBadge, SkeletonRow, StatusBadge } from '../components/shared';

const inputCls =
  'w-full rounded-md border border-[#1f1f2e] bg-[#0a0a0f] px-3 py-2 text-sm text-white placeholder:text-[#6b7280] focus:border-[#4f46e5] focus:outline-none';

const statusOf = (user: AdminUser): UserStatus => user.status ?? (user.isLocked ? 'locked' : !user.isActive ? 'disabled' : 'active');

export default function UsersTab({ refreshKey }: { refreshKey: number }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | Role>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | UserStatus>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [drawerUser, setDrawerUser] = useState<AdminUser | null>(null);
  const [roleModal, setRoleModal] = useState<AdminUser | null>(null);
  const [resetModal, setResetModal] = useState<AdminUser | null>(null);
  const [confirmDisable, setConfirmDisable] = useState<AdminUser | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    adminApi
      .getUsers()
      .then(setUsers)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load users'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [refreshKey]);

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

  const chips = useMemo(
    () => ({
      total: users.length,
      active: users.filter((user) => statusOf(user) === 'active').length,
      disabled: users.filter((user) => statusOf(user) === 'disabled').length,
      locked: users.filter((user) => statusOf(user) === 'locked').length,
      admins: users.filter((user) => user.role === 'admin').length,
    }),
    [users],
  );

  if (error) return <ErrorBanner error={error} onRetry={load} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b7280]" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by username..." className="w-full rounded-md border border-[#1f1f2e] bg-[#0f0f17] py-2 pl-9 pr-3 text-sm text-white placeholder:text-[#6b7280] focus:border-[#4f46e5] focus:outline-none" />
        </div>
        <SelectNative value={roleFilter} onChange={(value) => setRoleFilter(value as 'all' | Role)}>
          <option value="all">All roles</option>
          <option value="admin">Admin</option>
          <option value="security_analyst">Security Analyst</option>
        </SelectNative>
        <SelectNative value={statusFilter} onChange={(value) => setStatusFilter(value as 'all' | UserStatus)}>
          <option value="all">All status</option>
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
          <option value="locked">Locked</option>
        </SelectNative>
        <button type="button" onClick={() => setCreateOpen(true)} className="inline-flex items-center gap-1 rounded-md bg-[#4f46e5] px-3 py-2 text-sm font-medium text-white hover:bg-[#4338ca]">
          <Plus className="h-4 w-4" /> Create User
        </button>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <Chip label="Total" value={chips.total} />
        <Chip label="Active" value={chips.active} tone="green" />
        <Chip label="Disabled" value={chips.disabled} tone="gray" />
        <Chip label="Locked" value={chips.locked} tone="orange" />
        <Chip label="Admins" value={chips.admins} tone="red" />
      </div>

      <div className={`${cardCls} overflow-hidden`}>
        <table className="w-full text-sm">
          <thead className={`${mutedText} text-left text-xs uppercase`}>
            <tr className="border-b border-[#1f1f2e]">
              <th className="px-4 py-3 font-medium">Username</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Agents</th>
              <th className="px-4 py-3 font-medium">Last Login</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
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
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={6} className={`p-8 text-center ${mutedText}`}>
                  No users match these filters.
                </td>
              </tr>
            )}
            {!loading &&
              filtered.map((user) => {
                const status = statusOf(user);
                return (
                  <tr key={user.username} onClick={() => setDrawerUser(user)} className="cursor-pointer border-b border-[#1f1f2e] last:border-0 hover:bg-[#1a1a24]">
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
                      <UserActions user={user} status={status} onView={setDrawerUser} onRole={setRoleModal} onReset={setResetModal} onDisable={setConfirmDisable} onChanged={load} />
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      <CreateUserModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => { setCreateOpen(false); load(); }} />
      <UserDrawer user={drawerUser} onClose={() => setDrawerUser(null)} onChanged={load} onChangeRole={setRoleModal} onResetPassword={setResetModal} onDisable={setConfirmDisable} />
      <ChangeRoleModal user={roleModal} onClose={() => setRoleModal(null)} onSaved={() => { setRoleModal(null); load(); }} />
      <ResetPasswordModal user={resetModal} onClose={() => setResetModal(null)} onSaved={() => setResetModal(null)} />
      <DisableUserDialog user={confirmDisable} onClose={() => setConfirmDisable(null)} onDisabled={() => { setConfirmDisable(null); load(); }} />
    </div>
  );
}

function UserActions({
  user,
  status,
  onView,
  onRole,
  onReset,
  onDisable,
  onChanged,
}: {
  user: AdminUser;
  status: UserStatus;
  onView: (user: AdminUser) => void;
  onRole: (user: AdminUser) => void;
  onReset: (user: AdminUser) => void;
  onDisable: (user: AdminUser) => void;
  onChanged: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded p-1 hover:bg-[#1f1f2e]">
        <MoreVertical className="h-4 w-4 text-[#9ca3af]" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="border-[#1f1f2e] bg-[#0f0f17] text-white">
        <DropdownMenuItem onClick={() => onView(user)}>View Details</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onRole(user)}>Change Role</DropdownMenuItem>
        <DropdownMenuSeparator className="bg-[#1f1f2e]" />
        {user.isActive ? (
          user.role !== 'admin' && <DropdownMenuItem onClick={() => onDisable(user)}>Disable</DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onClick={async () => {
              await adminApi.updateUser(user.username, { isActive: true });
              toast.success(`${user.username} enabled`);
              onChanged();
            }}
          >
            Enable
          </DropdownMenuItem>
        )}
        {status === 'locked' && (
          <DropdownMenuItem
            onClick={async () => {
              await adminApi.unlockUser(user.username);
              toast.success(`${user.username} unlocked`);
              onChanged();
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

function Chip({ label, value, tone = 'default' }: { label: string; value: number; tone?: 'default' | 'green' | 'gray' | 'orange' | 'red' }) {
  const map = {
    default: 'border-[#1f1f2e] bg-[#0f0f17] text-white',
    green: 'border-green-800 bg-green-900/30 text-green-400',
    gray: 'border-gray-700 bg-gray-800/40 text-gray-400',
    orange: 'border-orange-800 bg-orange-900/30 text-orange-400',
    red: 'border-red-800 bg-red-900/30 text-red-400',
  } as const;
  return <span className={`rounded-full border px-3 py-1 ${map[tone]}`}>{label}: <span className="font-semibold">{value}</span></span>;
}

function SelectNative({ value, onChange, children }: { value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-md border border-[#1f1f2e] bg-[#0f0f17] px-3 py-2 text-sm text-white focus:border-[#4f46e5] focus:outline-none">
      {children}
    </select>
  );
}

function CreateUserModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [role, setRole] = useState<Role>('security_analyst');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setUsername('');
      setPassword('');
      setConfirm('');
      setRole('security_analyst');
      setError(null);
    }
  }, [open]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!username.trim()) return setError('Username is required');
    if (password.length < 8) return setError('Password must be at least 8 characters');
    if (password !== confirm) return setError('Passwords do not match');
    setBusy(true);
    try {
      await adminApi.createUser({ username, password, role });
      toast.success('User created successfully');
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to create user');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="border-[#1f1f2e] bg-[#0f0f17] text-white">
        <DialogHeader>
          <DialogTitle>Create User</DialogTitle>
          <DialogDescription className="text-[#9ca3af]">Add a new operator to the console.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <Field label="Username"><input autoFocus value={username} onChange={(e) => setUsername(e.target.value)} className={inputCls} /></Field>
          <Field label="Password"><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} /></Field>
          <Field label="Confirm Password"><input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputCls} /></Field>
          <Field label="Role">
            <SelectNative value={role} onChange={(value) => setRole(value as Role)}>
              <option value="admin">Admin</option>
              <option value="security_analyst">Security Analyst</option>
            </SelectNative>
          </Field>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <DialogFooter>
            <button type="button" onClick={onClose} className="rounded-md border border-[#1f1f2e] px-3 py-2 text-sm hover:bg-[#1a1a24]">Cancel</button>
            <button type="submit" disabled={busy} className="rounded-md bg-[#4f46e5] px-3 py-2 text-sm font-medium hover:bg-[#4338ca] disabled:opacity-50">{busy ? 'Creating...' : 'Create'}</button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ChangeRoleModal({ user, onClose, onSaved }: { user: AdminUser | null; onClose: () => void; onSaved: () => void }) {
  const [role, setRole] = useState<Role>('security_analyst');
  useEffect(() => { if (user) setRole(user.role); }, [user]);
  if (!user) return null;
  return (
    <Dialog open={!!user} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="border-[#1f1f2e] bg-[#0f0f17] text-white">
        <DialogHeader>
          <DialogTitle>Change Role</DialogTitle>
          <DialogDescription className="text-[#9ca3af]">Update the role for <span className="font-mono text-white">{user.username}</span>.</DialogDescription>
        </DialogHeader>
        <Field label="Role">
          <SelectNative value={role} onChange={(value) => setRole(value as Role)}>
            <option value="admin">Admin</option>
            <option value="security_analyst">Security Analyst</option>
          </SelectNative>
        </Field>
        <DialogFooter>
          <button type="button" onClick={onClose} className="rounded-md border border-[#1f1f2e] px-3 py-2 text-sm hover:bg-[#1a1a24]">Cancel</button>
          <button type="button" onClick={async () => { await adminApi.updateUser(user.username, { role }); toast.success('Role updated'); onSaved(); }} className="rounded-md bg-[#4f46e5] px-3 py-2 text-sm font-medium hover:bg-[#4338ca]">Save</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordModal({ user, onClose, onSaved }: { user: AdminUser | null; onClose: () => void; onSaved: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (!user) { setPassword(''); setConfirm(''); setError(null); } }, [user]);
  if (!user) return null;
  return (
    <Dialog open={!!user} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="border-[#1f1f2e] bg-[#0f0f17] text-white">
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
          <DialogDescription className="text-[#9ca3af]">Set a new password for <span className="font-mono text-white">{user.username}</span>.</DialogDescription>
        </DialogHeader>
        <Field label="New Password"><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} /></Field>
        <Field label="Confirm Password"><input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputCls} /></Field>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <DialogFooter>
          <button type="button" onClick={onClose} className="rounded-md border border-[#1f1f2e] px-3 py-2 text-sm hover:bg-[#1a1a24]">Cancel</button>
          <button
            type="button"
            onClick={async () => {
              if (password.length < 8) return setError('Password must be at least 8 characters');
              if (password !== confirm) return setError('Passwords do not match');
              await adminApi.resetPassword(user.username, { newPassword: password });
              toast.success('Password reset');
              onSaved();
            }}
            className="rounded-md bg-[#4f46e5] px-3 py-2 text-sm font-medium hover:bg-[#4338ca]"
          >
            Reset
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DisableUserDialog({ user, onClose, onDisabled }: { user: AdminUser | null; onClose: () => void; onDisabled: () => void }) {
  return (
    <AlertDialog open={!!user} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="border-[#1f1f2e] bg-[#0f0f17] text-white">
        <AlertDialogHeader>
          <AlertDialogTitle>Disable user?</AlertDialogTitle>
          <AlertDialogDescription className="text-[#9ca3af]">
            Are you sure you want to disable <span className="font-mono text-white">{user?.username}</span>? This will prevent them from logging in.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="border border-[#1f1f2e] bg-transparent text-white hover:bg-[#1a1a24]">Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-600 text-white hover:bg-red-700"
            onClick={async () => {
              if (!user) return;
              await adminApi.updateUser(user.username, { isActive: false });
              toast.success(`${user.username} disabled`);
              onDisabled();
            }}
          >
            Disable User
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function UserDrawer({
  user,
  onClose,
  onChanged,
  onChangeRole,
  onResetPassword,
  onDisable,
}: {
  user: AdminUser | null;
  onClose: () => void;
  onChanged: () => void;
  onChangeRole: (user: AdminUser) => void;
  onResetPassword: (user: AdminUser) => void;
  onDisable: (user: AdminUser) => void;
}) {
  const [full, setFull] = useState<AdminUser | null>(null);

  useEffect(() => {
    if (user) adminApi.getUser(user.username).then((next) => setFull(next ?? user));
    else setFull(null);
  }, [user]);

  if (!user) return null;
  const current = full ?? user;
  const status = statusOf(current);

  return (
    <Sheet open={!!user} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto border-[#1f1f2e] bg-[#0a0a0f] text-white sm:max-w-[480px]">
        <SheetHeader>
          <SheetTitle className="text-white">User Details</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-6">
          <section className={`${cardCls} p-4`}>
            <div className="flex items-center gap-3">
              <h3 className="font-mono text-lg text-white">{current.username}</h3>
              <RoleBadge role={current.role} />
              <StatusBadge status={status} />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <Info label="Failed attempts" value={current.failedLoginAttempts} />
              {current.lockedUntil && <Info label="Locked until" value={relTime(current.lockedUntil)} />}
              <Info label="Last login" value={relTime(current.lastLoginAt)} />
              <Info label="Agents" value={current.agentCount} />
              <Info label="Created" value={relTime(current.createdAt)} />
              <Info label="Updated" value={relTime(current.updatedAt)} />
            </dl>
          </section>

          <section className="flex flex-wrap gap-2">
            <ActionBtn onClick={() => onChangeRole(current)}>Change Role</ActionBtn>
            {current.isActive ? (
              current.role !== 'admin' && <ActionBtn onClick={() => onDisable(current)}>Disable</ActionBtn>
            ) : (
              <ActionBtn onClick={async () => { await adminApi.updateUser(current.username, { isActive: true }); toast.success('Enabled'); onChanged(); onClose(); }}>Enable</ActionBtn>
            )}
            {status === 'locked' && <ActionBtn onClick={async () => { await adminApi.unlockUser(current.username); toast.success('Unlocked'); onChanged(); onClose(); }}>Unlock</ActionBtn>}
            <ActionBtn onClick={() => onResetPassword(current)}>Reset Password</ActionBtn>
          </section>

          <section className={`${cardCls} overflow-hidden`}>
            <h4 className="border-b border-[#1f1f2e] p-3 text-sm font-semibold">Agents</h4>
            {current.agents && current.agents.length > 0 ? (
              <table className="w-full text-xs">
                <thead className={`${mutedText} text-left uppercase`}>
                  <tr className="border-b border-[#1f1f2e]">
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Agent ID</th>
                    <th className="px-3 py-2 font-medium">Storage</th>
                    <th className="px-3 py-2 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {current.agents.map((agent) => (
                    <tr key={agent.agentId} className="border-b border-[#1f1f2e] last:border-0">
                      <td className="px-3 py-2 text-white">{agent.name}</td>
                      <td className="px-3 py-2 font-mono text-[#9ca3af]" title={agent.agentId}>{agent.agentId.slice(0, 12)}...</td>
                      <td className="px-3 py-2 text-white">{agent.storageMode}</td>
                      <td className={`px-3 py-2 ${mutedText}`}>{relTime(agent.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className={`p-4 text-xs ${mutedText}`}>No agents.</p>
            )}
          </section>

          <Collapsible>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-[#1f1f2e] bg-[#0f0f17] p-3 text-sm font-semibold hover:bg-[#1a1a24]">
              Role Capabilities
              <ChevronDown className="h-4 w-4" />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <RoleCapabilitiesTable />
            </CollapsibleContent>
          </Collapsible>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function RoleCapabilitiesTable() {
  const rows: [string, boolean, boolean][] = [
    ['Admin Console', true, false],
    ['Manage Users & Audit', true, false],
    ['Dashboard / Alerts', false, true],
    ['Detection Rules', false, true],
    ['Log Investigation', false, true],
  ];
  return (
    <div className={`${cardCls} overflow-hidden`}>
      <table className="w-full text-xs">
        <thead className={`${mutedText} text-left uppercase`}>
          <tr className="border-b border-[#1f1f2e]">
            <th className="px-3 py-2 font-medium">Capability</th>
            <th className="px-3 py-2 font-medium">Admin</th>
            <th className="px-3 py-2 font-medium">Analyst</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([capability, admin, analyst]) => (
            <tr key={capability} className="border-b border-[#1f1f2e] last:border-0">
              <td className="px-3 py-2 text-white">{capability}</td>
              <td className="px-3 py-2">{admin ? 'Yes' : 'No'}</td>
              <td className="px-3 py-2">{analyst ? 'Yes' : 'No'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={`mb-1 block text-xs ${mutedText}`}>{label}</span>
      {children}
    </label>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <dt className={mutedText}>{label}</dt>
      <dd className="text-white">{value}</dd>
    </>
  );
}

function ActionBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="rounded-md border border-[#1f1f2e] bg-[#0f0f17] px-3 py-1.5 text-xs text-white hover:bg-[#1a1a24]">
      {children}
    </button>
  );
}
