import { useState } from 'react';
import { toast } from 'sonner';
import { adminApi, type AdminUser } from '../../api/adminApi';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../ui/alert-dialog';

export function DisableUserDialog({
  user,
  onClose,
  onDisabled,
}: {
  user: AdminUser | null;
  onClose: () => void;
  onDisabled: () => void;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <AlertDialog open={!!user} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="border-[#1f1f2e] bg-[#0f0f17] text-white">
        <AlertDialogHeader>
          <AlertDialogTitle>Disable user?</AlertDialogTitle>
          <AlertDialogDescription className="text-[#9ca3af]">
            This will immediately prevent{' '}
            <span className="font-mono text-white">{user?.username}</span> from logging in. You can
            re-enable them at any time.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="border border-[#1f1f2e] bg-transparent text-white hover:bg-[#1a1a24]">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            className="bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
            onClick={async () => {
              if (!user) return;
              setBusy(true);
              try {
                await adminApi.updateUser(user.username, { isActive: false });
                toast.success(`${user.username} has been disabled`);
                onDisabled();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Failed to disable user');
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? 'Disabling…' : 'Disable User'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
