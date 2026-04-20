import { useState } from 'react';
import { Search, Calendar, Filter, Download, TrendingUp, Activity, AlertTriangle, Database, FileText, BarChart3, X, Plus } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';

interface QueryFilter {
  id: string;
  field: string;
  operator: string;
  value: string;
}

interface LogEntry {
  id: string;
  timestamp: string;
  sourceIp: string;
  eventType: string;
  severity: string;
  message: string;
  destination: string;
}

interface ReportData {
  timestamp: string;
  logCount: number;
  alerts: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

// Mock historical data for different time periods
const generateMockData = (startDate: Date, endDate: Date): ReportData[] => {
  const data: ReportData[] = [];
  const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  
  for (let i = 0; i <= Math.min(daysDiff, 30); i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    
    data.push({
      timestamp: date.toISOString().split('T')[0],
      logCount: Math.floor(Math.random() * 5000) + 3000,
      alerts: Math.floor(Math.random() * 150) + 50,
      critical: Math.floor(Math.random() * 20) + 5,
      high: Math.floor(Math.random() * 40) + 15,
      medium: Math.floor(Math.random() * 60) + 20,
      low: Math.floor(Math.random() * 30) + 10,
    });
  }
  
  return data;
};

const mockLogs: LogEntry[] = [
  {
    id: 'log-001',
    timestamp: '2026-03-04T14:23:45Z',
    sourceIp: '192.168.1.105',
    eventType: 'Failed Login',
    severity: 'high',
    message: 'Multiple failed authentication attempts detected',
    destination: 'auth-server-01',
  },
  {
    id: 'log-002',
    timestamp: '2026-03-04T14:18:32Z',
    sourceIp: '10.0.0.45',
    eventType: 'SQL Injection',
    severity: 'critical',
    message: 'SQL injection attempt in login form',
    destination: 'web-app-db',
  },
  {
    id: 'log-003',
    timestamp: '2026-03-04T14:15:21Z',
    sourceIp: '172.16.0.88',
    eventType: 'Port Scan',
    severity: 'medium',
    message: 'Port scanning activity detected from external IP',
    destination: 'firewall-01',
  },
  {
    id: 'log-004',
    timestamp: '2026-03-04T14:12:10Z',
    sourceIp: '192.168.1.200',
    eventType: 'Access Denied',
    severity: 'low',
    message: 'User attempted to access restricted resource',
    destination: 'file-server-03',
  },
  {
    id: 'log-005',
    timestamp: '2026-03-04T14:08:55Z',
    sourceIp: '203.0.113.45',
    eventType: 'DDoS Attack',
    severity: 'critical',
    message: 'Distributed denial of service attack in progress',
    destination: 'web-gateway',
  },
  {
    id: 'log-006',
    timestamp: '2026-03-04T14:05:33Z',
    sourceIp: '192.168.2.15',
    eventType: 'Malware Detection',
    severity: 'high',
    message: 'Malicious file detected and quarantined',
    destination: 'endpoint-42',
  },
  {
    id: 'log-007',
    timestamp: '2026-03-04T14:02:18Z',
    sourceIp: '10.0.1.99',
    eventType: 'Privilege Escalation',
    severity: 'critical',
    message: 'Unauthorized privilege escalation attempt',
    destination: 'domain-controller',
  },
  {
    id: 'log-008',
    timestamp: '2026-03-04T13:58:45Z',
    sourceIp: '172.16.5.22',
    eventType: 'Data Exfiltration',
    severity: 'high',
    message: 'Unusual outbound data transfer detected',
    destination: 'data-server-05',
  },
];

export function ReportsPage() {
  const [filters, setFilters] = useState<QueryFilter[]>([
    { id: '1', field: 'timestamp', operator: 'between', value: '' },
  ]);
  const [startDate, setStartDate] = useState('2026-02-25');
  const [endDate, setEndDate] = useState('2026-03-04');
  const [reportGenerated, setReportGenerated] = useState(false);
  const [reportData, setReportData] = useState<ReportData[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>(mockLogs);
  const [selectedEventTypes, setSelectedEventTypes] = useState<string[]>([]);
  const [selectedSeverities, setSelectedSeverities] = useState<string[]>([]);
  const [sourceIpFilter, setSourceIpFilter] = useState('');

  const eventTypes = ['Failed Login', 'SQL Injection', 'Port Scan', 'Access Denied', 'DDoS Attack', 'Malware Detection', 'Privilege Escalation', 'Data Exfiltration'];
  const severities = ['critical', 'high', 'medium', 'low'];

  const addFilter = () => {
    setFilters([
      ...filters,
      { id: Date.now().toString(), field: 'eventType', operator: 'equals', value: '' },
    ]);
  };

  const removeFilter = (id: string) => {
    setFilters(filters.filter(f => f.id !== id));
  };

  const updateFilter = (id: string, field: keyof QueryFilter, value: string) => {
    setFilters(filters.map(f => f.id === id ? { ...f, [field]: value } : f));
  };

  const generateReport = () => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const data = generateMockData(start, end);
    setReportData(data);
    
    // Apply filters to logs
    let filtered = [...mockLogs];
    
    if (sourceIpFilter) {
      filtered = filtered.filter(log => log.sourceIp.includes(sourceIpFilter));
    }
    
    if (selectedEventTypes.length > 0) {
      filtered = filtered.filter(log => selectedEventTypes.includes(log.eventType));
    }
    
    if (selectedSeverities.length > 0) {
      filtered = filtered.filter(log => selectedSeverities.includes(log.severity));
    }
    
    setFilteredLogs(filtered);
    setReportGenerated(true);
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

  const calculateStats = () => {
    if (reportData.length === 0) return null;
    
    const totalLogs = reportData.reduce((sum, d) => sum + d.logCount, 0);
    const totalAlerts = reportData.reduce((sum, d) => sum + d.alerts, 0);
    const totalCritical = reportData.reduce((sum, d) => sum + d.critical, 0);
    const totalHigh = reportData.reduce((sum, d) => sum + d.high, 0);
    const avgLogsPerDay = Math.round(totalLogs / reportData.length);
    const avgAlertsPerDay = Math.round(totalAlerts / reportData.length);
    
    return {
      totalLogs,
      totalAlerts,
      totalCritical,
      totalHigh,
      avgLogsPerDay,
      avgAlertsPerDay,
    };
  };

  const stats = calculateStats();

  const toggleEventType = (eventType: string) => {
    setSelectedEventTypes(prev =>
      prev.includes(eventType)
        ? prev.filter(t => t !== eventType)
        : [...prev, eventType]
    );
  };

  const toggleSeverity = (severity: string) => {
    setSelectedSeverities(prev =>
      prev.includes(severity)
        ? prev.filter(s => s !== severity)
        : [...prev, severity]
    );
  };

  const exportReport = () => {
    // Create CSV content
    const headers = ['Timestamp', 'Source IP', 'Event Type', 'Severity', 'Message', 'Destination'];
    const csvContent = [
      headers.join(','),
      ...filteredLogs.map(log =>
        [log.timestamp, log.sourceIp, log.eventType, log.severity, log.message, log.destination]
          .map(field => `"${field}"`)
          .join(',')
      ),
    ].join('\n');
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `security-report-${startDate}-to-${endDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl text-white mb-2">Reports & Analytics</h1>
          <p className="text-gray-400">
            Historical log analysis and security trend reporting • MongoDB time-series data
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-[#4f46e5]/20 border border-[#4f46e5]/30 rounded">
          <Database className="size-5 text-[#4f46e5]" />
          <span className="text-sm text-[#4f46e5] font-medium">Time-Series Analysis</span>
        </div>
      </div>

      {/* Query Builder */}
      <div className="bg-[#0f0f17] border border-[#1f1f2e] rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Filter className="size-5 text-[#4f46e5]" />
            <h2 className="text-xl text-white">Advanced Query Builder</h2>
          </div>
          <button
            onClick={addFilter}
            className="flex items-center gap-2 px-3 py-2 bg-[#1a1a24] border border-[#2a2a3a] text-gray-300 hover:text-white hover:border-[#4f46e5] transition-colors rounded text-sm"
          >
            <Plus className="size-4" />
            Add Filter
          </button>
        </div>

        {/* Date Range Filter */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-[#0a0a0f] border border-[#1f1f2e] rounded">
          <div>
            <label className="text-sm text-gray-400 mb-2 block flex items-center gap-2">
              <Calendar className="size-4" />
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-[#1a1a24] border border-[#2a2a3a] px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#4f46e5] transition-colors rounded"
            />
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-2 block flex items-center gap-2">
              <Calendar className="size-4" />
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-[#1a1a24] border border-[#2a2a3a] px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#4f46e5] transition-colors rounded"
            />
          </div>
        </div>

        {/* Source IP Filter */}
        <div className="p-4 bg-[#0a0a0f] border border-[#1f1f2e] rounded">
          <label className="text-sm text-gray-400 mb-2 block">Source IP Address</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-500" />
            <input
              type="text"
              placeholder="Filter by source IP (e.g., 192.168.1.105)"
              value={sourceIpFilter}
              onChange={(e) => setSourceIpFilter(e.target.value)}
              className="w-full bg-[#1a1a24] border border-[#2a2a3a] pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-[#4f46e5] transition-colors rounded"
            />
          </div>
        </div>

        {/* Event Type Filter */}
        <div className="p-4 bg-[#0a0a0f] border border-[#1f1f2e] rounded">
          <label className="text-sm text-gray-400 mb-3 block">Event Type</label>
          <div className="flex flex-wrap gap-2">
            {eventTypes.map((eventType) => (
              <button
                key={eventType}
                onClick={() => toggleEventType(eventType)}
                className={`px-3 py-2 text-sm rounded border transition-colors ${
                  selectedEventTypes.includes(eventType)
                    ? 'bg-[#4f46e5] text-white border-[#4f46e5]'
                    : 'bg-[#1a1a24] text-gray-300 border-[#2a2a3a] hover:border-[#4f46e5]'
                }`}
              >
                {eventType}
              </button>
            ))}
          </div>
        </div>

        {/* Severity Filter */}
        <div className="p-4 bg-[#0a0a0f] border border-[#1f1f2e] rounded">
          <label className="text-sm text-gray-400 mb-3 block">Severity Level</label>
          <div className="flex flex-wrap gap-2">
            {severities.map((severity) => (
              <button
                key={severity}
                onClick={() => toggleSeverity(severity)}
                className={`px-4 py-2 text-sm rounded border transition-colors ${
                  selectedSeverities.includes(severity)
                    ? `${getSeverityColor(severity)} font-medium`
                    : 'bg-[#1a1a24] text-gray-300 border-[#2a2a3a] hover:border-[#4f46e5]'
                }`}
              >
                {severity.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Generate Report Button */}
        <button
          onClick={generateReport}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[#4f46e5] hover:bg-[#6366f1] text-white font-medium rounded transition-colors"
        >
          <BarChart3 className="size-5" />
          Generate Report
        </button>
      </div>

      {/* Report Results */}
      {reportGenerated && stats && (
        <>
          {/* Summary Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-[#0f0f17] border border-[#1f1f2e] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="size-5 text-[#3b82f6]" />
                <span className="text-xs text-gray-400">Total Logs</span>
              </div>
              <p className="text-2xl text-white font-bold">{stats.totalLogs.toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-1">{stats.avgLogsPerDay.toLocaleString()}/day avg</p>
            </div>

            <div className="bg-[#0f0f17] border border-[#1f1f2e] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="size-5 text-[#f59e0b]" />
                <span className="text-xs text-gray-400">Total Alerts</span>
              </div>
              <p className="text-2xl text-white font-bold">{stats.totalAlerts.toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-1">{stats.avgAlertsPerDay}/day avg</p>
            </div>

            <div className="bg-[#0f0f17] border border-[#1f1f2e] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="size-5 rounded bg-[#ef4444]/20 border border-[#ef4444]/30" />
                <span className="text-xs text-gray-400">Critical</span>
              </div>
              <p className="text-2xl text-[#ef4444] font-bold">{stats.totalCritical}</p>
              <p className="text-xs text-gray-500 mt-1">Highest priority</p>
            </div>

            <div className="bg-[#0f0f17] border border-[#1f1f2e] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="size-5 rounded bg-[#f59e0b]/20 border border-[#f59e0b]/30" />
                <span className="text-xs text-gray-400">High</span>
              </div>
              <p className="text-2xl text-[#f59e0b] font-bold">{stats.totalHigh}</p>
              <p className="text-xs text-gray-500 mt-1">Urgent attention</p>
            </div>

            <div className="bg-[#0f0f17] border border-[#1f1f2e] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="size-5 text-[#10b981]" />
                <span className="text-xs text-gray-400">Time Range</span>
              </div>
              <p className="text-2xl text-white font-bold">{reportData.length}</p>
              <p className="text-xs text-gray-500 mt-1">Days analyzed</p>
            </div>

            <div className="bg-[#0f0f17] border border-[#1f1f2e] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="size-5 text-[#4f46e5]" />
                <span className="text-xs text-gray-400">Results</span>
              </div>
              <p className="text-2xl text-white font-bold">{filteredLogs.length}</p>
              <p className="text-xs text-gray-500 mt-1">Matching logs</p>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Log Throughput Chart */}
            <div className="bg-[#0f0f17] border border-[#1f1f2e] rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg text-white font-medium">Log Throughput Over Time</h3>
                <Activity className="size-5 text-[#4f46e5]" />
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={reportData}>
                  <defs>
                    <linearGradient id="colorLogs" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f1f2e" />
                  <XAxis dataKey="timestamp" stroke="#666" style={{ fontSize: '12px' }} />
                  <YAxis stroke="#666" style={{ fontSize: '12px' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1a1a24',
                      border: '1px solid #2a2a3a',
                      borderRadius: '8px',
                      color: '#fff',
                    }}
                  />
                  <Area type="monotone" dataKey="logCount" stroke="#4f46e5" fillOpacity={1} fill="url(#colorLogs)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Alert Trends Chart */}
            <div className="bg-[#0f0f17] border border-[#1f1f2e] rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg text-white font-medium">Alert Trends by Severity</h3>
                <AlertTriangle className="size-5 text-[#f59e0b]" />
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={reportData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f1f2e" />
                  <XAxis dataKey="timestamp" stroke="#666" style={{ fontSize: '12px' }} />
                  <YAxis stroke="#666" style={{ fontSize: '12px' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1a1a24',
                      border: '1px solid #2a2a3a',
                      borderRadius: '8px',
                      color: '#fff',
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="critical" stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444' }} />
                  <Line type="monotone" dataKey="high" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b' }} />
                  <Line type="monotone" dataKey="medium" stroke="#eab308" strokeWidth={2} dot={{ fill: '#eab308' }} />
                  <Line type="monotone" dataKey="low" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Daily Alert Distribution */}
            <div className="bg-[#0f0f17] border border-[#1f1f2e] rounded-lg p-6 lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg text-white font-medium">Daily Alert Distribution</h3>
                <BarChart3 className="size-5 text-[#4f46e5]" />
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={reportData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f1f2e" />
                  <XAxis dataKey="timestamp" stroke="#666" style={{ fontSize: '12px' }} />
                  <YAxis stroke="#666" style={{ fontSize: '12px' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1a1a24',
                      border: '1px solid #2a2a3a',
                      borderRadius: '8px',
                      color: '#fff',
                    }}
                  />
                  <Legend />
                  <Bar dataKey="critical" stackId="a" fill="#ef4444" />
                  <Bar dataKey="high" stackId="a" fill="#f59e0b" />
                  <Bar dataKey="medium" stackId="a" fill="#eab308" />
                  <Bar dataKey="low" stackId="a" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Filtered Logs Table */}
          <div className="bg-[#0f0f17] border border-[#1f1f2e] rounded-lg overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-[#1f1f2e]">
              <h3 className="text-lg text-white font-medium">Filtered Log Results</h3>
              <button
                onClick={exportReport}
                className="flex items-center gap-2 px-4 py-2 bg-[#1a1a24] border border-[#2a2a3a] text-gray-300 hover:text-white hover:border-[#4f46e5] transition-colors rounded text-sm"
              >
                <Download className="size-4" />
                Export CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#1f1f2e] bg-[#0a0a0f]">
                    <th className="text-left py-3 px-6 text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Timestamp
                    </th>
                    <th className="text-left py-3 px-6 text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Source IP
                    </th>
                    <th className="text-left py-3 px-6 text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Event Type
                    </th>
                    <th className="text-left py-3 px-6 text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Severity
                    </th>
                    <th className="text-left py-3 px-6 text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Message
                    </th>
                    <th className="text-left py-3 px-6 text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Destination
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="border-b border-[#1f1f2e] hover:bg-[#1a1a24] transition-colors">
                      <td className="py-3 px-6 text-sm text-gray-300 font-mono">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="py-3 px-6 text-sm text-gray-300 font-mono">
                        {log.sourceIp}
                      </td>
                      <td className="py-3 px-6 text-sm text-white">
                        {log.eventType}
                      </td>
                      <td className="py-3 px-6">
                        <span className={`text-xs px-2.5 py-1 border rounded ${getSeverityColor(log.severity)}`}>
                          {log.severity.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-6 text-sm text-gray-300">
                        {log.message}
                      </td>
                      <td className="py-3 px-6 text-sm text-gray-400 font-mono">
                        {log.destination}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Empty State */}
      {!reportGenerated && (
        <div className="bg-[#0f0f17] border border-[#1f1f2e] rounded-lg p-12 text-center">
          <BarChart3 className="size-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg text-white mb-2">No Report Generated</h3>
          <p className="text-gray-400 mb-4">
            Configure your query filters and click "Generate Report" to analyze historical log data
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#1a1a24] border border-[#2a2a3a] rounded text-sm text-gray-400">
            <Database className="size-4" />
            MongoDB Time-Series Collection Ready
          </div>
        </div>
      )}
    </div>
  );
}
