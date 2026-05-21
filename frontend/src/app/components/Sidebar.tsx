import { 
  LayoutDashboard, 
  FileText, 
  AlertTriangle, 
  Shield, 
  Settings, 
  FileBarChart,
  GitBranch,
  Cpu,
} from 'lucide-react';
import type { SiemRole } from '../api/auth';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  role: SiemRole;
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'logs', label: 'Log Management', icon: FileText },
  { id: 'alerts-and-threats', label: 'Alerts & Threats', icon: AlertTriangle },
  // { id: 'alerts', label: 'Alerts', icon: AlertTriangle },
  // { id: 'threat-detection', label: 'Threat Detection', icon: Shield },
  { id: 'threat-intelligence', label: 'Threat Intelligence', icon: Shield },
  { id: 'detection-rules', label: 'Detection Rules', icon: GitBranch },
  { id: 'ai-recommendations', label: 'AI Assistant', icon: Cpu },
  { id: 'investigations', label: 'Investigations', icon: FileText },
  { id: 'reports', label: 'Reports', icon: FileBarChart },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function Sidebar({ currentPage, onNavigate, role }: SidebarProps) {
  const roleWeight: Record<SiemRole, number> = { security_analyst: 20, admin: 40 };
  const minimumRoleByPage: Record<string, SiemRole> = {
    dashboard: 'security_analyst',
    logs: 'security_analyst',
    // alerts: 'security_analyst',
    // 'threat-detection': 'security_analyst',
    'threat-intelligence': 'security_analyst',
    'detection-rules': 'security_analyst',
    'ai-recommendations': 'security_analyst',
    reports: 'security_analyst',
    settings: 'security_analyst',
    'alerts-and-threats': 'security_analyst',
  };

  const allowedItems = navItems.filter(
    (item) => roleWeight[role] >= roleWeight[minimumRoleByPage[item.id] ?? 'security_analyst'],
  );

  return (
    <div className="w-64 bg-[#0f0f17] border-r border-[#1f1f2e] flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-[#1f1f2e]">
        <Shield className="size-8 text-[#4f46e5]" />
        <div className="ml-3">
          <h1 className="font-semibold text-lg text-white">SmartSIEM</h1>
          <p className="text-xs text-muted-foreground">SIEM Platform</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-6 px-3 overflow-y-auto">
        {allowedItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 mb-1 transition-colors ${
                isActive
                  ? 'bg-[#4f46e5] text-white'
                  : 'text-gray-400 hover:text-white hover:bg-[#1a1a24]'
              }`}
            >
              <Icon className="size-5" />
              <span className="text-sm">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Version Info */}
      <div className="p-4 border-t border-[#1f1f2e]">
        <div className="text-xs text-muted-foreground">
          <div>Version 2.4.1</div>
          <div className="mt-1">© 2026 SmartSIEM</div>
        </div>
      </div>
    </div>
  );
}