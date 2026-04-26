import { 
  LayoutDashboard, 
  FileText, 
  AlertTriangle, 
  Shield, 
  Settings, 
  Users, 
  FileBarChart,
  GitBranch,
  Cpu,
  Lock
} from 'lucide-react';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'logs', label: 'Log Management', icon: FileText },
  { id: 'alerts', label: 'Alerts', icon: AlertTriangle },
  { id: 'threat-detection', label: 'Threat Detection', icon: Shield },
  { id: 'detection-rules', label: 'Detection Rules', icon: GitBranch },
  { id: 'ai-recommendations', label: 'AI Recommendations', icon: Cpu },
  { id: 'access-control', label: 'Access Control', icon: Lock },
  { id: 'reports', label: 'Reports', icon: FileBarChart },
  { id: 'users', label: 'User Management', icon: Users },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function Sidebar({ currentPage, onNavigate }: SidebarProps) {
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
        {navItems.map((item) => {
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