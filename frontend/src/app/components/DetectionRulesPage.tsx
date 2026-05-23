import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search, Clock, Hash, Shield, AlertTriangle, Lock,
  FileCode, Zap, Info, RefreshCw, CheckCircle,
} from 'lucide-react';
import { fetchRules, toggleRule } from '../api/rules';
import type { BackendRule } from '../api/rules';

type DetectionRule = BackendRule;
type StatusTab = 'all' | 'enabled' | 'disabled';

// ─── Style helpers ─────────────────────────────────────────────────────────

const getSeverityIcon = (severity: string) => {
  switch (severity) {
    case 'critical': return <Shield className="size-4 text-[#ef4444]" />;
    case 'high':     return <AlertTriangle className="size-4 text-[#f59e0b]" />;
    case 'medium':   return <Zap className="size-4 text-[#eab308]" />;
    case 'low':      return <FileCode className="size-4 text-[#3b82f6]" />;
    default:         return <Shield className="size-4 text-gray-400" />;
  }
};

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'critical': return 'bg-[#ef4444]/20 text-[#ef4444] border-[#ef4444]/30';
    case 'high':     return 'bg-[#f59e0b]/20 text-[#f59e0b] border-[#f59e0b]/30';
    case 'medium':   return 'bg-[#eab308]/20 text-[#eab308] border-[#eab308]/30';
    case 'low':      return 'bg-[#3b82f6]/20 text-[#3b82f6] border-[#3b82f6]/30';
    default:         return 'bg-gray-700/20 text-gray-400 border-gray-700/30';
  }
};

const getSeverityBorderAccent = (severity: string) => {
  switch (severity) {
    case 'critical': return '#ef4444';
    case 'high':     return '#f59e0b';
    case 'medium':   return '#eab308';
    case 'low':      return '#3b82f6';
    default:         return '#4f46e5';
  }
};

const formatTimestamp = (timestamp: string | null) => {
  if (!timestamp) return 'Never triggered';
  const date = new Date(timestamp);
  const diffMs = Date.now() - date.getTime();
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffHrs / 24);
  if (diffHrs < 1) return 'Less than 1 hour ago';
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return `${diffDays}d ago`;
};

// ─── Component ─────────────────────────────────────────────────────────────

export function DetectionRulesPage() {
  const [rules, setRules] = useState<DetectionRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusTab, setStatusTab] = useState<StatusTab>('all');
  const [recentlyToggled, setRecentlyToggled] = useState<Set<string>>(new Set());
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());

  // ── Fetch ────────────────────────────────────────────────────────────────

  const loadRules = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchRules();
      setRules(data);
    } catch (err) {
      // No fallback mock data — show real error only
      setRules([]);
      setError(err instanceof Error ? err.message : 'Failed to load rules from backend');
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
        const data = await fetchRules();
        if (cancelled) return;
        setRules(data);
      } catch (err) {
        if (cancelled) return;
        setRules([]);
        setError(err instanceof Error ? err.message : 'Failed to load rules from backend');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void run();
    return () => { cancelled = true; };
  }, []);

  // ── Toggle ────────────────────────────────────────────────────────────────

  const toggleRuleStatus = async (ruleId: string) => {
    const rule = rules.find((r) => r.id === ruleId);
    if (!rule || togglingIds.has(ruleId)) return;

    const newEnabled = !rule.enabled;

    // Optimistic update
    setTogglingIds((prev) => new Set(prev).add(ruleId));
    setRules((prev) =>
      prev.map((r) => (r.id === ruleId ? { ...r, enabled: newEnabled } : r)),
    );

    try {
      await toggleRule(ruleId, newEnabled);

      // Show "active until restart" badge
      setRecentlyToggled((prev) => new Set(prev).add(ruleId));
      setTimeout(() => {
        setRecentlyToggled((prev) => {
          const next = new Set(prev);
          next.delete(ruleId);
          return next;
        });
      }, 3000);
    } catch (err) {
      // Rollback on failure
      setRules((prev) =>
        prev.map((r) => (r.id === ruleId ? { ...r, enabled: !newEnabled } : r)),
      );
      setError(err instanceof Error ? err.message : 'Failed to toggle rule');
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(ruleId);
        return next;
      });
    }
  };

  // ── Derived values ─────────────────────────────────────────────────────────

  const categories = useMemo(
    () => ['all', ...Array.from(new Set(rules.map((r) => r.category))).sort()],
    [rules],
  );

  const maxTriggers = useMemo(
    () => Math.max(1, ...rules.map((r) => r.triggerCount)),
    [rules],
  );

  const enabledCount = useMemo(() => rules.filter((r) => r.enabled).length, [rules]);

  const filteredRules = useMemo(() => {
    return rules.filter((rule) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        rule.name.toLowerCase().includes(q) ||
        rule.id.toLowerCase().includes(q) ||
        rule.description.toLowerCase().includes(q) ||
        rule.category.toLowerCase().includes(q);
      const matchesSeverity = severityFilter === 'all' || rule.severity === severityFilter;
      const matchesCategory = categoryFilter === 'all' || rule.category === categoryFilter;
      const matchesStatus =
        statusTab === 'all' ||
        (statusTab === 'enabled' && rule.enabled) ||
        (statusTab === 'disabled' && !rule.enabled);
      return matchesSearch && matchesSeverity && matchesCategory && matchesStatus;
    });
  }, [rules, searchQuery, severityFilter, categoryFilter, statusTab]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="bg-[#0f0f17] border border-[#1f1f2e] p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-medium text-white">Detection Rules</h2>
            <p className="text-sm text-gray-400 mt-1">
              {isLoading
                ? 'Loading rules from backend...'
                : `${enabledCount} of ${rules.length} rules active • Source-defined, in-memory engine`}
            </p>
          </div>
          <button
            onClick={loadRules}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-[#1a1a24] hover:bg-[#2a2a3a] border border-[#2a2a3a] text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`size-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Architecture notice — always visible */}
        <div className="flex items-start gap-3 bg-[#1a1a24] border border-[#4f46e5]/30 px-4 py-3">
          <Info className="size-4 text-[#4f46e5] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-400 leading-relaxed">
            Rule definitions are hardcoded in backend source (
            <span className="font-mono text-gray-300">src/rules/definitions/</span>
            ) and cannot be edited from the UI. Toggle state is held{' '}
            <span className="text-[#f59e0b]">in memory only</span> — changes reset to
            defaults on backend restart.
          </p>
        </div>
      </div>

      {/* ── Error state ──────────────────────────────────────────────────── */}
      {error && !isLoading && (
        <div className="bg-[#0f0f17] border border-[#1f1f2e] p-8 text-center">
          <AlertTriangle className="size-10 text-[#ef4444] mx-auto mb-3" />
          <p className="text-white mb-1">Failed to load rules</p>
          <p className="text-sm text-[#fca5a5] mb-4">{error}</p>
          <button
            onClick={loadRules}
            className="px-4 py-2 bg-[#4f46e5] hover:bg-[#4338ca] text-white text-sm"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Loading skeleton ─────────────────────────────────────────────── */}
      {isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-[160px] animate-pulse bg-[#1a1a24] border border-[#1f1f2e]"
            />
          ))}
        </div>
      )}

      {/* ── Main content (only when loaded and no error) ─────────────────── */}
      {!isLoading && !error && (
        <>
          {/* ── Stat cards ────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label: 'Total Rules',
                value: rules.length,
                icon: FileCode,
                accent: '#4f46e5',
                sub: 'source-defined',
              },
              {
                label: 'Active',
                value: enabledCount,
                icon: CheckCircle,
                accent: '#10b981',
                sub: 'currently running',
              },
              {
                label: 'Disabled',
                value: rules.length - enabledCount,
                icon: Lock,
                accent: '#ef4444',
                sub: 'paused rules',
              },
              {
                label: 'Total Triggers',
                value: rules.reduce((s, r) => s + r.triggerCount, 0).toLocaleString(),
                icon: Zap,
                accent: '#f59e0b',
                sub: 'lifetime detections',
              },
            ].map(({ label, value, icon: Icon, accent, sub }) => (
              <div
                key={label}
                className="bg-[#0f0f17] border border-[#1f1f2e] p-5 relative overflow-hidden"
                style={{ borderLeftColor: accent, borderLeftWidth: 3 }}
              >
                <div className="flex items-start justify-between mb-2">
                  <span className="text-xs text-gray-400 uppercase tracking-widest">{label}</span>
                  <Icon className="size-4" style={{ color: accent }} />
                </div>
                <p className="text-3xl font-semibold text-white mb-1">{value}</p>
                <p className="text-xs text-gray-500">{sub}</p>
                <div
                  className="absolute bottom-0 left-0 right-0 h-px opacity-40"
                  style={{ background: `linear-gradient(to right, ${accent}, transparent)` }}
                />
              </div>
            ))}
          </div>

          {/* ── Filters ──────────────────────────────────────────────────── */}
          <div className="bg-[#0f0f17] border border-[#1f1f2e] p-5">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
              {/* Search */}
              <div className="md:col-span-2 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search by name, ID, description, category..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#1a1a24] border border-[#2a2a3a] pl-10 pr-4 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#4f46e5]"
                />
              </div>

              {/* Severity */}
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value as typeof severityFilter)}
                className="bg-[#1a1a24] border border-[#2a2a3a] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#4f46e5]"
              >
                <option value="all">All Severities</option>
                <option value="critical">Critical</option>
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
            </div>

            {/* Status tabs */}
            <div className="flex gap-2">
              {(
                [
                  { key: 'all',      label: `All (${rules.length})` },
                  { key: 'enabled',  label: `Active (${enabledCount})` },
                  { key: 'disabled', label: `Disabled (${rules.length - enabledCount})` },
                ] as const
              ).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setStatusTab(key)}
                  className={`px-4 py-2 text-sm ${
                    statusTab === key
                      ? 'bg-[#4f46e5] text-white'
                      : 'bg-[#1a1a24] text-gray-400 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
              <span className="ml-auto text-xs text-gray-500 self-center">
                {filteredRules.length} of {rules.length} rules
              </span>
            </div>
          </div>

          {/* ── Rules grid ───────────────────────────────────────────────── */}
          {filteredRules.length === 0 ? (
            <div className="bg-[#0f0f17] border border-[#1f1f2e] p-12 text-center">
              <Search className="size-10 text-gray-600 mx-auto mb-3" />
              <p className="text-white mb-1">No rules found</p>
              <p className="text-gray-400 text-sm">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredRules.map((rule) => {
                const accent = getSeverityBorderAccent(rule.severity);
                const isToggling = togglingIds.has(rule.id);
                const wasToggled = recentlyToggled.has(rule.id);
                const triggerBarWidth = `${Math.round((rule.triggerCount / maxTriggers) * 100)}%`;

                return (
                  <div
                    key={rule.id}
                    className={`bg-[#0f0f17] border border-[#1f1f2e] p-5 transition-all ${
                      rule.enabled
                        ? 'hover:border-[#2f2f3e]'
                        : 'opacity-60'
                    }`}
                    style={{ borderLeftColor: accent, borderLeftWidth: 3 }}
                  >
                    {/* Card header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="mt-0.5 flex-shrink-0">
                          {getSeverityIcon(rule.severity)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base text-white font-medium mb-1 truncate">
                            {rule.name}
                          </h3>
                          <p className="text-xs text-gray-400 mb-3 line-clamp-2">
                            {rule.description}
                          </p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-xs px-2 py-0.5 border ${getSeverityColor(rule.severity)}`}
                            >
                              {rule.severity.toUpperCase()}
                            </span>
                            <span className="text-xs px-2 py-0.5 bg-[#1a1a24] border border-[#2a2a3a] text-gray-400">
                              {rule.category}
                            </span>
                            {/* Source-defined badge */}
                            <span className="text-xs px-2 py-0.5 bg-[#4f46e5]/10 border border-[#4f46e5]/20 text-[#818cf8]">
                              source-defined
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Toggle */}
                      <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-3">
                        <button
                          onClick={() => toggleRuleStatus(rule.id)}
                          disabled={isToggling}
                          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
                            rule.enabled ? 'bg-[#4f46e5]' : 'bg-[#2a2a3a]'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              rule.enabled ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                        {/* Transient restart warning */}
                        {wasToggled && (
                          <span className="text-[10px] text-[#f59e0b] whitespace-nowrap animate-pulse">
                            until restart
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Card footer */}
                    <div className="pt-3 border-t border-[#1f1f2e]">
                      <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            <Hash className="size-3" />
                            <span className="font-mono">{rule.id}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Clock className="size-3" />
                            <span>{formatTimestamp(rule.lastTriggered)}</span>
                          </div>
                        </div>
                        <span className="font-mono text-gray-400">
                          {rule.triggerCount.toLocaleString()} triggers
                        </span>
                      </div>

                      {/* Trigger count bar */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-[#1a1a24] h-1">
                          <div
                            className="h-1 transition-all duration-700"
                            style={{
                              width: triggerBarWidth,
                              backgroundColor: accent,
                              opacity: rule.enabled ? 1 : 0.4,
                            }}
                          />
                        </div>
                        <span className="text-[10px] text-gray-600 font-mono w-8 text-right">
                          {Math.round((rule.triggerCount / maxTriggers) * 100)}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}