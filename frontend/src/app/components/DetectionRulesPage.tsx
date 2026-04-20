import { useState } from 'react';
import { Search, Clock, Hash, Shield, AlertTriangle, Lock, FileCode, Zap } from 'lucide-react';

interface DetectionRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  lastTriggered: string | null;
  triggerCount: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
}

const initialRules: DetectionRule[] = [
  {
    id: 'RULE-001',
    name: 'Brute Force Detection',
    description: 'Detects multiple failed login attempts from a single source IP',
    enabled: true,
    lastTriggered: new Date(Date.now() - 3600000).toISOString(),
    triggerCount: 847,
    severity: 'critical',
    category: 'Authentication',
  },
  {
    id: 'RULE-002',
    name: 'SQL Injection Pattern',
    description: 'Identifies SQL injection attempts in HTTP requests',
    enabled: true,
    lastTriggered: new Date(Date.now() - 7200000).toISOString(),
    triggerCount: 523,
    severity: 'critical',
    category: 'Web Security',
  },
  {
    id: 'RULE-003',
    name: 'Lateral Movement Detection',
    description: 'Monitors unusual internal network access patterns',
    enabled: true,
    lastTriggered: new Date(Date.now() - 86400000).toISOString(),
    triggerCount: 234,
    severity: 'high',
    category: 'Network',
  },
  {
    id: 'RULE-004',
    name: 'Privilege Escalation',
    description: 'Detects unauthorized privilege elevation attempts',
    enabled: false,
    lastTriggered: new Date(Date.now() - 172800000).toISOString(),
    triggerCount: 156,
    severity: 'critical',
    category: 'Access Control',
  },
  {
    id: 'RULE-005',
    name: 'Malware Signature Match',
    description: 'Identifies known malware signatures in file transfers',
    enabled: true,
    lastTriggered: new Date(Date.now() - 10800000).toISOString(),
    triggerCount: 89,
    severity: 'high',
    category: 'Malware',
  },
  {
    id: 'RULE-006',
    name: 'Port Scanning Activity',
    description: 'Detects reconnaissance through port scanning',
    enabled: true,
    lastTriggered: new Date(Date.now() - 5400000).toISOString(),
    triggerCount: 412,
    severity: 'medium',
    category: 'Network',
  },
  {
    id: 'RULE-007',
    name: 'Data Exfiltration Pattern',
    description: 'Monitors unusual outbound data transfer volumes',
    enabled: true,
    lastTriggered: new Date(Date.now() - 43200000).toISOString(),
    triggerCount: 67,
    severity: 'critical',
    category: 'Data Loss',
  },
  {
    id: 'RULE-008',
    name: 'Suspicious PowerShell Execution',
    description: 'Identifies potentially malicious PowerShell commands',
    enabled: false,
    lastTriggered: new Date(Date.now() - 259200000).toISOString(),
    triggerCount: 145,
    severity: 'high',
    category: 'Execution',
  },
  {
    id: 'RULE-009',
    name: 'Anomalous Login Time',
    description: 'Detects login attempts outside of normal hours',
    enabled: true,
    lastTriggered: new Date(Date.now() - 14400000).toISOString(),
    triggerCount: 298,
    severity: 'medium',
    category: 'Authentication',
  },
  {
    id: 'RULE-010',
    name: 'DNS Tunneling Detection',
    description: 'Identifies data exfiltration through DNS queries',
    enabled: false,
    lastTriggered: null,
    triggerCount: 0,
    severity: 'high',
    category: 'Network',
  },
  {
    id: 'RULE-011',
    name: 'Ransomware Behavior',
    description: 'Detects file encryption patterns typical of ransomware',
    enabled: true,
    lastTriggered: new Date(Date.now() - 604800000).toISOString(),
    triggerCount: 12,
    severity: 'critical',
    category: 'Malware',
  },
  {
    id: 'RULE-012',
    name: 'Credential Dumping',
    description: 'Monitors attempts to extract credentials from memory',
    enabled: true,
    lastTriggered: new Date(Date.now() - 21600000).toISOString(),
    triggerCount: 78,
    severity: 'critical',
    category: 'Credential Access',
  },
];

export function DetectionRulesPage() {
  const [rules, setRules] = useState<DetectionRule[]>(initialRules);
  const [searchQuery, setSearchQuery] = useState('');

  const toggleRule = (ruleId: string) => {
    setRules(prev =>
      prev.map(rule =>
        rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule
      )
    );
  };

  const filteredRules = rules.filter(rule =>
    rule.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    rule.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    rule.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    rule.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <Shield className="size-4 text-[#ef4444]" />;
      case 'high':
        return <AlertTriangle className="size-4 text-[#f59e0b]" />;
      case 'medium':
        return <Zap className="size-4 text-[#eab308]" />;
      case 'low':
        return <FileCode className="size-4 text-[#3b82f6]" />;
      default:
        return <Shield className="size-4 text-gray-400" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-[#ef4444]/20 text-[#ef4444] border-[#ef4444]/30';
      case 'high':
        return 'bg-[#f59e0b]/20 text-[#f59e0b] border-[#f59e0b]/30';
      case 'medium':
        return 'bg-[#eab308]/20 text-[#eab308] border-[#eab308]/30';
      case 'low':
        return 'bg-[#3b82f6]/20 text-[#3b82f6] border-[#3b82f6]/30';
      default:
        return 'bg-gray-700/20 text-gray-400 border-gray-700/30';
    }
  };

  const formatTimestamp = (timestamp: string | null) => {
    if (!timestamp) return 'Never triggered';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHrs = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffHrs / 24);

    if (diffHrs < 1) return 'Less than 1 hour ago';
    if (diffHrs < 24) return `${diffHrs} hour${diffHrs > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  const enabledCount = rules.filter(r => r.enabled).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl text-white mb-2">Detection Rules Management</h1>
          <p className="text-gray-400">
            Configure and monitor security detection rules • {enabledCount} of {rules.length} rules enabled
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-[#0f0f17] border border-[#1f1f2e] rounded-lg p-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-gray-500" />
          <input
            type="text"
            placeholder="Search rules by name, ID, description, or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#1a1a24] border border-[#2a2a3a] pl-12 pr-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-[#4f46e5] transition-colors rounded"
          />
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#0f0f17] border border-[#1f1f2e] rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 uppercase mb-1">Total Rules</p>
              <p className="text-2xl text-white font-semibold">{rules.length}</p>
            </div>
            <FileCode className="size-8 text-[#4f46e5]" />
          </div>
        </div>
        <div className="bg-[#0f0f17] border border-[#1f1f2e] rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 uppercase mb-1">Enabled</p>
              <p className="text-2xl text-[#10b981] font-semibold">{enabledCount}</p>
            </div>
            <Shield className="size-8 text-[#10b981]" />
          </div>
        </div>
        <div className="bg-[#0f0f17] border border-[#1f1f2e] rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 uppercase mb-1">Disabled</p>
              <p className="text-2xl text-[#ef4444] font-semibold">{rules.length - enabledCount}</p>
            </div>
            <Lock className="size-8 text-[#ef4444]" />
          </div>
        </div>
        <div className="bg-[#0f0f17] border border-[#1f1f2e] rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 uppercase mb-1">Total Triggers</p>
              <p className="text-2xl text-white font-semibold">
                {rules.reduce((sum, rule) => sum + rule.triggerCount, 0).toLocaleString()}
              </p>
            </div>
            <Zap className="size-8 text-[#f59e0b]" />
          </div>
        </div>
      </div>

      {/* Rules Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredRules.map((rule) => (
          <div
            key={rule.id}
            className={`bg-[#0f0f17] border rounded-lg p-5 transition-all ${
              rule.enabled
                ? 'border-[#1f1f2e] hover:border-[#4f46e5]/50'
                : 'border-[#1f1f2e] opacity-60'
            }`}
          >
            {/* Card Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start gap-3 flex-1">
                <div className="mt-0.5">
                  {getSeverityIcon(rule.severity)}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg text-white font-medium mb-1">
                    {rule.name}
                  </h3>
                  <p className="text-sm text-gray-400 mb-2">
                    {rule.description}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 border rounded ${getSeverityColor(rule.severity)}`}>
                      {rule.severity.toUpperCase()}
                    </span>
                    <span className="text-xs px-2 py-0.5 bg-[#1a1a24] text-gray-400 rounded">
                      {rule.category}
                    </span>
                  </div>
                </div>
              </div>

              {/* Toggle Switch */}
              <button
                onClick={() => toggleRule(rule.id)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#4f46e5] focus:ring-offset-2 focus:ring-offset-[#0f0f17] ${
                  rule.enabled ? 'bg-[#4f46e5]' : 'bg-[#2a2a3a]'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    rule.enabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Card Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-[#1f1f2e]">
              <div className="flex items-center gap-4 text-xs text-gray-400">
                <div className="flex items-center gap-1.5">
                  <Hash className="size-3.5" />
                  <span className="font-mono">{rule.id}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="size-3.5" />
                  <span>{formatTimestamp(rule.lastTriggered)}</span>
                </div>
              </div>
              <div className="text-xs text-gray-400">
                <span className="font-mono">{rule.triggerCount.toLocaleString()}</span> triggers
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* No Results */}
      {filteredRules.length === 0 && (
        <div className="bg-[#0f0f17] border border-[#1f1f2e] rounded-lg p-12 text-center">
          <Search className="size-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg text-white mb-2">No rules found</h3>
          <p className="text-gray-400">
            Try adjusting your search query
          </p>
        </div>
      )}
    </div>
  );
}
