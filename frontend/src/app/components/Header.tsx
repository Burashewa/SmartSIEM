import { User, Activity, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { SystemStatus } from './SystemStatus';
import { useAuth } from '@/app/auth/AuthContext';

interface HeaderProps {
  systemStatus: 'healthy' | 'critical';
}

export function Header({ systemStatus }: HeaderProps) {
  const [notificationCount] = useState(12);
  const { state, logout } = useAuth();
  const display =
    state.status === 'authenticated' ? (state.user.display_name || state.user.email) : 'User';

  return (
    <header className="h-16 bg-[#0f0f17] border-b border-[#1f1f2e] flex items-center justify-between px-6">
      {/* Left: placeholder for page title or breadcrumbs (kept flexible/dynamic) */}
      <div className="flex-1">
        {/* Intentionally left empty — header search removed per UX request */}
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-4 ml-6">
        {/* System Status Widget */}
        <SystemStatus />

        {/* System Health Status */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#1a1a24] border border-[#2a2a3a]">
          <Activity className="size-4" />
          <span className="text-sm">System Status:</span>
          <div className="flex items-center gap-1.5">
            <div
              className={`size-2 rounded-full ${
                systemStatus === 'healthy'
                  ? 'bg-[#10b981] shadow-[0_0_8px_rgba(16,185,129,0.6)]'
                  : 'bg-[#ef4444] shadow-[0_0_8px_rgba(239,68,68,0.6)]'
              }`}
            />
            <span className={`text-xs font-medium ${
              systemStatus === 'healthy' ? 'text-[#10b981]' : 'text-[#ef4444]'
            }`}>
              {systemStatus === 'healthy' ? 'Healthy' : 'Critical'}
            </span>
          </div>
        </div>

        {/* Create Agent (replaces notifications) */}
        {state.status === 'authenticated' ? (
        <Link
  to="/settings?createAgent=1"
  className="flex items-center gap-1 px-2 py-2 bg-[#4f46e5] hover:bg-[#6366f1] text-white rounded-md transition-colors text-xs font-medium"
  title="Create agent"
>
  <Plus className="size-3" />
  Create agent
</Link>
        ) : (
          <Link
            to="/login"
            className="flex items-center gap-2 px-3 py-1.5 bg-[#1a1a24] hover:bg-[#262633] text-gray-300 rounded transition-colors text-sm"
            title="Sign in to create agents"
          >
            <Plus className="size-4 text-gray-400" />
            Sign in
          </Link>
        )}

        {/* User Profile */}
        <button
          onClick={() => logout()}
          className="flex items-center gap-2 px-3 py-1.5 hover:bg-[#1a1a24] transition-colors"
          title="Logout"
        >
          <div className="size-8 rounded-full bg-[#4f46e5] flex items-center justify-center">
            <User className="size-4 text-white" />
          </div>
          <div className="text-left">
            <div className="text-sm text-white">{display}</div>
            <div className="text-xs text-gray-500">Click to logout</div>
          </div>
        </button>
      </div>
    </header>
  );
}