import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { adminApi, type AdminUser } from '../../api/adminApi';
import { inputCls } from '../shared';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-[#6b7280]">{label}</span>
      {children}
    </label>
  );
}

export function ResetPasswordModal({
  user,
  onClose,
  onSaved,
}: {
  user: AdminUser | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) {
      setPassword('');
      setConfirm('');
      setError(null);
    }
  }, [user]);

  if (!user) return null;

  const save = async () => {
    setError(null);
    if (password.length < 8) return setError('Password must be at least 8 characters');
    if (password !== confirm) return setError('Passwords do not match');
    setBusy(true);
    try {
      await adminApi.resetPassword(user.username, { newPassword: password });
      toast.success(`Password reset for ${user.username}`);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reset password');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!user} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="border-[#1f1f2e] bg-[#0f0f17] text-white">
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
          <DialogDescription className="text-[#9ca3af]">
            Set a new password for{' '}
            <span className="font-mono text-white">{user.username}</span>.
          </DialogDescription>
        </DialogHeader>
        <Field label="New Password">
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Confirm Password">
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={inputCls}
            onKeyDown={(e) => { if (e.key === 'Enter') { void save(); } }}
          />
        </Field>
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
            disabled={busy}
            className="rounded-md bg-[#4f46e5] px-3 py-2 text-sm font-medium hover:bg-[#4338ca] disabled:opacity-50"
          >
            {busy ? 'Resetting…' : 'Reset Password'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
