import { useEffect, useState } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi, type AdminUser, type UserStatus } from '../../api/adminApi';
import { isAbortError } from '../../api/adminApi';
import { ActionBtn, cardCls, mutedText, relTime, RoleBadge, StatusBadge } from '../shared';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../../ui/collapsible';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../../ui/sheet';

const ROLE_CAPABILITIES: [string, boolean, boolean][] = [
  ['Admin Console', true, false],
  ['Manage Users & Audit', true, false],
  ['Dashboard / Alerts', false, true],
  ['Detection Rules', false, true],
  ['Log Investigation', false, true],
  ['AI Assistant', false, true],
  ['Reports', false, true],
];

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <dt className={mutedText}>{label}</dt>
      <dd className="text-white">{value ?? '—'}</dd>
    </>
  );
}

export function UserDrawer({
  user,
  currentUsername,
  onClose,
  onChanged,
  onChangeRole,
  onResetPassword,
  onDisable,
}: {
  user: AdminUser | null;
  currentUsername: string;
  onClose: () => void;
  onChanged: () => void;
  onChangeRole: (user: AdminUser) => void;
  onResetPassword: (user: AdminUser) => void;
  onDisable: (user: AdminUser) => void;
}) {
  const [full, setFull] = useState<AdminUser | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    if (!user) { setFull(null); return; }
    const controller = new AbortController();
    setLoadingDetail(true);
    adminApi
      .getUser(user.username, controller.signal)
      .then((next) => { if (next) setFull(next); })
      .catch((e) => { if (!isAbortError(e)) console.error(e); })
      .finally(() => setLoadingDetail(false));
    return () => controller.abort();
  }, [user]);

  if (!user) return null;

  const current = full ?? user;
  const status: UserStatus = current.status ?? (current.isLocked ? 'locked' : !current.isActive ? 'disabled' : 'active');
  const isSelf = current.username === currentUsername;

  const handleEnable = async () => {
    try {
      await adminApi.updateUser(current.username, { isActive: true });
      toast.success(`${current.username} enabled`);
      onChanged();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to enable user');
    }
  };

  const handleUnlock = async () => {
    try {
      await adminApi.unlockUser(current.username);
      toast.success(`${current.username} unlocked`);
      onChanged();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to unlock user');
    }
  };

  return (
    <Sheet open={!!user} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto border-[#1f1f2e] bg-[#0a0a0f] text-white sm:max-w-[500px]"
      >
        <SheetHeader>
          <SheetTitle className="text-white">User Details</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-5">
          {/* Identity */}
          <section className={`${cardCls} p-4`}>
            <div className="flex items-center gap-3">
              <h3 className="font-mono text-lg font-semibold text-white">{current.username}</h3>
              {loadingDetail && <Loader2 className="h-4 w-4 animate-spin text-[#6b7280]" />}
              <RoleBadge role={current.role} />
              <StatusBadge status={status} />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <Info label="Last login" value={relTime(current.lastLoginAt)} />
              <Info label="Agents" value={current.agentCount} />
              <Info label="Failed attempts" value={current.failedLoginAttempts} />
              {current.lockedUntil && <Info label="Locked until" value={relTime(current.lockedUntil)} />}
              <Info label="Created" value={relTime(current.createdAt)} />
              <Info label="Updated" value={relTime(current.updatedAt)} />
            </dl>
          </section>

          {/* Self-warning */}
          {isSelf && (
            <div className="rounded-md border border-amber-800/60 bg-amber-900/20 p-3 text-xs text-amber-400">
              You are viewing your own account. Destructive actions are disabled.
            </div>
          )}

          {/* Actions */}
          <section className="flex flex-wrap gap-2">
            <ActionBtn onClick={() => onChangeRole(current)} variant="primary">
              Change Role
            </ActionBtn>
            {current.isActive ? (
              current.role !== 'admin' && !isSelf && (
                <ActionBtn onClick={() => onDisable(current)} variant="danger">
                  Disable
                </ActionBtn>
              )
            ) : (
              !isSelf && (
                <ActionBtn onClick={handleEnable} variant="primary">
                  Enable
                </ActionBtn>
              )
            )}
            {status === 'locked' && !isSelf && (
              <ActionBtn onClick={handleUnlock} variant="primary">
                Unlock
              </ActionBtn>
            )}
            <ActionBtn onClick={() => onResetPassword(current)}>Reset Password</ActionBtn>
          </section>

          {/* Agents */}
          <section className={`${cardCls} overflow-hidden`}>
            <h4 className="border-b border-[#1f1f2e] p-3 text-sm font-semibold">
              Agents{' '}
              {current.agents && (
                <span className="ml-1 rounded-full bg-[#1f1f2e] px-2 py-0.5 text-xs font-normal text-[#9ca3af]">
                  {current.agents.length}
                </span>
              )}
            </h4>
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
                      <td className="px-3 py-2 font-mono text-[#9ca3af]" title={agent.agentId}>
                        {agent.agentId.slice(0, 12)}…
                      </td>
                      <td className="px-3 py-2 text-white">{agent.storageMode}</td>
                      <td className={`px-3 py-2 ${mutedText}`}>{relTime(agent.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className={`p-4 text-xs ${mutedText}`}>
                {loadingDetail ? 'Loading agents…' : 'No agents registered.'}
              </p>
            )}
          </section>

          {/* Role capabilities */}
          <Collapsible>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-[#1f1f2e] bg-[#0f0f17] p-3 text-sm font-semibold hover:bg-[#1a1a24]">
              Role Capabilities
              <ChevronDown className="h-4 w-4 text-[#6b7280] transition-transform [[data-state=open]>&]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
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
                    {ROLE_CAPABILITIES.map(([capability, admin, analyst]) => (
                      <tr
                        key={capability}
                        className={`border-b border-[#1f1f2e] last:border-0 ${
                          current.role === 'admin' && admin
                            ? 'bg-[#4f46e5]/5'
                            : current.role === 'security_analyst' && analyst
                              ? 'bg-[#4f46e5]/5'
                              : ''
                        }`}
                      >
                        <td className="px-3 py-2 text-white">{capability}</td>
                        <td className={`px-3 py-2 ${admin ? 'text-green-400' : mutedText}`}>
                          {admin ? '✓' : '—'}
                        </td>
                        <td className={`px-3 py-2 ${analyst ? 'text-green-400' : mutedText}`}>
                          {analyst ? '✓' : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </SheetContent>
    </Sheet>
  );
}
