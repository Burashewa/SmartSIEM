import { LucideIcon } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string;
  trend: string;
  icon: LucideIcon;
  iconColor: string;
  borderColor: string;
  pulsing?: boolean;
}

export function KPICard({ title, value, trend, icon: Icon, iconColor, borderColor, pulsing }: KPICardProps) {
  return (
    <div className={`bg-[#0f0f17] border border-[#1f1f2e] border-l-4 ${borderColor} p-6 transition-all hover:border-[#2f2f3e] ${pulsing ? 'animate-pulse' : ''}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-400 mb-1">{title}</p>
          <p className="text-3xl font-mono text-white mb-2">{value}</p>
          <p className={`text-xs ${
            trend.startsWith('+') 
              ? 'text-[#10b981]' 
              : trend.startsWith('-') 
                ? 'text-[#ef4444]' 
                : 'text-gray-400'
          }`}>
            {trend} from yesterday
          </p>
        </div>
        <div className={`${iconColor} bg-[#1a1a24] p-3 border border-[#2a2a3a]`}>
          <Icon className="size-6" />
        </div>
      </div>
    </div>
  );
}
