import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Globe, AlertTriangle, TrendingUp, RefreshCw, Activity, Target,
} from 'lucide-react';
import { fetchAlerts, type BackendAlertRecord } from '../api/dashboard';

// ─── Types ──────────────────────────────────────────────────────────────────

interface TopAttacker {
  ip: string;
  country: string;
  alertCount: number;
  threatTypes: string[];
  lastSeen: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

interface AttackPattern {
  type: string;
  count: number;
  percentage: number;
  color: string;
}

interface GeoEntry {
  country: string;
  count: number;
  percentage: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const readString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

const humanizeRule = (ruleId: string | undefined): string => {
  if (!ruleId) return 'Unknown';
  return ruleId
    .replace(/[-_]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => `${w.charAt(0).toUpperCase()}${w.slice(1)}`)
    .join(' ');
};

const deriveCategory = (alert: BackendAlertRecord): string => {
  const ctx = typeof alert.context === 'object' && alert.context
    ? (alert.context as Record<string, unknown>) : {};
  const ruleName = readString(alert.rule_name) ?? humanizeRule(readString(alert.rule_id));
  const eventType = readString(ctx.event_type as string) ?? '';
  const combined = (ruleName + ' ' + eventType).toLowerCase();
  if (combined.includes('brute') || combined.includes('auth_fail') || combined.includes('login'))
    return 'Brute Force';
  if (combined.includes('access_deny') || combined.includes('unauthorized'))
    return 'Unauthorized Access';
  if (combined.includes('app_error') || combined.includes('injection') || combined.includes('sql'))
    return 'Application Attack';
  if (combined.includes('scan') || combined.includes('port'))
    return 'Reconnaissance';
  return humanizeRule(readString(alert.rule_id)) || 'Unknown Threat';
};

const deriveSeverity = (s: string): TopAttacker['severity'] => {
  const n = s.toLowerCase();
  if (n === 'critical') return 'critical';
  if (n === 'high') return 'high';
  if (n === 'medium') return 'medium';
  return 'low';
};

const CATEGORY_COLORS: Record<string, string> = {
  'Brute Force':        '#ef4444',
  'Unauthorized Access':'#f59e0b',
  'Application Attack': '#8b5cf6',
  'Reconnaissance':     '#3b82f6',
  'Unknown Threat':     '#6b7280',
};

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'text-[#ef4444]',
  high:     'text-[#f59e0b]',
  medium:   'text-[#eab308]',
  low:      'text-[#3b82f6]',
};

// ─── Data derivation from alerts ─────────────────────────────────────────────

const deriveIntelligence = (raw: BackendAlertRecord[]) => {
  const ipAggMap = new Map<string, {
    alert: BackendAlertRecord;
    count: number;
    firstSeen: string;
    lastSeen: string;
    categories: Set<string>;
  }>();

  for (const alert of raw) {
    const ctx = typeof alert.context === 'object' && alert.context
      ? (alert.context as Record<string, unknown>) : {};
    const ip =
      readString(alert.ip) ??
      readString(ctx.ip as string) ??
      readString(ctx.sourceIp as string);
    if (!ip || ip === 'Unknown') continue;

    const ts = alert.trigger_time ?? alert.triggeredAt ?? new Date().toISOString();
    const cat = deriveCategory(alert);

    if (ipAggMap.has(ip)) {
      const entry = ipAggMap.get(ip)!;
      entry.count += 1;
      entry.categories.add(cat);
      if (new Date(ts) < new Date(entry.firstSeen)) entry.firstSeen = ts;
      if (new Date(ts) > new Date(entry.lastSeen)) entry.lastSeen = ts;
    } else {
      ipAggMap.set(ip, {
        alert,
        count: 1,
        firstSeen: ts,
        lastSeen: ts,
        categories: new Set([cat]),
      });
    }
  }

  const topAttackers: TopAttacker[] = Array.from(ipAggMap.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8)
    .map(([ip, data]) => ({
      ip,
      country: readString(data.alert.geo?.country) ?? 'Unknown',
      alertCount: data.count,
      threatTypes: Array.from(data.categories),
      lastSeen: new Date(data.lastSeen).toLocaleString(),
      severity: deriveSeverity(readString(data.alert.severity) ?? 'low'),
    }));

  // ── Attack patterns ───────────────────────────────────────────────────────
  const patternMap = new Map<string, number>();
  for (const alert of raw) {
    const cat = deriveCategory(alert);
    patternMap.set(cat, (patternMap.get(cat) ?? 0) + 1);
  }
  const total = raw.length || 1;
  const patterns: AttackPattern[] = Array.from(patternMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({
      type,
      count,
      percentage: Math.round((count / total) * 100),
      color: CATEGORY_COLORS[type] ?? '#6b7280',
    }));

  // ── Geo breakdown ─────────────────────────────────────────────────────────
  const geoMap = new Map<string, number>();
  for (const alert of raw) {
    const country = readString(alert.geo?.country) ?? 'Unknown';
    geoMap.set(country, (geoMap.get(country) ?? 0) + 1);
  }
  const geoEntries: GeoEntry[] = Array.from(geoMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([country, count]) => ({
      country,
      count,
      percentage: Math.round((count / total) * 100),
    }));

  const highSeverityCount = raw.filter((alert) => {
    const s = readString(alert.severity)?.toLowerCase() ?? '';
    return s === 'critical' || s === 'high';
  }).length;

  return {
    uniqueSourceIps: ipAggMap.size,
    highSeverityCount,
    topAttackers,
    patterns,
    geoEntries,
  };
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  icon: Icon, label, value, sub, accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  accent: string;
}) {
  return (
    <div
      className="bg-[#0f0f17] border border-[#1f1f2e] p-5 relative overflow-hidden"
      style={{ borderLeftColor: accent, borderLeftWidth: 3 }}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs text-gray-400 uppercase tracking-widest">{label}</span>
        <Icon className="size-4" style={{ color: accent }} />
      </div>
      <p className="text-3xl font-semibold text-white mb-1">{value}</p>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
      {/* Subtle accent glow */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px opacity-40"
        style={{ background: `linear-gradient(to right, ${accent}, transparent)` }}
      />
    </div>
  );
}

function MiniBar({ percentage, color }: { percentage: number; color: string }) {
  return (
    <div className="w-full bg-[#1a1a24] h-1.5 mt-2">
      <div
        className="h-1.5 transition-all duration-700"
        style={{ width: `${percentage}%`, backgroundColor: color }}
      />
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ThreatIntelligencePage() {
  const [rawAlerts, setRawAlerts] = useState<BackendAlertRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Fetch ────────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchAlerts();
      setRawAlerts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load threat intelligence');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchAlerts();
        if (cancelled) return;
        setRawAlerts(data);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load threat intelligence');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void run();
    return () => { cancelled = true; };
  }, []);

  // ── Derived intelligence ─────────────────────────────────────────────────

  const { uniqueSourceIps, highSeverityCount, topAttackers, patterns, geoEntries } =
    useMemo(() => deriveIntelligence(rawAlerts), [rawAlerts]);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="bg-[#0f0f17] border border-[#1f1f2e] p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-medium text-white">Threat Intelligence</h2>
            <p className="text-sm text-gray-400 mt-1">
              Attack patterns, top sources, and geographic breakdown from alerts
            </p>
          </div>
          <button
            onClick={loadData}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-[#1a1a24] hover:bg-[#2a2a3a] border border-[#2a2a3a] text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`size-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Loading / Error ──────────────────────────────────────────────── */}
      {isLoading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[100px] animate-pulse bg-[#1a1a24] border border-[#1f1f2e]" />
          ))}
        </div>
      )}

      {error && !isLoading && (
        <div className="bg-[#0f0f17] border border-[#1f1f2e] p-8 text-center">
          <AlertTriangle className="size-10 text-[#ef4444] mx-auto mb-3" />
          <p className="text-[#fca5a5] mb-4">{error}</p>
          <button onClick={loadData} className="px-4 py-2 bg-[#4f46e5] text-white text-sm">
            Retry
          </button>
        </div>
      )}

      {!isLoading && !error && (
        <>
          {/* ── Stat Cards ────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={Target}
              label="Unique Source IPs"
              value={uniqueSourceIps}
              sub="Distinct attacker addresses"
              accent="#4f46e5"
            />
            <StatCard
              icon={AlertTriangle}
              label="High Severity"
              value={highSeverityCount}
              sub="Critical and high alerts"
              accent="#ef4444"
            />
            <StatCard
              icon={Globe}
              label="Countries"
              value={geoEntries.filter((g) => g.country !== 'Unknown').length}
              sub="Attack origin countries"
              accent="#f59e0b"
            />
            <StatCard
              icon={Activity}
              label="Total Alerts"
              value={rawAlerts.length}
              sub="From detection engine"
              accent="#10b981"
            />
          </div>

          {/* ── Three-column middle section ───────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Attack Patterns */}
            <div className="bg-[#0f0f17] border border-[#1f1f2e] p-6">
              <div className="flex items-center gap-2 mb-5">
                <TrendingUp className="size-4 text-[#4f46e5]" />
                <h3 className="text-sm font-medium text-white">Attack Patterns</h3>
              </div>
              {patterns.length === 0 ? (
                <p className="text-sm text-gray-500">No pattern data available.</p>
              ) : (
                <div className="space-y-4">
                  {patterns.map((p) => (
                    <div key={p.type}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div
                            className="size-2 rounded-full"
                            style={{ backgroundColor: p.color }}
                          />
                          <span className="text-sm text-gray-300">{p.type}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-500">{p.count}</span>
                          <span
                            className="text-xs font-medium w-9 text-right"
                            style={{ color: p.color }}
                          >
                            {p.percentage}%
                          </span>
                        </div>
                      </div>
                      <MiniBar percentage={p.percentage} color={p.color} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top Attackers */}
            <div className="bg-[#0f0f17] border border-[#1f1f2e] p-6">
              <div className="flex items-center gap-2 mb-5">
                <Target className="size-4 text-[#ef4444]" />
                <h3 className="text-sm font-medium text-white">Top Attackers</h3>
              </div>
              {topAttackers.length === 0 ? (
                <p className="text-sm text-gray-500">No attacker data available.</p>
              ) : (
                <div className="space-y-3">
                  {topAttackers.map((attacker, idx) => (
                    <div
                      key={attacker.ip}
                      className="flex items-center justify-between py-2 border-b border-[#1f1f2e] last:border-0"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-600 font-mono w-4">
                          {idx + 1}
                        </span>
                        <div>
                          <p
                            className={`text-sm font-mono font-medium ${SEVERITY_STYLES[attacker.severity]}`}
                          >
                            {attacker.ip}
                          </p>
                          <p className="text-xs text-gray-500">{attacker.country}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-white font-medium">{attacker.alertCount}</p>
                        <p className="text-xs text-gray-500">alerts</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Geographic Distribution */}
            <div className="bg-[#0f0f17] border border-[#1f1f2e] p-6">
              <div className="flex items-center gap-2 mb-5">
                <Globe className="size-4 text-[#10b981]" />
                <h3 className="text-sm font-medium text-white">Geographic Origins</h3>
              </div>
              {geoEntries.length === 0 ? (
                <p className="text-sm text-gray-500">No geographic data available.</p>
              ) : (
                <div className="space-y-3">
                  {geoEntries.map((geo) => (
                    <div key={geo.country}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-300">{geo.country}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-500">{geo.count}</span>
                          <span className="text-xs text-[#10b981] w-9 text-right">
                            {geo.percentage}%
                          </span>
                        </div>
                      </div>
                      <MiniBar percentage={geo.percentage} color="#10b981" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}