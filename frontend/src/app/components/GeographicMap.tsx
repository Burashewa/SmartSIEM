import { MapPin } from 'lucide-react';
import type { AttackLocation } from '../lib/dashboardWidgets';

interface GeographicMapProps {
  attacks: AttackLocation[];
  isLoading?: boolean;
  error?: string | null;
}

export function GeographicMap({
  attacks,
  isLoading = false,
  error = null,
}: GeographicMapProps) {
  const hasData = attacks.length > 0;

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return '#ef4444';
      case 'high':
        return '#f59e0b';
      case 'medium':
        return '#eab308';
      case 'low':
        return '#3b82f6';
      default:
        return '#6b7280';
    }
  };

  return (
    <div className="bg-[#0f0f17] border border-[#1f1f2e] p-6">
      <div className="mb-4">
        <h3 className="text-lg font-medium text-white">Geographic Attack Map</h3>
        <p className="text-sm text-gray-400 mt-1">Attack sources worldwide</p>
      </div>

      <div className="relative h-[200px] bg-[#1a1a24] border border-[#2a2a3a] mb-4 overflow-hidden">
        <div
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, transparent, transparent 19px, #2a2a3a 19px, #2a2a3a 20px), repeating-linear-gradient(90deg, transparent, transparent 19px, #2a2a3a 19px, #2a2a3a 20px)',
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(79,70,229,0.16),_transparent_65%)]" />

        {attacks.map((attack) => (
          <div
            key={attack.id}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${projectLongitude(attack.lng)}%`,
              top: `${projectLatitude(attack.lat)}%`,
            }}
            title={`${attack.label} (${attack.count.toLocaleString()})`}
          >
            <div
              className="size-4 rounded-full animate-ping absolute opacity-75"
              style={{ backgroundColor: getSeverityColor(attack.severity) }}
            />
            <MapPin
              className="size-4 relative z-10"
              style={{ color: getSeverityColor(attack.severity) }}
            />
          </div>
        ))}

        {!isLoading && !hasData ? (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-gray-500">
            No geolocated attack data is available yet.
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        {attacks.map((attack) => (
          <div key={attack.id} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div
                className="size-2 rounded-full"
                style={{ backgroundColor: getSeverityColor(attack.severity) }}
              />
              <span className="text-gray-300">{attack.label}</span>
            </div>
            <span className="font-mono text-gray-400">{attack.count.toLocaleString()}</span>
          </div>
        ))}

        {isLoading ? (
          <p className="pt-2 text-xs text-gray-500">Loading geographic attack activity...</p>
        ) : null}

        {!isLoading && error ? (
          <p className="pt-2 text-xs text-[#fca5a5]">{error}</p>
        ) : null}
      </div>
    </div>
  );
}

function projectLongitude(lng: number): number {
  return clamp(((lng + 180) / 360) * 100, 4, 96);
}

function projectLatitude(lat: number): number {
  return clamp(((90 - lat) / 180) * 100, 8, 92);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
