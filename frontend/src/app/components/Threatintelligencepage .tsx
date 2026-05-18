import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Globe, Shield, AlertTriangle, TrendingUp, RefreshCw,
  Download, Search, ChevronUp, ChevronDown, Activity,
  Zap, Eye, Target, Database,
} from 'lucide-react';
import { fetchAlerts, type BackendAlertRecord } from '../api/dashboard';

// ─── Types ──────────────────────────────────────────────────────────────────

interface IOCEntry {
  id: string;
  indicator: string;
  type: 'ip' | 'domain' | 'hash';
  threatCategory: string;
  confidence: 'high' | 'medium' | 'low';
  occurrences: number;
  firstSeen: string;
  lastSeen: string;
  country: string;
  isp: string;
  status: 'active' | 'resolved';
}

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

type SortField = 'occurrences' | 'lastSeen' | 'confidence' | 'indicator';
type SortDir = 'asc' | 'desc';

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

const confidenceFromOccurrences = (n: number): IOCEntry['confidence'] => {
  if (n >= 10) return 'high';
  if (n >= 3) return 'medium';
  return 'low';
};

const CATEGORY_COLORS: Record<string, string> = {
  'Brute Force':        '#ef4444',
  'Unauthorized Access':'#f59e0b',
  'Application Attack': '#8b5cf6',
  'Reconnaissance':     '#3b82f6',
  'Unknown Threat':     '#6b7280',
};

const CONFIDENCE_STYLES: Record<string, string> = {
  high:   'bg-[#ef4444]/20 text-[#ef4444] border border-[#ef4444]/30',
  medium: 'bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/30',
  low:    'bg-[#3b82f6]/20 text-[#3b82f6] border border-[#3b82f6]/30',
};

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'text-[#ef4444]',
  high:     'text-[#f59e0b]',
  medium:   'text-[#eab308]',
  low:      'text-[#3b82f6]',
};

// ─── Data derivation from alerts ─────────────────────────────────────────────

const deriveIntelligence = (raw: BackendAlertRecord[]) => {
  // ── IOC map keyed by IP ──────────────────────────────────────────────────
  const iocMap = new Map<string, {
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

    if (iocMap.has(ip)) {
      const entry = iocMap.get(ip)!;
      entry.count += 1;
      entry.categories.add(cat);
      if (new Date(ts) < new Date(entry.firstSeen)) entry.firstSeen = ts;
      if (new Date(ts) > new Date(entry.lastSeen)) entry.lastSeen = ts;
    } else {
      iocMap.set(ip, {
        alert,
        count: 1,
        firstSeen: ts,
        lastSeen: ts,
        categories: new Set([cat]),
      });
    }
  }

  // ── IOC list ─────────────────────────────────────────────────────────────
  const iocs: IOCEntry[] = Array.from(iocMap.entries()).map(([ip, data]) => {
    const geo = data.alert.geo;
    return {
      id: ip,
      indicator: ip,
      type: 'ip',
      threatCategory: Array.from(data.categories).join(', '),
      confidence: confidenceFromOccurrences(data.count),
      occurrences: data.count,
      firstSeen: new Date(data.firstSeen).toLocaleString(),
      lastSeen:  new Date(data.lastSeen).toLocaleString(),
      country: readString(geo?.country) ?? 'Unknown',
      isp:     readString(geo?.isp)     ?? 'Unknown',
      status:  data.alert.status?.toLowerCase() === 'resolved' ? 'resolved' : 'active',
    };
  });

  // ── Top attackers ────────────────────────────────────────────────────────
  const topAttackers: TopAttacker[] = Array.from(iocMap.entries())
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

  return { iocs, topAttackers, patterns, geoEntries };
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
  const [search, setSearch] = useState('');
  const [confidenceFilter, setConfidenceFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'resolved'>('all');
  const [sortField, setSortField] = useState<SortField>('occurrences');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selectedIOC, setSelectedIOC] = useState<IOCEntry | null>(null);

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

  const { iocs, topAttackers, patterns, geoEntries } = useMemo(
    () => deriveIntelligence(rawAlerts),
    [rawAlerts],
  );

  const categories = useMemo(
    () => ['all', ...Array.from(new Set(iocs.map((i) => i.threatCategory.split(', ')[0])))],
    [iocs],
  );

  const filteredIOCs = useMemo(() => {
    let list = iocs;
    if (search)
      list = list.filter(
        (i) =>
          i.indicator.includes(search) ||
          i.threatCategory.toLowerCase().includes(search.toLowerCase()) ||
          i.country.toLowerCase().includes(search.toLowerCase()),
      );
    if (confidenceFilter !== 'all') list = list.filter((i) => i.confidence === confidenceFilter);
    if (categoryFilter !== 'all')
      list = list.filter((i) => i.threatCategory.includes(categoryFilter));
    if (statusFilter !== 'all') list = list.filter((i) => i.status === statusFilter);

    list = [...list].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortField === 'occurrences') return (a.occurrences - b.occurrences) * dir;
      if (sortField === 'lastSeen')
        return (new Date(a.lastSeen).getTime() - new Date(b.lastSeen).getTime()) * dir;
      if (sortField === 'confidence') {
        const order = { high: 2, medium: 1, low: 0 };
        return (order[a.confidence] - order[b.confidence]) * dir;
      }
      return a.indicator.localeCompare(b.indicator) * dir;
    });
    return list;
  }, [iocs, search, confidenceFilter, categoryFilter, statusFilter, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('desc'); }
  };

  // ── Export ───────────────────────────────────────────────────────────────

  const handleExport = () => {
    const csv = [
      ['Indicator', 'Type', 'Category', 'Confidence', 'Occurrences', 'Country', 'ISP', 'First Seen', 'Last Seen', 'Status'],
      ...filteredIOCs.map((i) => [
        i.indicator, i.type, i.threatCategory, i.confidence,
        i.occurrences, i.country, i.isp, i.firstSeen, i.lastSeen, i.status,
      ]),
    ]
      .map((row) => row.map((c) => `"${c}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smartsiem-ioc-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const SortIcon = ({ field }: { field: SortField }) =>
    sortField === field ? (
      sortDir === 'desc' ? (
        <ChevronDown className="size-3 inline ml-1" />
      ) : (
        <ChevronUp className="size-3 inline ml-1" />
      )
    ) : (
      <ChevronDown className="size-3 inline ml-1 opacity-30" />
    );

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="bg-[#0f0f17] border border-[#1f1f2e] p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-medium text-white">Threat Intelligence</h2>
            <p className="text-sm text-gray-400 mt-1">
              IOC analysis and attacker profiling derived from detection engine data
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="size-2 rounded-full bg-[#10b981] animate-pulse" />
              <span className="text-xs text-gray-400">
                {iocs.filter((i) => i.status === 'active').length} Active IOCs
              </span>
            </div>
            <button
              onClick={loadData}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-[#1a1a24] hover:bg-[#2a2a3a] border border-[#2a2a3a] text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`size-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-[#4f46e5] hover:bg-[#4338ca] text-white text-sm"
            >
              <Download className="size-4" />
              Export IOCs
            </button>
          </div>
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
              icon={Database}
              label="Total IOCs"
              value={iocs.length}
              sub={`${iocs.filter((i) => i.status === 'active').length} active`}
              accent="#4f46e5"
            />
            <StatCard
              icon={AlertTriangle}
              label="High Confidence"
              value={iocs.filter((i) => i.confidence === 'high').length}
              sub="Requires immediate action"
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
              label="Total Events"
              value={rawAlerts.length}
              sub="Across all log sources"
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

          {/* ── IOC Table ─────────────────────────────────────────────────── */}
          <div className="bg-[#0f0f17] border border-[#1f1f2e]">
            {/* Table header / filters */}
            <div className="border-b border-[#1f1f2e] p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Shield className="size-4 text-[#4f46e5]" />
                  <h3 className="text-sm font-medium text-white">
                    Indicators of Compromise
                  </h3>
                  <span className="text-xs text-gray-500 ml-2">
                    {filteredIOCs.length} of {iocs.length}
                  </span>
                </div>
              </div>

              {/* Filter row */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                {/* Search */}
                <div className="md:col-span-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-gray-500" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search IP, category, country..."
                    className="w-full bg-[#1a1a24] border border-[#2a2a3a] pl-9 pr-4 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#4f46e5]"
                  />
                </div>

                {/* Confidence */}
                <select
                  value={confidenceFilter}
                  onChange={(e) =>
                    setConfidenceFilter(e.target.value as typeof confidenceFilter)
                  }
                  className="bg-[#1a1a24] border border-[#2a2a3a] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#4f46e5]"
                >
                  <option value="all">All Confidence</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>

                {/* Category */}
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="bg-[#1a1a24] border border-[#2a2a3a] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#4f46e5]"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c === 'all' ? 'All Categories' : c}
                    </option>
                  ))}
                </select>

                {/* Status */}
                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as typeof statusFilter)
                  }
                  className="bg-[#1a1a24] border border-[#2a2a3a] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#4f46e5]"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
            </div>

            {/* Table */}
            {filteredIOCs.length === 0 ? (
              <div className="text-center py-16">
                <Zap className="size-10 text-gray-600 mx-auto mb-3" />
                <p className="text-white mb-1">No IOCs found</p>
                <p className="text-gray-500 text-sm">
                  {iocs.length === 0
                    ? 'No alert data with IP addresses available.'
                    : 'Try adjusting your filters.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#1f1f2e] bg-[#0a0a0f]">
                      {(
                        [
                          { label: 'Indicator', field: 'indicator' as SortField },
                          { label: 'Category', field: null },
                          { label: 'Confidence', field: 'confidence' as SortField },
                          { label: 'Occurrences', field: 'occurrences' as SortField },
                          { label: 'Country / ISP', field: null },
                          { label: 'Last Seen', field: 'lastSeen' as SortField },
                          { label: 'Status', field: null },
                          { label: '', field: null },
                        ]
                      ).map(({ label, field }) => (
                        <th
                          key={label}
                          onClick={field ? () => toggleSort(field) : undefined}
                          className={`text-left py-3 px-5 text-xs font-medium text-gray-400 uppercase tracking-wider ${
                            field ? 'cursor-pointer hover:text-white select-none' : ''
                          }`}
                        >
                          {label}
                          {field && <SortIcon field={field} />}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1f1f2e]">
                    {filteredIOCs.map((ioc) => (
                      <>
                        <tr
                          key={ioc.id}
                          onClick={() =>
                            setSelectedIOC(selectedIOC?.id === ioc.id ? null : ioc)
                          }
                          className={`hover:bg-[#1a1a24] transition-colors cursor-pointer ${
                            selectedIOC?.id === ioc.id
                              ? 'bg-[#1a1a24] ring-1 ring-inset ring-[#4f46e5]'
                              : ''
                          }`}
                        >
                          {/* Indicator */}
                          <td className="py-4 px-5">
                            <div className="flex items-center gap-2">
                              <div
                                className="size-1.5 rounded-full flex-shrink-0"
                                style={{
                                  backgroundColor:
                                    ioc.status === 'active' ? '#ef4444' : '#6b7280',
                                }}
                              />
                              <span className="text-sm font-mono text-white">
                                {ioc.indicator}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 font-mono ml-4 mt-0.5">
                              {ioc.type.toUpperCase()}
                            </p>
                          </td>

                          {/* Category */}
                          <td className="py-4 px-5">
                            <div className="flex flex-wrap gap-1">
                              {ioc.threatCategory.split(', ').map((cat) => (
                                <span
                                  key={cat}
                                  className="text-xs px-2 py-0.5 font-medium"
                                  style={{
                                    backgroundColor: `${CATEGORY_COLORS[cat] ?? '#6b7280'}25`,
                                    color: CATEGORY_COLORS[cat] ?? '#6b7280',
                                  }}
                                >
                                  {cat}
                                </span>
                              ))}
                            </div>
                          </td>

                          {/* Confidence */}
                          <td className="py-4 px-5">
                            <span
                              className={`text-xs font-medium px-2.5 py-1 uppercase ${
                                CONFIDENCE_STYLES[ioc.confidence]
                              }`}
                            >
                              {ioc.confidence}
                            </span>
                          </td>

                          {/* Occurrences */}
                          <td className="py-4 px-5">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-white font-medium">
                                {ioc.occurrences}
                              </span>
                              <div className="w-16 bg-[#1a1a24] h-1">
                                <div
                                  className="h-1 bg-[#4f46e5]"
                                  style={{
                                    width: `${Math.min(
                                      100,
                                      (ioc.occurrences /
                                        Math.max(...filteredIOCs.map((i) => i.occurrences))) *
                                        100,
                                    )}%`,
                                  }}
                                />
                              </div>
                            </div>
                          </td>

                          {/* Country / ISP */}
                          <td className="py-4 px-5">
                            <p className="text-sm text-gray-300">{ioc.country}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{ioc.isp}</p>
                          </td>

                          {/* Last seen */}
                          <td className="py-4 px-5">
                            <span className="text-sm text-gray-300 font-mono">
                              {ioc.lastSeen}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="py-4 px-5">
                            <span
                              className={`text-xs px-2.5 py-1 font-medium ${
                                ioc.status === 'active'
                                  ? 'bg-[#ef4444]/20 text-[#ef4444]'
                                  : 'bg-[#10b981]/20 text-[#10b981]'
                              }`}
                            >
                              {ioc.status === 'active' ? 'Active' : 'Resolved'}
                            </span>
                          </td>

                          {/* Expand */}
                          <td className="py-4 px-5">
                            <button className="text-[#4f46e5] hover:text-[#6366f1]">
                              <Eye className="size-4" />
                            </button>
                          </td>
                        </tr>

                        {/* Expanded row detail */}
                        {selectedIOC?.id === ioc.id && (
                          <tr key={`${ioc.id}-detail`}>
                            <td colSpan={8} className="px-5 pb-5 bg-[#0a0a10]">
                              <div className="border border-[#2a2a3a] p-5 mt-1 grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                  <h4 className="text-xs text-gray-400 uppercase tracking-widest mb-3">
                                    Indicator Details
                                  </h4>
                                  <dl className="space-y-2">
                                    <div className="flex justify-between">
                                      <dt className="text-xs text-gray-500">Type</dt>
                                      <dd className="text-xs text-white font-mono uppercase">
                                        {ioc.type}
                                      </dd>
                                    </div>
                                    <div className="flex justify-between">
                                      <dt className="text-xs text-gray-500">First Seen</dt>
                                      <dd className="text-xs text-white">{ioc.firstSeen}</dd>
                                    </div>
                                    <div className="flex justify-between">
                                      <dt className="text-xs text-gray-500">Last Seen</dt>
                                      <dd className="text-xs text-white">{ioc.lastSeen}</dd>
                                    </div>
                                    <div className="flex justify-between">
                                      <dt className="text-xs text-gray-500">Occurrences</dt>
                                      <dd className="text-xs text-white font-mono">
                                        {ioc.occurrences}
                                      </dd>
                                    </div>
                                  </dl>
                                </div>
                                <div>
                                  <h4 className="text-xs text-gray-400 uppercase tracking-widest mb-3">
                                    Network Info
                                  </h4>
                                  <dl className="space-y-2">
                                    <div className="flex justify-between">
                                      <dt className="text-xs text-gray-500">Country</dt>
                                      <dd className="text-xs text-white">{ioc.country}</dd>
                                    </div>
                                    <div className="flex justify-between">
                                      <dt className="text-xs text-gray-500">ISP</dt>
                                      <dd className="text-xs text-white">{ioc.isp}</dd>
                                    </div>
                                    <div className="flex justify-between">
                                      <dt className="text-xs text-gray-500">Confidence</dt>
                                      <dd
                                        className={`text-xs font-medium uppercase ${
                                          ioc.confidence === 'high'
                                            ? 'text-[#ef4444]'
                                            : ioc.confidence === 'medium'
                                            ? 'text-[#f59e0b]'
                                            : 'text-[#3b82f6]'
                                        }`}
                                      >
                                        {ioc.confidence}
                                      </dd>
                                    </div>
                                  </dl>
                                </div>
                                <div>
                                  <h4 className="text-xs text-gray-400 uppercase tracking-widest mb-3">
                                    Threat Categories
                                  </h4>
                                  <div className="flex flex-wrap gap-2">
                                    {ioc.threatCategory.split(', ').map((cat) => (
                                      <span
                                        key={cat}
                                        className="text-xs px-2 py-1"
                                        style={{
                                          backgroundColor: `${CATEGORY_COLORS[cat] ?? '#6b7280'}25`,
                                          color: CATEGORY_COLORS[cat] ?? '#6b7280',
                                          borderLeft: `2px solid ${CATEGORY_COLORS[cat] ?? '#6b7280'}`,
                                        }}
                                      >
                                        {cat}
                                      </span>
                                    ))}
                                  </div>
                                  <p className="text-xs text-gray-500 mt-3">
                                    Source: SmartSIEM Detection Engine
                                  </p>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}