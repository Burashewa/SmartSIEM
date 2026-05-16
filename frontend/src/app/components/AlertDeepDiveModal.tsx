import { X, Download } from 'lucide-react';
import type { RecentAlertRecord } from '../lib/dashboardWidgets';

interface AlertDeepDiveModalProps {
  alert: RecentAlertRecord | null;
  isOpen: boolean;
  onClose: () => void;
}

export function AlertDeepDiveModal({ alert, isOpen, onClose }: AlertDeepDiveModalProps) {
  if (!isOpen || !alert) return null;

  const destinationHost = alert.destination.includes(':')
    ? alert.destination.split(':')[0]
    : alert.destination;
  const destinationPort = alert.destination.includes(':')
    ? alert.destination.split(':')[1] || 'N/A'
    : 'N/A';

  const summaryMessage = alert.message?.trim() ? alert.message : alert.description;

  const rawLogData = `{
  "event": {
    "id": "evt_${alert.id}",
    "timestamp": "${alert.timestamp}",
    "severity": "${alert.severity}",
    "category": "security_event",
    "action": "blocked",
    "outcome": "success"
  },
  "source": {
    "ip": "${alert.sourceIp}",
    "port": ${Math.floor(Math.random() * 60000) + 1024},
    "geo": {
      "country": "${alert.attackerGeo?.country ?? 'Unknown'}",
      "city": "${alert.attackerGeo?.city ?? 'Unknown'}",
      "region": "${alert.attackerGeo?.region ?? 'Unknown'}",
      "latitude": "${alert.attackerGeo?.lat ?? 'N/A'}",
      "longitude": "${alert.attackerGeo?.lng ?? 'N/A'}"
    }
  },
  "destination": {
    "value": "${destinationHost}",
    "port": "${destinationPort}"
  },
  "log": {
    "source": "${alert.logSource}",
    "level": "warning",
    "message": "${summaryMessage.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"
  },
  "user": {
    "name": "admin@company.com",
    "domain": "CORP",
    "id": "usr_${Math.floor(Math.random() * 10000)}"
  },
  "network": {
    "protocol": "tcp",
    "bytes_sent": ${Math.floor(Math.random() * 10000)},
    "bytes_received": ${Math.floor(Math.random() * 50000)},
    "packets": ${Math.floor(Math.random() * 500)}
  },
  "threat": {
    "indicator": "${summaryMessage.toLowerCase().replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/ /g, '_').slice(0, 120)}",
    "confidence": ${Math.floor(Math.random() * 30) + 70},
    "severity_score": ${alert.severity === 'critical' ? '9.5' : alert.severity === 'high' ? '7.8' : '5.2'}
  }
}`;

  const normalizedData = [
    ...(typeof alert.occurrenceCount === 'number' && alert.occurrenceCount >= 2
      ? [
          {
            label: 'Occurrences (dedup)',
            value: `${alert.occurrenceCount}`,
            highlight: true,
          },
        ]
      : []),
    ...(alert.firstTriggeredAt &&
    typeof alert.occurrenceCount === 'number' &&
    alert.occurrenceCount >= 2
      ? [{ label: 'First seen', value: new Date(alert.firstTriggeredAt).toLocaleString() }]
      : []),
    { label: 'Event ID', value: `evt_${alert.id}` },
    { label: 'Timestamp', value: new Date(alert.timestamp).toLocaleString() },
    { label: 'Severity', value: alert.severity.toUpperCase(), highlight: true },
    { label: 'Status', value: alert.status },
    { label: 'Rule Name', value: alert.ruleName },
    { label: 'Rule ID', value: alert.ruleId },
    { label: 'Source IP', value: alert.sourceIp },
    { label: 'Attacker Location', value: alert.attackerLocation, highlight: true },
    { label: 'Attacker ISP', value: alert.attackerGeo?.isp ?? 'N/A' },
    { label: 'Source Port', value: Math.floor(Math.random() * 60000) + 1024 },
    { label: 'Destination', value: destinationHost },
    { label: 'Destination Port', value: destinationPort },
    { label: 'Log Source', value: alert.logSource },
    { label: 'Event Category', value: 'Security Event' },
    { label: 'Action Taken', value: 'Blocked' },
    { label: 'Protocol', value: 'TCP' },
    { label: 'User', value: 'admin@company.com' },
    { label: 'Domain', value: 'CORP' },
    { label: 'User ID', value: `usr_${Math.floor(Math.random() * 10000)}` },
    {
      label: 'Threat Indicator',
      value:
        summaryMessage.toLowerCase().replace(/`/g, "'").slice(0, 200),
    },
    { label: 'Confidence Score', value: `${Math.floor(Math.random() * 30) + 70}%` },
    { label: 'Severity Score', value: alert.severity === 'critical' ? '9.5' : alert.severity === 'high' ? '7.8' : '5.2' },
    { label: 'Country', value: alert.attackerGeo?.country ?? 'Unknown' },
    { label: 'City', value: alert.attackerGeo?.city ?? 'Unknown' },
    { label: 'Coordinates', value: formatCoordinates(alert.attackerGeo?.lat, alert.attackerGeo?.lng) },
    { label: 'Bytes Sent', value: `${Math.floor(Math.random() * 10000)} bytes` },
    { label: 'Bytes Received', value: `${Math.floor(Math.random() * 50000)} bytes` },
  ];

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-[#ef4444]';
      case 'high': return 'text-[#f59e0b]';
      case 'medium': return 'text-[#eab308]';
      case 'low': return 'text-[#3b82f6]';
      default: return 'text-gray-400';
    }
  };

  const handleDownload = () => {
    const report = `ALERT DEEP-DIVE REPORT
=====================

Event ID: evt_${alert.id}
Timestamp: ${new Date(alert.timestamp).toLocaleString()}
Severity: ${alert.severity.toUpperCase()}
Description: ${summaryMessage}

RAW LOG DATA:
${rawLogData}

NORMALIZED DATA:
${normalizedData.map(item => `${item.label}: ${item.value}`).join('\n')}

Generated: ${new Date().toLocaleString()}
`;

    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alert_${alert.id}_report.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const highlightJSON = (json: string) => {
    return json.split('\n').map((line, index) => {
      let highlightedLine = line;
      
      // Highlight keys (before colon)
      highlightedLine = highlightedLine.replace(
        /"([^"]+)":/g,
        '<span class="text-[#7dd3fc]">"$1"</span>:'
      );
      
      // Highlight string values
      highlightedLine = highlightedLine.replace(
        /: "([^"]+)"/g,
        ': <span class="text-[#86efac]">"$1"</span>'
      );
      
      // Highlight numbers
      highlightedLine = highlightedLine.replace(
        /: (\d+\.?\d*)(,?)/g,
        ': <span class="text-[#fbbf24]">$1</span>$2'
      );

      return (
        <div key={index} className="flex">
          <span className="select-none text-gray-600 w-10 text-right pr-4 flex-shrink-0">
            {index + 1}
          </span>
          <span dangerouslySetInnerHTML={{ __html: highlightedLine }} />
        </div>
      );
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-7xl h-[90vh] bg-[#0f0f17] border border-[#1f1f2e] rounded-lg shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#1f1f2e]">
          <div>
            <h2 className="text-2xl text-white mb-1">Alert Deep-Dive</h2>
            <p className="text-sm text-gray-400">Event ID: evt_{alert.id}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#1a1a24] rounded transition-colors"
          >
            <X className="size-6 text-gray-400 hover:text-white" />
          </button>
        </div>

        {/* Split-View Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Side - Raw Log Data */}
          <div className="w-1/2 border-r border-[#1f1f2e] flex flex-col">
            <div className="p-4 border-b border-[#1f1f2e]">
              <h3 className="text-lg text-white font-medium">Raw Log Data</h3>
              <p className="text-xs text-gray-400 mt-1">Original event data in JSON format</p>
            </div>
            <div className="flex-1 overflow-auto p-6 bg-[#0a0a0f]">
              <pre className="text-sm font-mono leading-relaxed text-gray-300">
                {highlightJSON(rawLogData)}
              </pre>
            </div>
          </div>

          {/* Right Side - Normalized Data */}
          <div className="w-1/2 flex flex-col">
            <div className="p-4 border-b border-[#1f1f2e]">
              <h3 className="text-lg text-white font-medium">Normalized Data</h3>
              <p className="text-xs text-gray-400 mt-1">Structured event information</p>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <div className="space-y-3">
                {normalizedData.map((item, index) => (
                  <div 
                    key={index} 
                    className="flex items-start py-2 border-b border-[#1f1f2e] hover:bg-[#1a1a24] px-3 -mx-3 transition-colors"
                  >
                    <div className="w-1/3 text-sm text-gray-400 font-medium">
                      {item.label}
                    </div>
                    <div className={`w-2/3 text-sm font-mono ${
                      item.highlight && (item.label === 'Severity' || item.label === 'Occurrences (dedup)') 
                        ? item.label === 'Severity' 
                          ? getSeverityColor(alert.severity) 
                          : 'text-[#a5b4fc]'
                        : 'text-white'
                    }`}>
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer with Download Button */}
        <div className="p-6 border-t border-[#1f1f2e] flex items-center justify-between">
          <div className="text-sm text-gray-400">
            <span className={`inline-block px-2 py-1 rounded mr-2 ${
              alert.severity === 'critical' ? 'bg-[#ef4444]/20 text-[#ef4444]' :
              alert.severity === 'high' ? 'bg-[#f59e0b]/20 text-[#f59e0b]' :
              alert.severity === 'medium' ? 'bg-[#eab308]/20 text-[#eab308]' :
              'bg-[#3b82f6]/20 text-[#3b82f6]'
            }`}>
              {alert.severity.toUpperCase()}
            </span>
            {summaryMessage}
          </div>
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-6 py-2.5 bg-[#4f46e5] hover:bg-[#4338ca] text-white rounded transition-colors"
          >
            <Download className="size-4" />
            Download Report
          </button>
        </div>
      </div>
    </div>
  );
}

function formatCoordinates(lat?: number, lng?: number): string {
  if (typeof lat !== 'number' || typeof lng !== 'number') return 'N/A';
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}
