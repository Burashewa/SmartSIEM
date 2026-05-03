import { useState, useEffect } from 'react';
import { MapPin } from 'lucide-react';

interface AttackLocation {
  id: string;
  country: string;
  count: number;
  lat: number;
  lng: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export function GeographicMap() {
  const [attacks, setAttacks] = useState<AttackLocation[]>([
    { id: '1', country: 'Russia', count: 2341, lat: 55, lng: 37, severity: 'critical' },
    { id: '2', country: 'China', count: 1892, lat: 39, lng: 116, severity: 'high' },
    { id: '3', country: 'USA', count: 1234, lat: 40, lng: -74, severity: 'medium' },
    { id: '4', country: 'Germany', count: 876, lat: 52, lng: 13, severity: 'low' },
    { id: '5', country: 'Brazil', count: 654, lat: -23, lng: -46, severity: 'medium' },
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setAttacks(prev => 
        prev.map(attack => ({
          ...attack,
          count: Math.max(0, attack.count + Math.floor((Math.random() - 0.3) * 50))
        }))
      );
    }, 7000);

    return () => clearInterval(interval);
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
        
        {/* Attack indicators */}
        {attacks.map((attack, idx) => (
          <div
            key={attack.id}
            className="absolute animate-pulse"
            style={{
              left: `${15 + idx * 18}%`,
              top: `${30 + (idx % 3) * 20}%`,
            }}
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
      </div>

      {/* Attack list */}
      <div className="space-y-2">
        {attacks.map((attack) => (
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
        ))}
      </div>
    </div>
  );
}
