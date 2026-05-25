import type { LucideIcon } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string;
  trend: string;
  trendLabel?: string;
  trendTone?: 'positive' | 'negative' | 'neutral';
  subtext?: string;
  icon: LucideIcon;
  iconColor: string;
  borderColor: string;
  pulsing?: boolean;
  onClick?: () => void;
}

export function KPICard({
  title,
  value,
  trend,
  trendLabel = 'from yesterday',
  trendTone,
  subtext,
  icon: Icon,
  iconColor,
  borderColor,
  pulsing,
  onClick,
}: KPICardProps) {
  const resolvedTrendTone =
    trendTone ??
    (trend.startsWith('+') ? 'positive' : trend.startsWith('-') ? 'negative' : 'neutral');

  const clickableClass = onClick ? 'cursor-pointer hover:bg-[#121226]' : '';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left bg-[#0f0f17] border border-[#1f1f2e] border-l-4 ${borderColor} p-6 transition-all ${clickableClass} ${pulsing ? 'animate-pulse' : ''}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-400 mb-1">{title}</p>
          <p className="text-3xl font-mono text-white mb-2">{value}</p>
          {subtext ? (
            <p className="text-xs text-gray-400 mb-1">{subtext}</p>
          ) : null}
          <p
            className={`text-xs ${
              resolvedTrendTone === 'positive'
                ? 'text-[#10b981]'
                : resolvedTrendTone === 'negative'
                  ? 'text-[#ef4444]'
                  : 'text-gray-400'
            }`}
          >
            {trend} {trendLabel}
          </p>
        </div>
        <div className={`${iconColor} bg-[#1a1a24] p-3 border border-[#2a2a3a]`}>
          <Icon className="size-6" />
        </div>
      </div>
    </button>
  );
}
