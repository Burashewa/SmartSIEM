import { Search, Bell, User, Activity } from 'lucide-react';
import { useState } from 'react';
import { SystemStatus } from './SystemStatus';

interface HeaderProps {
  systemStatus: 'healthy' | 'critical';
}

export function Header({ systemStatus }: HeaderProps) {
  const [notificationCount] = useState(12);

  return (
    <header className="h-16 bg-[#0f0f17] border-b border-[#1f1f2e] flex items-center justify-between px-6">
      {/* Search Bar */}
      <div className="flex-1 max-w-2xl">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search logs, alerts, or threats... (e.g., source:192.168.1.* severity:critical)"
            className="w-full bg-[#1a1a24] border border-[#2a2a3a] pl-10 pr-4 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-[#4f46e5] transition-colors"
          />
        </div>
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

        {/* Notifications */}
        <button className="relative p-2 hover:bg-[#1a1a24] transition-colors">
          <Bell className="size-5 text-gray-400" />
          {notificationCount > 0 && (
            <span className="absolute top-1 right-1 bg-[#ef4444] text-white text-[10px] font-medium size-4 rounded-full flex items-center justify-center">
              {notificationCount}
            </span>
          )}
        </button>

        {/* User Profile */}
        <button className="flex items-center gap-2 px-3 py-1.5 hover:bg-[#1a1a24] transition-colors">
          <div className="size-8 rounded-full bg-[#4f46e5] flex items-center justify-center">
            <User className="size-4 text-white" />
          </div>
          <div className="text-left">
            <div className="text-sm text-white">Admin</div>
            <div className="text-xs text-gray-500">SOC Analyst</div>
          </div>
        </button>
      </div>
    </header>
  );
}