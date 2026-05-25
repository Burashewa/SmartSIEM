import { User, Activity, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SystemStatus } from './SystemStatus';
import { fetchSystemStatus, type SystemStatusResponse } from '../api/system';
import type { SiemRole } from '../api/auth';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '../features/admin/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '../features/admin/ui/dropdown-menu';

interface HeaderProps {
  username: string;
  role: SiemRole;
  onLogout: () => Promise<void>;
}

type SystemState = 'healthy' | 'critical' | 'unknown';

const HEALTHY_STATES = new Set(['healthy', 'ok', 'up', 'success']);
const CRITICAL_STATES = new Set(['critical', 'down', 'error', 'failed']);

const normalizeStatusValue = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized.length > 0 ? normalized : null;
  }

  if (value && typeof value === 'object' && 'state' in value) {
    const nested = (value as { state?: unknown }).state;
    if (typeof nested === 'string') {
      const normalized = nested.trim().toLowerCase();
      return normalized.length > 0 ? normalized : null;
    }
  }

  return null;
};

const getSystemState = (status: SystemStatusResponse | null): SystemState => {
  const raw = status?.systemStatus?.status;
  const normalized = normalizeStatusValue(raw);

  if (!normalized) {
    return 'unknown';
  }

  if (HEALTHY_STATES.has(normalized)) {
    return 'healthy';
  }

  if (CRITICAL_STATES.has(normalized)) {
    return 'critical';
  }

  return 'unknown';
};

function useSystemStatus(pollInterval = 30000) {
  const [status, setStatus] = useState<SystemStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const data = await fetchSystemStatus();
        if (!alive) return;

        setStatus(data);
        setError(null);
      } catch (err) {
        if (!alive) return;

        setError(
          err instanceof Error ? err.message : 'Failed to load system status'
        );
      }
    };

    void load();
    const id = window.setInterval(() => void load(), pollInterval);

    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [pollInterval]);

  return { status, error };
}

export function Header({ username, role, onLogout }: HeaderProps) {
  const navigate = useNavigate();
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const { status, error } = useSystemStatus();

  const databaseConnected = status?.database.connected ?? false;
  const databaseProvider = status?.database.provider ?? 'MongoDB';
  const ingestionRate = status?.ingestionRate.eps ?? null;

  const systemState = getSystemState(status);
  const isHealthy = systemState === 'healthy';
  const isCritical = systemState === 'critical';
  const systemLabel = isHealthy
    ? 'Healthy'
    : isCritical
      ? 'Critical'
      : 'Unknown';

  return (
    <header className="h-16 bg-[#0f0f17] border-b border-[#1f1f2e] flex items-center px-6">
      
      {/* LEFT SECTION */}
      <div className="flex items-center gap-4">
        <SystemStatus
          ingestionRate={ingestionRate}
          databaseConnected={databaseConnected}
          databaseProvider={databaseProvider}
        />

        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#1a1a24] border border-[#2a2a3a]">
          <Activity className="size-4" />
          <span className="text-sm">System Status:</span>

          <div className="flex items-center gap-1.5">
            <div
              className={`size-2 rounded-full ${
                isHealthy
                  ? 'bg-[#10b981] shadow-[0_0_8px_rgba(16,185,129,0.6)]'
                  : isCritical
                    ? 'bg-[#ef4444] shadow-[0_0_8px_rgba(239,68,68,0.6)]'
                    : 'bg-[#9ca3af] shadow-[0_0_8px_rgba(156,163,175,0.6)]'
              }`}
            />

            <span
              className={`text-xs font-medium ${
                isHealthy
                  ? 'text-[#10b981]'
                  : isCritical
                    ? 'text-[#ef4444]'
                    : 'text-[#9ca3af]'
              }`}
            >
              {systemLabel}
            </span>
          </div>
        </div>

        {error && (
          <span className="hidden 2xl:block text-xs text-[#fca5a5] max-w-56 truncate">
            {error}
          </span>
        )}
      </div>

      {/* RIGHT SECTION */}
      <div className="flex items-center gap-2 ml-auto">
        <Link
          to="/settings?createAgent=true"
          className="flex items-center gap-2 px-3 py-1.5 bg-[#1f2937] border border-[#2a2a3a] text-sm text-white rounded-md hover:bg-[#272f3f] transition-colors"
          title="Create agent"
        >
          <Plus className="size-4" />
          <span>Create Agent</span>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-3 px-3 py-1.5 hover:bg-[#1a1a24] transition-colors rounded-md"
              title="User menu"
            >
              <div className="size-8 rounded-full bg-[#4f46e5] flex items-center justify-center shrink-0">
                <User className="size-4 text-white" />
              </div>

              <div className="text-left leading-tight">
                <div className="text-sm text-white">{username}</div>
                <div className="text-xs text-gray-500">{role.toUpperCase()}</div>
              </div>
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="border-[#1f1f2e] bg-[#0f0f17] text-white">
            <DropdownMenuItem onClick={() => navigate('/profile')}>
              Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-[#1f1f2e]" />
            <DropdownMenuItem onClick={() => setLogoutDialogOpen(true)} className="text-[#ef4444]">
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <AlertDialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm logout</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to log out? You will need to sign in again to access the dashboard.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel asChild>
                <button className="px-3 py-2 bg-[#1a1a24] border border-[#2a2a3a] text-gray-300 hover:text-white rounded-md transition-colors">
                  Cancel
                </button>
              </AlertDialogCancel>
              <AlertDialogAction asChild>
                <button
                  type="button"
                  onClick={() => void onLogout()}
                  className="px-3 py-2 bg-[#ef4444] hover:bg-[#dc2626] text-white rounded-md transition-colors"
                >
                  Logout
                </button>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </header>
  );
}