import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { adminApi, type Role } from '../../api/adminApi';
import { inputCls, SelectNative } from '../shared';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-[#6b7280]">{label}</span>
      {children}
    </label>
  );
}

export function CreateUserModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
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
      await adminApi.createUser({ username: username.trim(), password, role });
      toast.success(`User "${username.trim()}" created successfully`);
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to create user');
    } finally {
      setBusy(false);
    }
  };

  const passwordStrength = (pw: string): { label: string; color: string; width: string } => {
    const score =
      (pw.length >= 8 ? 1 : 0) +
      (/[A-Z]/.test(pw) ? 1 : 0) +
      (/[0-9]/.test(pw) ? 1 : 0) +
      (/[^A-Za-z0-9]/.test(pw) ? 1 : 0);
    if (score <= 1) return { label: 'Weak', color: 'bg-red-500', width: 'w-1/4' };
    if (score === 2) return { label: 'Fair', color: 'bg-amber-500', width: 'w-2/4' };
    if (score === 3) return { label: 'Good', color: 'bg-yellow-400', width: 'w-3/4' };
    return { label: 'Strong', color: 'bg-green-500', width: 'w-full' };
  };

  const strength = password.length > 0 ? passwordStrength(password) : null;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="border-[#1f1f2e] bg-[#0f0f17] text-white">
        <DialogHeader>
          <DialogTitle>Create User</DialogTitle>
          <DialogDescription className="text-[#9ca3af]">
            Add a new operator to the platform.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <Field label="Username">
            <input
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={inputCls}
              placeholder="e.g. jsmith"
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
            />
            {strength && (
              <div className="mt-1.5 space-y-1">
                <div className="h-1 w-full overflow-hidden rounded-full bg-[#1f1f2e]">
                  <div className={`h-full rounded-full transition-all ${strength.color} ${strength.width}`} />
                </div>
                <p className="text-xs text-[#6b7280]">
                  Strength: <span className="text-white">{strength.label}</span>
                </p>
              </div>
            )}
          </Field>
          <Field label="Confirm Password">
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Role">
            <SelectNative value={role} onChange={(v) => setRole(v as Role)}>
              <option value="security_analyst">Security Analyst</option>
              <option value="admin">Admin</option>
            </SelectNative>
          </Field>
          {error && <p className="rounded-md border border-red-800 bg-red-900/20 p-2 text-sm text-red-400">{error}</p>}
          <DialogFooter>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-[#1f1f2e] px-3 py-2 text-sm hover:bg-[#1a1a24]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-[#4f46e5] px-3 py-2 text-sm font-medium hover:bg-[#4338ca] disabled:opacity-50"
            >
              {busy ? 'Creating…' : 'Create User'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
