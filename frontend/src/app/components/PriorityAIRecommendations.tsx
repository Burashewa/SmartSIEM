import { useState } from 'react';
import { Sparkles, Check } from 'lucide-react';

interface Recommendation {
  id: string;
  severity: 'Critical' | 'High' | 'Medium';
  description: string;
  executed: boolean;
}

const initialRecommendations: Recommendation[] = [
  {
    id: '1',
    severity: 'Critical',
    description: 'Block suspicious IP: 192.168.1.50',
    executed: false,
  },
  {
    id: '2',
    severity: 'Critical',
    description: 'Isolate compromised endpoint: WKS-0847',
    executed: false,
  },
  {
    id: '3',
    severity: 'High',
    description: 'Enforce MFA for user: admin@company.com',
    executed: false,
  },
  {
    id: '4',
    severity: 'High',
    description: 'Update firewall rules for port 8080',
    executed: false,
  },
  {
    id: '5',
    severity: 'Medium',
    description: 'Review access logs for user: jdoe@company.com',
    executed: false,
  },
];

export function PriorityAIRecommendations() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>(initialRecommendations);

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case 'Critical':
        return {
          badge: 'bg-[#ef4444]/20 text-[#ef4444] border border-[#ef4444]/30',
          glow: 'shadow-[0_0_15px_rgba(239,68,68,0.3)]',
        };
      case 'High':
        return {
          badge: 'bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/30',
          glow: '',
        };
      case 'Medium':
        return {
          badge: 'bg-[#3b82f6]/20 text-[#3b82f6] border border-[#3b82f6]/30',
          glow: '',
        };
      default:
        return {
          badge: 'bg-gray-700 text-gray-300',
          glow: '',
        };
    }
  };

  const handleExecute = (id: string) => {
    setRecommendations(prev =>
      prev.map(rec =>
        rec.id === id ? { ...rec, executed: true } : rec
      )
    );
  };

  return (
    <div className="bg-[#0f0f17] border border-[#1f1f2e] rounded-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#4f46e5]/20 border border-[#4f46e5]/30 rounded">
            <Sparkles className="size-5 text-[#4f46e5]" />
          </div>
          <h3 className="text-lg text-white">Priority AI Recommendations</h3>
        </div>
        <div className="text-xs text-muted-foreground">
          {recommendations.filter(r => !r.executed).length} pending
        </div>
      </div>

      {/* Recommendations List */}
      <div className="space-y-3">
        {recommendations.map((rec) => {
          const styles = getSeverityStyles(rec.severity);
          return (
            <div
              key={rec.id}
              className={`bg-[#1a1a24] border border-[#2a2a3e] rounded p-4 transition-all ${
                rec.severity === 'Critical' && !rec.executed ? styles.glow : ''
              } ${rec.executed ? 'opacity-50' : ''}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  {/* Severity Badge */}
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 text-xs rounded ${styles.badge}`}
                    >
                      {rec.severity}
                    </span>
                    {rec.executed && (
                      <span className="flex items-center gap-1 text-xs text-[#10b981]">
                        <Check className="size-3" />
                        Executed
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-sm text-gray-300">{rec.description}</p>
                </div>

                {/* Action Button */}
                <button
                  onClick={() => handleExecute(rec.id)}
                  disabled={rec.executed}
                  className={`px-4 py-2 text-sm rounded transition-all whitespace-nowrap ${
                    rec.executed
                      ? 'bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/30 cursor-not-allowed'
                      : rec.severity === 'Critical'
                      ? 'bg-[#ef4444] hover:bg-[#dc2626] text-white border border-[#ef4444] hover:shadow-[0_0_10px_rgba(239,68,68,0.5)]'
                      : 'bg-[#4f46e5] hover:bg-[#4338ca] text-white border border-[#4f46e5]'
                  }`}
                >
                  {rec.executed ? 'Completed' : 'Execute Mitigation'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-[#1f1f2e]">
        <p className="text-xs text-muted-foreground text-center">
          AI-powered recommendations updated in real-time
        </p>
      </div>
    </div>
  );
}
