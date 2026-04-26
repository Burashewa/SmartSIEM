import { useState } from 'react';
import { Settings as SettingsIcon, Server, Wifi, WifiOff, Key, Database, Clock, Save, Plus, Edit2, Trash2, RefreshCw, CheckCircle2, AlertTriangle, Copy, Eye, EyeOff, Shield } from 'lucide-react';

interface LogCollector {
  id: string;
  name: string;
  type: 'web-server' | 'network-device' | 'database' | 'firewall' | 'endpoint';
  sourceIp: string;
  status: 'connected' | 'disconnected' | 'error';
  lastSeen: string;
  logsReceived: number;
  location: string;
}

interface APIKey {
  id: string;
  name: string;
  key: string;
  created: string;
  lastUsed: string;
  permissions: string[];
}

const logCollectors: LogCollector[] = [
  {
    id: 'col-001',
    name: 'Production Web Server 01',
    type: 'web-server',
    sourceIp: '192.168.1.10',
    status: 'connected',
    lastSeen: '2026-03-04T14:23:00Z',
    logsReceived: 145832,
    location: 'US-East-1',
  },
  {
    id: 'col-002',
    name: 'Production Web Server 02',
    type: 'web-server',
    sourceIp: '192.168.1.11',
    status: 'connected',
    lastSeen: '2026-03-04T14:22:45Z',
    logsReceived: 138924,
    location: 'US-East-1',
  },
  {
    id: 'col-003',
    name: 'Core Router 01',
    type: 'network-device',
    sourceIp: '10.0.0.1',
    status: 'connected',
    lastSeen: '2026-03-04T14:23:10Z',
    logsReceived: 892445,
    location: 'Data Center A',
  },
  {
    id: 'col-004',
    name: 'Perimeter Firewall',
    type: 'firewall',
    sourceIp: '203.0.113.1',
    status: 'connected',
    lastSeen: '2026-03-04T14:23:05Z',
    logsReceived: 524789,
    location: 'DMZ',
  },
  {
    id: 'col-005',
    name: 'Edge Switch 05',
    type: 'network-device',
    sourceIp: '10.0.5.254',
    status: 'error',
    lastSeen: '2026-03-04T12:45:30Z',
    logsReceived: 45621,
    location: 'Building B',
  },
  {
    id: 'col-006',
    name: 'Database Server Primary',
    type: 'database',
    sourceIp: '172.16.0.10',
    status: 'connected',
    lastSeen: '2026-03-04T14:22:55Z',
    logsReceived: 67234,
    location: 'Data Center A',
  },
  {
    id: 'col-007',
    name: 'VPN Gateway',
    type: 'network-device',
    sourceIp: '203.0.113.50',
    status: 'disconnected',
    lastSeen: '2026-03-04T08:15:22Z',
    logsReceived: 23456,
    location: 'Remote Office',
  },
  {
    id: 'col-008',
    name: 'Endpoint Security Agent',
    type: 'endpoint',
    sourceIp: '192.168.10.0/24',
    status: 'connected',
    lastSeen: '2026-03-04T14:23:12Z',
    logsReceived: 312456,
    location: 'Corporate Network',
  },
];

const initialAPIKeys: APIKey[] = [
  {
    id: 'key-001',
    name: 'Production Log Ingestion',
    key: 'siem_prod_7f8a9b2c4d6e1f3a5b7c9d2e4f6a8b1c',
    created: '2026-01-15T10:00:00Z',
    lastUsed: '2026-03-04T14:20:00Z',
    permissions: ['log:write', 'log:read'],
  },
  {
    id: 'key-002',
    name: 'Development Environment',
    key: 'siem_dev_1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d',
    created: '2026-02-01T09:30:00Z',
    lastUsed: '2026-03-03T16:45:00Z',
    permissions: ['log:write', 'log:read', 'alert:read'],
  },
  {
    id: 'key-003',
    name: 'Monitoring Dashboard',
    key: 'siem_monitor_9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c',
    created: '2026-01-20T14:15:00Z',
    lastUsed: '2026-03-04T14:15:30Z',
    permissions: ['log:read', 'alert:read', 'dashboard:read'],
  },
];

export function SettingsPage() {
  const [collectors] = useState(logCollectors);
  const [apiKeys] = useState(initialAPIKeys);
  const [retentionDays, setRetentionDays] = useState(90);
  const [archiveEnabled, setArchiveEnabled] = useState(true);
  const [compressionEnabled, setCompressionEnabled] = useState(true);
  const [showNewCollectorForm, setShowNewCollectorForm] = useState(false);
  const [showNewAPIKeyForm, setShowNewAPIKeyForm] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [testingConnection, setTestingConnection] = useState<string | null>(null);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'text-[#10b981] bg-[#10b981]/20 border-[#10b981]/30';
      case 'disconnected':
        return 'text-gray-400 bg-gray-700/20 border-gray-700/30';
      case 'error':
        return 'text-[#ef4444] bg-[#ef4444]/20 border-[#ef4444]/30';
      default:
        return 'text-gray-400 bg-gray-700/20 border-gray-700/30';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <Wifi className="size-4" />;
      case 'disconnected':
        return <WifiOff className="size-4" />;
      case 'error':
        return <AlertTriangle className="size-4" />;
      default:
        return <WifiOff className="size-4" />;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'web-server':
        return <Server className="size-5 text-[#3b82f6]" />;
      case 'network-device':
        return <Wifi className="size-5 text-[#10b981]" />;
      case 'database':
        return <Database className="size-5 text-[#8b5cf6]" />;
      case 'firewall':
        return <Shield className="size-5 text-[#ef4444]" />;
      case 'endpoint':
        return <Server className="size-5 text-[#f59e0b]" />;
      default:
        return <Server className="size-5 text-gray-400" />;
    }
  };

  const testConnection = (collectorId: string) => {
    setTestingConnection(collectorId);
    setTimeout(() => {
      setTestingConnection(null);
      // Simulate connection test result
    }, 2000);
  };

  const toggleKeyVisibility = (keyId: string) => {
    setVisibleKeys(prev => {
      const newSet = new Set(prev);
      if (newSet.has(keyId)) {
        newSet.delete(keyId);
      } else {
        newSet.add(keyId);
      }
      return newSet;
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const maskAPIKey = (key: string) => {
    return key.substring(0, 15) + '•'.repeat(20);
  };

  const connectedCount = collectors.filter(c => c.status === 'connected').length;
  const disconnectedCount = collectors.filter(c => c.status === 'disconnected').length;
  const errorCount = collectors.filter(c => c.status === 'error').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl text-white mb-2">System Settings</h1>
          <p className="text-gray-400">
            Configure data sources, API keys, and system parameters
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-[#4f46e5]/20 border border-[#4f46e5]/30 rounded">
          <SettingsIcon className="size-5 text-[#4f46e5]" />
          <span className="text-sm text-[#4f46e5] font-medium">System Configuration</span>
        </div>
      </div>

      {/* Log Collector Status */}
      <div className="bg-[#0f0f17] border border-[#1f1f2e] rounded-lg p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl text-white mb-2 flex items-center gap-2">
              <Server className="size-5 text-[#4f46e5]" />
              Log Collector Status
            </h2>
            <p className="text-sm text-gray-400">
              Monitor external systems and data source connections
            </p>
          </div>
          <button
            onClick={() => setShowNewCollectorForm(!showNewCollectorForm)}
            className="flex items-center gap-2 px-4 py-2 bg-[#4f46e5] hover:bg-[#6366f1] text-white rounded transition-colors text-sm font-medium"
          >
            <Plus className="size-4" />
            Add Collector
          </button>
        </div>

        {/* Status Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-[#0a0a0f] border border-[#1f1f2e] rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Total Collectors</span>
              <Server className="size-4 text-[#4f46e5]" />
            </div>
            <p className="text-2xl text-white font-bold">{collectors.length}</p>
          </div>
          <div className="bg-[#0a0a0f] border border-[#10b981]/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Connected</span>
              <Wifi className="size-4 text-[#10b981]" />
            </div>
            <p className="text-2xl text-[#10b981] font-bold">{connectedCount}</p>
          </div>
          <div className="bg-[#0a0a0f] border border-gray-700/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Disconnected</span>
              <WifiOff className="size-4 text-gray-400" />
            </div>
            <p className="text-2xl text-gray-400 font-bold">{disconnectedCount}</p>
          </div>
          <div className="bg-[#0a0a0f] border border-[#ef4444]/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Errors</span>
              <AlertTriangle className="size-4 text-[#ef4444]" />
            </div>
            <p className="text-2xl text-[#ef4444] font-bold">{errorCount}</p>
          </div>
        </div>

        {/* Collectors List */}
        <div className="space-y-3">
          {collectors.map((collector) => (
            <div
              key={collector.id}
              className="bg-[#0a0a0f] border border-[#1f1f2e] rounded-lg p-4 hover:border-[#2a2a3a] transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  <div className="p-2 bg-[#1a1a24] rounded">
                    {getTypeIcon(collector.type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-white font-medium">{collector.name}</h3>
                      <span className={`flex items-center gap-1.5 text-xs px-2.5 py-1 border rounded ${getStatusColor(collector.status)}`}>
                        {getStatusIcon(collector.status)}
                        {collector.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span className="flex items-center gap-1.5 font-mono">
                        <Wifi className="size-3" />
                        {collector.sourceIp}
                      </span>
                      <span>•</span>
                      <span>{collector.location}</span>
                      <span>•</span>
                      <span>{collector.logsReceived.toLocaleString()} logs</span>
                      <span>•</span>
                      <span className="text-xs">
                        Last seen: {new Date(collector.lastSeen).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => testConnection(collector.id)}
                    disabled={testingConnection === collector.id}
                    className="p-2 text-gray-400 hover:text-white hover:bg-[#1a1a24] rounded transition-colors disabled:opacity-50"
                    title="Test Connection"
                  >
                    <RefreshCw className={`size-4 ${testingConnection === collector.id ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    className="p-2 text-gray-400 hover:text-white hover:bg-[#1a1a24] rounded transition-colors"
                    title="Edit"
                  >
                    <Edit2 className="size-4" />
                  </button>
                  <button
                    className="p-2 text-gray-400 hover:text-[#ef4444] hover:bg-[#ef4444]/10 rounded transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Add New Collector Form */}
        {showNewCollectorForm && (
          <div className="bg-[#0a0a0f] border border-[#4f46e5]/30 rounded-lg p-6 space-y-4">
            <h3 className="text-white font-medium mb-4">Add New Log Collector</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Collector Name</label>
                <input
                  type="text"
                  placeholder="e.g., Production Web Server 03"
                  className="w-full bg-[#1a1a24] border border-[#2a2a3a] px-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-[#4f46e5] transition-colors rounded"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Collector Type</label>
                <select className="w-full bg-[#1a1a24] border border-[#2a2a3a] px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#4f46e5] transition-colors rounded">
                  <option value="web-server">Web Server</option>
                  <option value="network-device">Network Device</option>
                  <option value="database">Database</option>
                  <option value="firewall">Firewall</option>
                  <option value="endpoint">Endpoint</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Source IP Address</label>
                <input
                  type="text"
                  placeholder="e.g., 192.168.1.12"
                  className="w-full bg-[#1a1a24] border border-[#2a2a3a] px-4 py-2.5 text-sm text-white font-mono placeholder:text-gray-500 focus:outline-none focus:border-[#4f46e5] transition-colors rounded"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Location</label>
                <input
                  type="text"
                  placeholder="e.g., US-East-1"
                  className="w-full bg-[#1a1a24] border border-[#2a2a3a] px-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-[#4f46e5] transition-colors rounded"
                />
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button className="px-4 py-2 bg-[#4f46e5] hover:bg-[#6366f1] text-white rounded transition-colors text-sm font-medium">
                Add Collector
              </button>
              <button
                onClick={() => setShowNewCollectorForm(false)}
                className="px-4 py-2 bg-[#1a1a24] border border-[#2a2a3a] text-gray-300 hover:text-white rounded transition-colors text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* API Key Management */}
      <div className="bg-[#0f0f17] border border-[#1f1f2e] rounded-lg p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl text-white mb-2 flex items-center gap-2">
              <Key className="size-5 text-[#4f46e5]" />
              API Key Management
            </h2>
            <p className="text-sm text-gray-400">
              Manage API keys for secure log ingestion and system access
            </p>
          </div>
          <button
            onClick={() => setShowNewAPIKeyForm(!showNewAPIKeyForm)}
            className="flex items-center gap-2 px-4 py-2 bg-[#4f46e5] hover:bg-[#6366f1] text-white rounded transition-colors text-sm font-medium"
          >
            <Plus className="size-4" />
            Generate API Key
          </button>
        </div>

        {/* API Keys List */}
        <div className="space-y-3">
          {apiKeys.map((apiKey) => (
            <div
              key={apiKey.id}
              className="bg-[#0a0a0f] border border-[#1f1f2e] rounded-lg p-4 hover:border-[#2a2a3a] transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="text-white font-medium mb-2">{apiKey.name}</h3>
                  <div className="flex items-center gap-2 mb-3">
                    <code className="flex-1 bg-[#1a1a24] border border-[#2a2a3a] px-3 py-2 text-sm text-gray-300 font-mono rounded">
                      {visibleKeys.has(apiKey.id) ? apiKey.key : maskAPIKey(apiKey.key)}
                    </code>
                    <button
                      onClick={() => toggleKeyVisibility(apiKey.id)}
                      className="p-2 text-gray-400 hover:text-white hover:bg-[#1a1a24] rounded transition-colors"
                      title={visibleKeys.has(apiKey.id) ? 'Hide Key' : 'Show Key'}
                    >
                      {visibleKeys.has(apiKey.id) ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                    <button
                      onClick={() => copyToClipboard(apiKey.key)}
                      className="p-2 text-gray-400 hover:text-white hover:bg-[#1a1a24] rounded transition-colors"
                      title="Copy to Clipboard"
                    >
                      <Copy className="size-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span>Created: {new Date(apiKey.created).toLocaleDateString()}</span>
                    <span>•</span>
                    <span>Last used: {new Date(apiKey.lastUsed).toLocaleString()}</span>
                  </div>
                </div>
                <button
                  className="p-2 text-gray-400 hover:text-[#ef4444] hover:bg-[#ef4444]/10 rounded transition-colors"
                  title="Revoke Key"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Permissions:</span>
                {apiKey.permissions.map((perm) => (
                  <span
                    key={perm}
                    className="text-xs px-2 py-1 bg-[#1a1a24] text-gray-300 border border-[#2a2a3a] rounded"
                  >
                    {perm}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Generate New API Key Form */}
        {showNewAPIKeyForm && (
          <div className="bg-[#0a0a0f] border border-[#4f46e5]/30 rounded-lg p-6 space-y-4">
            <h3 className="text-white font-medium mb-4">Generate New API Key</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Key Name</label>
                <input
                  type="text"
                  placeholder="e.g., Staging Environment"
                  className="w-full bg-[#1a1a24] border border-[#2a2a3a] px-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-[#4f46e5] transition-colors rounded"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Permissions</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                    <input type="checkbox" className="rounded border-[#2a2a3a]" defaultChecked />
                    <span>log:write - Write log data</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                    <input type="checkbox" className="rounded border-[#2a2a3a]" defaultChecked />
                    <span>log:read - Read log data</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                    <input type="checkbox" className="rounded border-[#2a2a3a]" />
                    <span>alert:read - Read alerts</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                    <input type="checkbox" className="rounded border-[#2a2a3a]" />
                    <span>dashboard:read - Access dashboards</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button className="px-4 py-2 bg-[#4f46e5] hover:bg-[#6366f1] text-white rounded transition-colors text-sm font-medium">
                Generate Key
              </button>
              <button
                onClick={() => setShowNewAPIKeyForm(false)}
                className="px-4 py-2 bg-[#1a1a24] border border-[#2a2a3a] text-gray-300 hover:text-white rounded transition-colors text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* System Configuration */}
      <div className="bg-[#0f0f17] border border-[#1f1f2e] rounded-lg p-6 space-y-6">
        <div>
          <h2 className="text-xl text-white mb-2 flex items-center gap-2">
            <Database className="size-5 text-[#4f46e5]" />
            System Configuration
          </h2>
          <p className="text-sm text-gray-400">
            Configure data retention policies and backend service parameters
          </p>
        </div>

        {/* Data Retention Policy */}
        <div className="bg-[#0a0a0f] border border-[#1f1f2e] rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="size-5 text-[#4f46e5]" />
            <h3 className="text-white font-medium">Data Retention Policy</h3>
          </div>
          
          <div>
            <label className="text-sm text-gray-400 mb-2 block">Log Retention Period (Days)</label>
            <div className="flex items-center gap-4">
              <input
                type="number"
                value={retentionDays}
                onChange={(e) => setRetentionDays(parseInt(e.target.value))}
                min="30"
                max="365"
                className="w-32 bg-[#1a1a24] border border-[#2a2a3a] px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#4f46e5] transition-colors rounded"
              />
              <span className="text-sm text-gray-400">
                Logs older than {retentionDays} days will be automatically archived
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-[#1a1a24] border border-[#2a2a3a] rounded">
            <div>
              <p className="text-sm text-white font-medium mb-1">Enable Automatic Archiving</p>
              <p className="text-xs text-gray-400">Archive old logs to cold storage</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={archiveEnabled}
                onChange={(e) => setArchiveEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[#1a1a24] border border-[#2a2a3a] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-400 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#4f46e5] peer-checked:after:bg-white"></div>
            </label>
          </div>

          <div className="flex items-center justify-between p-4 bg-[#1a1a24] border border-[#2a2a3a] rounded">
            <div>
              <p className="text-sm text-white font-medium mb-1">Enable Log Compression</p>
              <p className="text-xs text-gray-400">Compress logs to reduce storage usage</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={compressionEnabled}
                onChange={(e) => setCompressionEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[#1a1a24] border border-[#2a2a3a] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-400 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#4f46e5] peer-checked:after:bg-white"></div>
            </label>
          </div>
        </div>

        {/* Alert Configuration */}
        <div className="bg-[#0a0a0f] border border-[#1f1f2e] rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="size-5 text-[#f59e0b]" />
            <h3 className="text-white font-medium">Alert Configuration</h3>
          </div>

          <div>
            <label className="text-sm text-gray-400 mb-2 block">Alert Retention Period (Days)</label>
            <input
              type="number"
              defaultValue={180}
              min="30"
              max="730"
              className="w-32 bg-[#1a1a24] border border-[#2a2a3a] px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#4f46e5] transition-colors rounded"
            />
          </div>

          <div>
            <label className="text-sm text-gray-400 mb-2 block">Maximum Alerts Per Day</label>
            <input
              type="number"
              defaultValue={10000}
              min="100"
              max="100000"
              step="100"
              className="w-32 bg-[#1a1a24] border border-[#2a2a3a] px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#4f46e5] transition-colors rounded"
            />
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center gap-3 pt-2">
          <button className="flex items-center gap-2 px-6 py-2.5 bg-[#4f46e5] hover:bg-[#6366f1] text-white rounded transition-colors font-medium">
            <Save className="size-4" />
            Save Configuration
          </button>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <CheckCircle2 className="size-4 text-[#10b981]" />
            <span>All changes saved automatically</span>
          </div>
        </div>
      </div>
    </div>
  );
}
