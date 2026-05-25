import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { adminApi, type AdminUser, type Role } from '../../api/adminApi';
import { SelectNative } from '../shared';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';

export function ChangeRoleModal({
  user,
  currentUsername,
  onClose,
  onSaved,
}: {
  user: AdminUser | null;
  currentUsername: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [role, setRole] = useState<Role>('security_analyst');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setRole(user.role);
      setError(null);
    }
  }, [user]);

  if (!user) return null;

  const isSelf = user.username === currentUsername;
  const isEscalation = role === 'admin' && user.role !== 'admin';

  const save = async () => {
    if (role === user.role) { onClose(); return; }
    setBusy(true);
    setError(null);
    try {
      await adminApi.updateUser(user.username, { role });
      toast.success(`${user.username} is now ${role === 'admin' ? 'Admin' : 'Security Analyst'}`);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update role');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!user} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="border-[#1f1f2e] bg-[#0f0f17] text-white">
        <DialogHeader>
          <DialogTitle>Change Role</DialogTitle>
          <DialogDescription className="text-[#9ca3af]">
            Update the role for{' '}
            <span className="font-mono text-white">{user.username}</span>.
          </DialogDescription>
        </DialogHeader>

        {isSelf && (
          <div className="rounded-md border border-amber-800/60 bg-amber-900/20 p-3 text-sm text-amber-400">
            You cannot change your own role.
          </div>
        )}

        <label className="block">
          <span className="mb-1 block text-xs text-[#6b7280]">New Role</span>
          <SelectNative value={role} onChange={(v) => setRole(v as Role)} className={isSelf ? 'opacity-50' : ''}>
            <option value="security_analyst">Security Analyst</option>
            <option value="admin">Admin</option>
          </SelectNative>
        </label>

        {isEscalation && !isSelf && (
          <div className="rounded-md border border-red-800/60 bg-red-900/20 p-3 text-sm text-red-400">
            Warning: promoting to <strong>Admin</strong> grants full platform governance access.
          </div>
        )}

        {error && (
          <p className="rounded-md border border-red-800 bg-red-900/20 p-2 text-sm text-red-400">{error}</p>
        )}

        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[#1f1f2e] px-3 py-2 text-sm hover:bg-[#1a1a24]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy || isSelf}
            className="rounded-md bg-[#4f46e5] px-3 py-2 text-sm font-medium hover:bg-[#4338ca] disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save Role'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
