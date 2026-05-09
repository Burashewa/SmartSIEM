import { useState, useEffect } from 'react';
import { MapPin } from 'lucide-react';
import { fetchLogs } from '@/lib/smartsiemApi';

interface AttackLocation {
  id: string;
  country: string;
  count: number;
  lat: number;
  lng: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

function normalizeSeverity(count: number) {
  if (count > 50) return 'critical';
  if (count > 25) return 'high';
  if (count > 10) return 'medium';
  return 'low';
}

function projectCoordinates(lat: number, lng: number) {
  return {
    left: `${Math.min(92, Math.max(6, 50 + lng * 0.35))}%`,
    top: `${Math.min(88, Math.max(6, 50 - lat * 0.25))}%`,
  };
}

export function GeographicMap() {
  const [attacks, setAttacks] = useState<AttackLocation[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadGeoAttacks() {
      try {
        const response = await fetchLogs({ limit: 100 });
        const byCountry = new Map<string, AttackLocation>();

        response.items.forEach((item) => {
          const geo = item.source?.geo;
          const country = geo?.country_name || 'Unknown';
          const lat = typeof geo?.latitude === 'number' ? geo.latitude : undefined;
          const lng = typeof geo?.longitude === 'number' ? geo.longitude : undefined;
          if (lat == null || lng == null) return;

          const id = `${country}-${Math.round(lat)}-${Math.round(lng)}`;
          const existing = byCountry.get(id);
          if (existing) {
            existing.count += 1;
            existing.severity = normalizeSeverity(existing.count);
          } else {
            byCountry.set(id, {
              id,
              country,
              count: 1,
              lat,
              lng,
              severity: 'low',
            });
          }
        });

        const topAttacks = [...byCountry.values()]
          .sort((a, b) => b.count - a.count)
          .slice(0, 6)
          .map((attack) => ({
            ...attack,
            severity: normalizeSeverity(attack.count),
          }));

        if (mounted) {
          setAttacks(topAttacks);
          setLastUpdated(new Date().toLocaleTimeString('en-US', { hour12: false }));
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError('Unable to load backend geo events.');
        }
      }
    }

    void loadGeoAttacks();
    const interval = window.setInterval(() => {
      void loadGeoAttacks();
    }, 15000);

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return '#ef4444';
      case 'high': return '#f59e0b';
      case 'medium': return '#eab308';
      case 'low': return '#3b82f6';
      default: return '#6b7280';
    }
  };

  return (
    <div className="bg-[#0f0f17] border border-[#1f1f2e] p-6">
      <div className="mb-4">
        <h3 className="text-lg font-medium text-white">Geographic Attack Map</h3>
        <p className="text-sm text-gray-400 mt-1">Attack sources worldwide</p>
      </div>
      
      {/* Simplified world map representation */}
      <div className="relative h-[200px] bg-[#1a1a24] border border-[#2a2a3a] mb-4 overflow-hidden">
        {/* Animated background grid */}
        <div className="absolute inset-0" style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 19px, #2a2a3a 19px, #2a2a3a 20px), repeating-linear-gradient(90deg, transparent, transparent 19px, #2a2a3a 19px, #2a2a3a 20px)',
        }} />

        {attacks.length === 0 && !error && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-500">
            Loading backend geo events...
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-amber-300">
            {error}
          </div>
        )}

        {attacks.map((attack) => {
          const position = projectCoordinates(attack.lat, attack.lng);
          return (
            <div
              key={attack.id}
              className="absolute animate-pulse"
              style={position}
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
          );
        })}
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
        <span>{attacks.length > 0 ? 'Live attack positions from worker logs.' : 'No geo events available yet.'}</span>
        {lastUpdated && <span>Last update: {lastUpdated}</span>}
      </div>

      {/* Attack list */}
      <div className="space-y-2">
        {attacks.length === 0 && !error ? (
          <div className="text-sm text-gray-500">Waiting for backend events to populate the map.</div>
        ) : (
          attacks.map((attack) => (
            <div key={attack.id} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div
                  className="size-2 rounded-full"
                  style={{ backgroundColor: getSeverityColor(attack.severity) }}
                />
                <span className="text-gray-300">{attack.country}</span>
              </div>
              <span className="font-mono text-gray-400">{attack.count.toLocaleString()}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
