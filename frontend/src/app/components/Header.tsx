import { Bell, User, Activity } from 'lucide-react';
import { useEffect, useState } from 'react';
import { SystemStatus } from './SystemStatus';
import { fetchSystemStatus, type SystemStatusResponse } from '../api/system';
import type { SiemRole } from '../api/auth';

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
  const [notificationCount] = useState(12);
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
        
        {/* Notifications */}
        <button className="relative p-2 hover:bg-[#1a1a24] transition-colors rounded-md">
          <Bell className="size-5 text-gray-400" />
          {notificationCount > 0 && (
            <span className="absolute top-1 right-1 bg-[#ef4444] text-white text-[10px] font-medium size-4 rounded-full flex items-center justify-center">
              {notificationCount}
            </span>
          )}
        </button>

        {/* User */}
        <button
          type="button"
          onClick={() => void onLogout()}
          className="flex items-center gap-3 px-3 py-1.5 hover:bg-[#1a1a24] transition-colors rounded-md"
          title="Sign out"
        >
          <div className="size-8 rounded-full bg-[#4f46e5] flex items-center justify-center shrink-0">
            <User className="size-4 text-white" />
          </div>

          <div className="text-left leading-tight">
            <div className="text-sm text-white">{username}</div>
            <div className="text-xs text-gray-500">{role.toUpperCase()}</div>
          </div>
        </button>
      </div>
    </header>
  );
}