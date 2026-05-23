import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  FolderOpen, Plus, Clock, User, AlertTriangle, CheckCircle,
  XCircle, ChevronRight, MessageSquare, Link2, Search,
  RefreshCw, Shield, Activity, TrendingUp, Send, Tag,
  MoreHorizontal, Paperclip, Eye, FileText, History, MapPin,
  Server, ExternalLink,
} from 'lucide-react';
import {
  fetchAlerts,
  fetchLogs,
  fetchAlertById,
  patchAlertStatus,
  type BackendAlertRecord,
  type BackendLogRecord,
} from '../api/dashboard';
import {
  type AnalystAlertStatus,
  getAlertStatusColor,
  getAlertStatusLabel,
  normalizeAlertUiStatus,
} from '../lib/alertStatus';
import { AlertDeepDiveModal } from './AlertDeepDiveModal';
import { buildRecentAlerts } from '../lib/dashboardWidgets';
import {
  type CaseNote,
  type CasePriority,
  type CaseStatus,
  type InvestigationCase,
  type TimelineEntry,
  buildCasesFromAlerts,
  collectRecommendations,
  getAlertId,
  getAlertIp,
  getAlertTimestamp,
  getCaseSummaryStats,
  getIpAlertHistory,
  getRelatedLogs,
  humanizeRule,
} from '../lib/investigationCase';

type StatusFilter = 'all' | CaseStatus;
type DetailTab = 'overview' | 'alerts' | 'logs' | 'history' | 'timeline' | 'notes';

const readString = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim() : undefined;

const formatTs = (ts: string) => {
  const d = new Date(ts);
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

const formatRelative = (ts: string) => {
  const diffMs = Date.now() - new Date(ts).getTime();
  const h = Math.floor(diffMs / 3600000);
  const d = Math.floor(h / 24);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  return `${d}d ago`;
};

// ─── Style maps ──────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<CaseStatus, { label: string; color: string; icon: React.ReactNode }> = {
  open:           { label: 'Open',           color: 'bg-[#ef4444]/20 text-[#ef4444]',   icon: <XCircle className="size-3.5" /> },
  in_progress:    { label: 'In Progress',    color: 'bg-[#f59e0b]/20 text-[#f59e0b]',   icon: <Clock className="size-3.5" /> },
  pending_review: { label: 'Pending Review', color: 'bg-[#8b5cf6]/20 text-[#8b5cf6]',   icon: <Eye className="size-3.5" /> },
  closed:         { label: 'Closed',         color: 'bg-[#10b981]/20 text-[#10b981]',   icon: <CheckCircle className="size-3.5" /> },
};

const PRIORITY_STYLES: Record<CasePriority, { border: string; badge: string }> = {
  critical: { border: '#ef4444', badge: 'bg-[#ef4444] text-white' },
  high:     { border: '#f59e0b', badge: 'bg-[#f59e0b] text-white' },
  medium:   { border: '#eab308', badge: 'bg-[#eab308] text-black' },
  low:      { border: '#3b82f6', badge: 'bg-[#3b82f6] text-white' },
};

const SEVERITY_DOT: Record<string, string> = {
  critical: 'bg-[#ef4444]',
  high:     'bg-[#f59e0b]',
  medium:   'bg-[#eab308]',
  low:      'bg-[#3b82f6]',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function InvestigationsPage() {
  const [cases, setCases] = useState<InvestigationCase[]>([]);
  const [allAlerts, setAllAlerts] = useState<BackendAlertRecord[]>([]);
  const [allLogs, setAllLogs] = useState<BackendLogRecord[]>([]);
  const [selectedCase, setSelectedCase] = useState<InvestigationCase | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | CasePriority>('all');
  const [search, setSearch] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [expandedAlertId, setExpandedAlertId] = useState<string | null>(null);
  const [deepDiveAlert, setDeepDiveAlert] = useState<ReturnType<typeof buildRecentAlerts>[0] | null>(null);
  const [deepDiveOpen, setDeepDiveOpen] = useState(false);
  const [deepDiveLoading, setDeepDiveLoading] = useState(false);
  const [updatingAlertId, setUpdatingAlertId] = useState<string | null>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  const loadCases = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [alerts, logs] = await Promise.all([fetchAlerts(), fetchLogs()]);
      setAllAlerts(alerts);
      setAllLogs(logs);
      const built = buildCasesFromAlerts(alerts);
      setCases(built);
      setSelectedCase((prev) => {
        if (!prev) return built[0] ?? null;
        return built.find((c) => c.id === prev.id) ?? built[0] ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cases');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCases();
  }, [loadCases]);

  const relatedLogs = useMemo(() => {
    if (!selectedCase) return [];
    return getRelatedLogs(allLogs, selectedCase);
  }, [allLogs, selectedCase]);

  const ipHistoryAlerts = useMemo(() => {
    if (!selectedCase) return [];
    return getIpAlertHistory(allAlerts, selectedCase);
  }, [allAlerts, selectedCase]);

  const recommendations = useMemo(() => {
    if (!selectedCase) return [];
    return collectRecommendations(selectedCase);
  }, [selectedCase]);

  const caseStats = useMemo(() => {
    if (!selectedCase) return null;
    return getCaseSummaryStats(selectedCase, relatedLogs.length);
  }, [selectedCase, relatedLogs.length]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const counts = useMemo(() => ({
    all:            cases.length,
    open:           cases.filter((c) => c.status === 'open').length,
    in_progress:    cases.filter((c) => c.status === 'in_progress').length,
    pending_review: cases.filter((c) => c.status === 'pending_review').length,
    closed:         cases.filter((c) => c.status === 'closed').length,
  }), [cases]);

  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      const q = search.toLowerCase();
      const matchSearch = !q || c.title.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) || c.description.toLowerCase().includes(q);
      const matchStatus = statusFilter === 'all' || c.status === statusFilter;
      const matchPriority = priorityFilter === 'all' || c.priority === priorityFilter;
      return matchSearch && matchStatus && matchPriority;
    });
  }, [cases, search, statusFilter, priorityFilter]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const updateCaseStatus = (newStatus: CaseStatus) => {
    if (!selectedCase || isUpdatingStatus) return;
    setIsUpdatingStatus(true);

    const timelineEntry: TimelineEntry = {
      id: `${selectedCase.id}-t${selectedCase.timeline.length + 1}`,
      actor: 'admin',
      action: `Status changed to ${STATUS_STYLES[newStatus].label}`,
      timestamp: new Date().toISOString(),
    };

    const updated: InvestigationCase = {
      ...selectedCase,
      status: newStatus,
      updatedAt: new Date().toISOString(),
      timeline: [...selectedCase.timeline, timelineEntry],
    };

    setCases((prev) => prev.map((c) => (c.id === selectedCase.id ? updated : c)));
    setSelectedCase(updated);
    setTimeout(() => setIsUpdatingStatus(false), 400);
  };

  const updateAlertDisposition = async (alertId: string, status: AnalystAlertStatus) => {
    if (updatingAlertId) return;
    setUpdatingAlertId(alertId);
    try {
      await patchAlertStatus(alertId, status);
      setAllAlerts((prev) => {
        const next = prev.map((a) =>
          getAlertId(a) === alertId ? { ...a, status } : a,
        );
        const built = buildCasesFromAlerts(next);
        setCases(built);
        setSelectedCase((sel) => {
          if (!sel) return sel;
          const rebuilt = built.find((c) => c.id === sel.id);
          if (!rebuilt) return sel;
          return {
            ...rebuilt,
            timeline: [
              ...rebuilt.timeline,
              {
                id: `${rebuilt.id}-t${rebuilt.timeline.length + 1}`,
                actor: 'Analyst',
                action: `Alert marked as ${getAlertStatusLabel(status)}`,
                detail: alertId,
                timestamp: new Date().toISOString(),
              },
            ],
          };
        });
        return next;
      });
    } catch (err) {
      console.error('Failed to update alert status:', err);
    } finally {
      setUpdatingAlertId(null);
    }
  };

  const openAlertDeepDive = async (alert: BackendAlertRecord) => {
    const id = getAlertId(alert);
    setDeepDiveLoading(true);
    try {
      const fresh = await fetchAlertById(id);
      const normalized = buildRecentAlerts([fresh])[0];
      if (normalized) {
        setDeepDiveAlert(normalized);
        setDeepDiveOpen(true);
      }
    } catch {
      const normalized = buildRecentAlerts([alert])[0];
      if (normalized) {
        setDeepDiveAlert(normalized);
        setDeepDiveOpen(true);
      }
    } finally {
      setDeepDiveLoading(false);
    }
  };

  const addNote = () => {
    if (!selectedCase || !noteInput.trim()) return;

    const note: CaseNote = {
      id: `note-${Date.now()}`,
      author: 'admin',
      content: noteInput.trim(),
      timestamp: new Date().toISOString(),
    };

    const timelineEntry: TimelineEntry = {
      id: `${selectedCase.id}-t${selectedCase.timeline.length + 1}`,
      actor: 'admin',
      action: 'Added a note',
      detail: noteInput.trim().slice(0, 80) + (noteInput.length > 80 ? '…' : ''),
      timestamp: new Date().toISOString(),
    };

    const updated: InvestigationCase = {
      ...selectedCase,
      notes: [...selectedCase.notes, note],
      timeline: [...selectedCase.timeline, timelineEntry],
      updatedAt: new Date().toISOString(),
    };

    setCases((prev) => prev.map((c) => (c.id === selectedCase.id ? updated : c)));
    setSelectedCase(updated);
    setNoteInput('');
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="bg-[#0f0f17] border border-[#1f1f2e] p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-medium text-white">Investigations & Cases</h2>
            <p className="text-sm text-gray-400 mt-1">
              Full alert history, related logs, IP timeline, and analyst notes per case
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadCases}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-[#1a1a24] hover:bg-[#2a2a3a] border border-[#2a2a3a] text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`size-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-[#4f46e5] hover:bg-[#4338ca] text-white text-sm">
              <Plus className="size-4" />
              New Case
            </button>
          </div>
        </div>

        {/* Status tabs */}
        <div className="flex flex-wrap gap-2">
          {(
            [
              { key: 'all',           label: `All (${counts.all})` },
              { key: 'open',          label: `Open (${counts.open})` },
              { key: 'in_progress',   label: `In Progress (${counts.in_progress})` },
              { key: 'pending_review',label: `Pending Review (${counts.pending_review})` },
              { key: 'closed',        label: `Closed (${counts.closed})` },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`px-4 py-2 text-sm ${
                statusFilter === key
                  ? 'bg-[#4f46e5] text-white'
                  : 'bg-[#1a1a24] text-gray-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Stat cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Cases',    value: counts.all,         icon: FolderOpen,   accent: '#4f46e5', sub: 'grouped investigations' },
          { label: 'Open',           value: counts.open,        icon: XCircle,      accent: '#ef4444', sub: 'awaiting action' },
          { label: 'In Progress',    value: counts.in_progress, icon: Activity,     accent: '#f59e0b', sub: 'being investigated' },
          { label: 'Closed',         value: counts.closed,      icon: CheckCircle,  accent: '#10b981', sub: 'resolved cases' },
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

      {/* ── Loading ──────────────────────────────────────────────────────── */}
      {isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-[100px] animate-pulse bg-[#1a1a24] border border-[#1f1f2e]" />
            ))}
          </div>
          <div className="lg:col-span-2">
            <div className="h-[500px] animate-pulse bg-[#1a1a24] border border-[#1f1f2e]" />
          </div>
        </div>
      )}

      {/* ── Error ────────────────────────────────────────────────────────── */}
      {error && !isLoading && (
        <div className="bg-[#0f0f17] border border-[#1f1f2e] p-8 text-center">
          <AlertTriangle className="size-10 text-[#ef4444] mx-auto mb-3" />
          <p className="text-white mb-1">Failed to load cases</p>
          <p className="text-sm text-[#fca5a5] mb-4">{error}</p>
          <button onClick={loadCases} className="px-4 py-2 bg-[#4f46e5] text-white text-sm">
            Retry
          </button>
        </div>
      )}

      {/* ── Main layout ──────────────────────────────────────────────────── */}
      {!isLoading && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Case list (left column) ────────────────────────────────── */}
          <div className="lg:col-span-1 space-y-3">

            {/* Search + priority filter */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-gray-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search cases..."
                  className="w-full bg-[#1a1a24] border border-[#2a2a3a] pl-9 pr-4 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#4f46e5]"
                />
              </div>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as typeof priorityFilter)}
                className="w-full bg-[#1a1a24] border border-[#2a2a3a] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#4f46e5]"
              >
                <option value="all">All Priorities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            {/* Case cards */}
            {filteredCases.length === 0 ? (
              <div className="bg-[#0f0f17] border border-[#1f1f2e] p-8 text-center">
                <FolderOpen className="size-8 text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No cases match filters</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredCases.map((c) => {
                  const st = STATUS_STYLES[c.status];
                  const pr = PRIORITY_STYLES[c.priority];
                  const isSelected = selectedCase?.id === c.id;

                  return (
                    <div
                      key={c.id}
                      onClick={() => {
                        setSelectedCase(c);
                        setActiveTab('overview');
                        setExpandedAlertId(null);
                      }}
                      className={`bg-[#0f0f17] border border-[#1f1f2e] p-4 cursor-pointer transition-all hover:border-[#2f2f3e] ${
                        isSelected ? 'ring-2 ring-[#4f46e5]' : ''
                      }`}
                      style={{ borderLeftColor: pr.border, borderLeftWidth: 3 }}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-500 font-mono mb-1">{c.id}</p>
                          <h3 className="text-sm text-white font-medium line-clamp-2 leading-snug">
                            {c.title}
                          </h3>
                        </div>
                        <ChevronRight
                          className={`size-4 text-gray-600 flex-shrink-0 ml-2 mt-0.5 transition-transform ${
                            isSelected ? 'rotate-90 text-[#4f46e5]' : ''
                          }`}
                        />
                      </div>

                      <div className="flex items-center gap-2 flex-wrap mt-2">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 ${st.color}`}>
                          {st.icon}
                          {st.label}
                        </span>
                        <span className={`text-xs px-2 py-0.5 font-medium uppercase ${pr.badge}`}>
                          {c.priority}
                        </span>
                      </div>

                      <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <Link2 className="size-3" />
                          <span>{c.alerts.length} alerts</span>
                        </div>
                        <span>{formatRelative(c.updatedAt)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Case detail (right columns) ───────────────────────────── */}
          <div className="lg:col-span-2">
            {!selectedCase ? (
              <div className="bg-[#0f0f17] border border-[#1f1f2e] p-16 text-center">
                <FolderOpen className="size-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">Select a case to view details</p>
              </div>
            ) : (
              <div className="space-y-4">

                {/* Detail header */}
                <div
                  className="bg-[#0f0f17] border border-[#1f1f2e] p-6"
                  style={{
                    borderLeftColor: PRIORITY_STYLES[selectedCase.priority].border,
                    borderLeftWidth: 3,
                  }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-xs text-gray-500 font-mono">{selectedCase.id}</p>
                        <span
                          className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 ${
                            STATUS_STYLES[selectedCase.status].color
                          }`}
                        >
                          {STATUS_STYLES[selectedCase.status].icon}
                          {STATUS_STYLES[selectedCase.status].label}
                        </span>
                      </div>
                      <h3 className="text-lg text-white font-medium leading-snug">
                        {selectedCase.title}
                      </h3>
                    </div>
                    <span
                      className={`text-xs font-medium px-3 py-1.5 uppercase flex-shrink-0 ml-4 ${
                        PRIORITY_STYLES[selectedCase.priority].badge
                      }`}
                    >
                      {selectedCase.priority}
                    </span>
                  </div>

                  <p className="text-sm text-gray-400 mb-4">{selectedCase.description}</p>

                  {/* Meta row */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Assignee</p>
                      <div className="flex items-center gap-1.5">
                        <User className="size-3.5 text-gray-400" />
                        <span className="text-sm text-gray-300">{selectedCase.assignee}</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Created</p>
                      <div className="flex items-center gap-1.5">
                        <Clock className="size-3.5 text-gray-400" />
                        <span className="text-sm text-gray-300">{formatTs(selectedCase.createdAt)}</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Updated</p>
                      <div className="flex items-center gap-1.5">
                        <TrendingUp className="size-3.5 text-gray-400" />
                        <span className="text-sm text-gray-300">{formatRelative(selectedCase.updatedAt)}</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Source IPs</p>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="size-3.5 text-gray-400" />
                        <span className="text-sm text-gray-300">{selectedCase.sourceIps.length || '—'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Tags */}
                  {selectedCase.tags.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap mb-4">
                      <Tag className="size-3.5 text-gray-500" />
                      {selectedCase.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-xs px-2 py-0.5 bg-[#1a1a24] border border-[#2a2a3a] text-gray-400"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Status action buttons */}
                  <div className="flex gap-2 pt-4 border-t border-[#1f1f2e]">
                    <button
                      onClick={() => updateCaseStatus('in_progress')}
                      disabled={isUpdatingStatus || selectedCase.status === 'in_progress'}
                      className="px-3 py-1.5 text-xs bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/30 hover:bg-[#f59e0b]/30 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Mark In Progress
                    </button>
                    <button
                      onClick={() => updateCaseStatus('pending_review')}
                      disabled={isUpdatingStatus || selectedCase.status === 'pending_review'}
                      className="px-3 py-1.5 text-xs bg-[#8b5cf6]/20 text-[#8b5cf6] border border-[#8b5cf6]/30 hover:bg-[#8b5cf6]/30 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Pending Review
                    </button>
                    <button
                      onClick={() => updateCaseStatus('closed')}
                      disabled={isUpdatingStatus || selectedCase.status === 'closed'}
                      className="px-3 py-1.5 text-xs bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/30 hover:bg-[#10b981]/30 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Close Case
                    </button>
                    <button
                      onClick={() => updateCaseStatus('open')}
                      disabled={isUpdatingStatus || selectedCase.status === 'open'}
                      className="ml-auto px-3 py-1.5 text-xs bg-[#1a1a24] text-gray-400 border border-[#2a2a3a] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Reopen
                    </button>
                  </div>
                </div>

                {/* Tabs */}
                <div className="bg-[#0f0f17] border border-[#1f1f2e]">
                  <div className="flex border-b border-[#1f1f2e] overflow-x-auto">
                    {(
                      [
                        { key: 'overview', label: 'Overview', icon: Eye, count: undefined },
                        { key: 'alerts', label: 'All Alerts', icon: Shield, count: selectedCase.alerts.length },
                        { key: 'logs', label: 'Related Logs', icon: FileText, count: relatedLogs.length },
                        { key: 'history', label: 'IP History', icon: History, count: ipHistoryAlerts.length },
                        { key: 'timeline', label: 'Timeline', icon: Activity, count: selectedCase.timeline.length },
                        { key: 'notes', label: 'Notes', icon: MessageSquare, count: selectedCase.notes.length },
                      ] as const
                    ).map(({ key, label, icon: Icon, count }) => (
                      <button
                        key={key}
                        onClick={() => setActiveTab(key)}
                        className={`flex items-center gap-2 px-5 py-3 text-sm border-b-2 transition-colors ${
                          activeTab === key
                            ? 'border-[#4f46e5] text-white'
                            : 'border-transparent text-gray-400 hover:text-white'
                        }`}
                      >
                        <Icon className="size-4" />
                        {label}
                        {count !== undefined ? (
                          <span
                            className={`text-xs px-1.5 py-0.5 ${
                              activeTab === key
                                ? 'bg-[#4f46e5]/30 text-[#a5b4fc]'
                                : 'bg-[#1a1a24] text-gray-500'
                            }`}
                          >
                            {count}
                          </span>
                        ) : null}
                      </button>
                    ))}
                  </div>

                  <div className="p-5">

                    {/* ── Overview tab ────────────────────────────── */}
                    {activeTab === 'overview' && caseStats && (
                      <div className="space-y-5">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {[
                            { label: 'Case alerts', value: caseStats.totalAlerts },
                            { label: 'Open', value: caseStats.openAlerts },
                            { label: 'Investigating', value: caseStats.investigating },
                            { label: 'Confirmed threats', value: caseStats.confirmedThreats },
                            { label: 'Related logs', value: caseStats.relatedLogs },
                            { label: 'Unique IPs', value: caseStats.uniqueIps },
                            { label: 'IP history', value: ipHistoryAlerts.length },
                          ].map(({ label, value }) => (
                            <div
                              key={label}
                              className="bg-[#1a1a24] border border-[#2a2a3a] px-4 py-3"
                            >
                              <p className="text-xs text-gray-500 mb-1">{label}</p>
                              <p className="text-xl font-semibold text-white">{value}</p>
                            </div>
                          ))}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-[#1a1a24] border border-[#2a2a3a] p-4">
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">
                              Rule & scope
                            </p>
                            <p className="text-sm text-white font-medium">{selectedCase.ruleName}</p>
                            <p className="text-xs text-gray-500 font-mono mt-1">{selectedCase.ruleKey}</p>
                            <p className="text-xs text-gray-400 mt-3">
                              First seen {formatTs(caseStats.firstSeen)} · Last{' '}
                              {formatRelative(caseStats.lastSeen)}
                            </p>
                          </div>
                          <div className="bg-[#1a1a24] border border-[#2a2a3a] p-4">
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">
                              Source IPs
                            </p>
                            {selectedCase.sourceIps.length === 0 ? (
                              <p className="text-sm text-gray-500">No IP recorded</p>
                            ) : (
                              <ul className="space-y-1">
                                {selectedCase.sourceIps.map((ip) => (
                                  <li key={ip} className="text-sm text-gray-300 font-mono">
                                    {ip}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>

                        {recommendations.length > 0 && (
                          <div className="bg-[#1a1a24] border border-[#2a2a3a] p-4">
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">
                              Recommendations (from alerts)
                            </p>
                            <ul className="space-y-2">
                              {recommendations.map((rec) => (
                                <li
                                  key={rec}
                                  className="text-sm text-gray-300 flex gap-2 leading-relaxed"
                                >
                                  <span className="text-[#4f46e5]">•</span>
                                  <span>{rec}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── All alerts tab ───────────────────────────────── */}
                    {activeTab === 'alerts' && (
                      <div className="space-y-3">
                        {selectedCase.alerts.length === 0 ? (
                          <p className="text-sm text-gray-500 text-center py-8">No alerts in this case.</p>
                        ) : (
                          selectedCase.alerts.map((alert) => {
                            const alertId = getAlertId(alert);
                            const severity = (readString(alert.severity) ?? 'low').toLowerCase();
                            const isExpanded = expandedAlertId === alertId;
                            const ctx =
                              typeof alert.context === 'object' && alert.context
                                ? (alert.context as Record<string, unknown>)
                                : {};

                            return (
                              <div
                                key={alertId}
                                className="border border-[#2a2a3a] bg-[#1a1a24]"
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedAlertId(isExpanded ? null : alertId)
                                  }
                                  className="w-full flex items-start justify-between gap-3 px-4 py-3 text-left hover:bg-[#22222f]"
                                >
                                  <div className="flex items-start gap-3 min-w-0">
                                    <div
                                      className={`size-2 rounded-full mt-1.5 flex-shrink-0 ${
                                        SEVERITY_DOT[severity] ?? 'bg-gray-500'
                                      }`}
                                    />
                                    <div className="min-w-0">
                                      <p className="text-sm text-white font-medium">
                                        {readString(alert.rule_name) ??
                                          humanizeRule(readString(alert.rule_id))}
                                      </p>
                                      <p className="text-xs text-gray-500 font-mono mt-0.5">
                                        {getAlertIp(alert)} · {formatTs(getAlertTimestamp(alert))}
                                        {typeof alert.occurrenceCount === 'number' &&
                                        alert.occurrenceCount > 1
                                          ? ` · ×${alert.occurrenceCount}`
                                          : ''}
                                      </p>
                                      <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                                        {readString(alert.message) ?? 'No message'}
                                      </p>
                                    </div>
                                  </div>
                                  <span
                                    className={`text-xs font-medium px-2 py-0.5 uppercase flex-shrink-0 ${
                                      PRIORITY_STYLES[severity as CasePriority]?.badge ??
                                      'bg-gray-500 text-white'
                                    }`}
                                  >
                                    {severity}
                                  </span>
                                </button>

                                {isExpanded && (
                                  <div className="px-4 pb-4 border-t border-[#2a2a3a] space-y-3">
                                    <div className="grid grid-cols-2 gap-3 text-xs">
                                      <div>
                                        <span className="text-gray-500">Status</span>
                                        <p className="mt-1">
                                          <span
                                            className={`inline-block px-2 py-0.5 text-xs font-medium ${getAlertStatusColor(
                                              normalizeAlertUiStatus(readString(alert.status)),
                                            )}`}
                                          >
                                            {getAlertStatusLabel(
                                              normalizeAlertUiStatus(readString(alert.status)),
                                            )}
                                          </span>
                                        </p>
                                      </div>
                                      <div>
                                        <span className="text-gray-500">Alert ID</span>
                                        <p className="text-gray-300 font-mono mt-0.5 break-all">
                                          {alertId}
                                        </p>
                                      </div>
                                      {alert.attackerLocation ? (
                                        <div className="col-span-2">
                                          <span className="text-gray-500">Location</span>
                                          <p className="text-gray-300 mt-0.5">
                                            {alert.attackerLocation}
                                            {alert.geo?.isp ? ` · ${alert.geo.isp}` : ''}
                                          </p>
                                        </div>
                                      ) : null}
                                    </div>
                                    {Object.keys(ctx).length > 0 && (
                                      <pre className="text-xs text-gray-400 bg-[#0a0a0f] border border-[#2a2a3a] p-3 overflow-x-auto max-h-48">
                                        {JSON.stringify(ctx, null, 2)}
                                      </pre>
                                    )}
                                    <div className="flex flex-wrap gap-2 pt-1">
                                      {(
                                        [
                                          ['investigating', 'Investigating'],
                                          ['threat', 'Confirm Threat'],
                                          ['resolved', 'Resolved'],
                                          ['false_positive', 'False Positive'],
                                        ] as const
                                      ).map(([status, label]) => {
                                        const uiStatus = normalizeAlertUiStatus(
                                          readString(alert.status),
                                        );
                                        return (
                                          <button
                                            key={status}
                                            type="button"
                                            disabled={
                                              updatingAlertId === alertId ||
                                              uiStatus === status
                                            }
                                            onClick={() =>
                                              void updateAlertDisposition(alertId, status)
                                            }
                                            className={`px-2.5 py-1 text-xs border disabled:opacity-40 disabled:cursor-not-allowed ${
                                              status === 'threat'
                                                ? 'bg-[#dc2626]/20 text-[#fca5a5] border-[#ef4444]/40 hover:bg-[#dc2626]/30'
                                                : 'bg-[#1a1a24] text-gray-300 border-[#2a2a3a] hover:text-white'
                                            }`}
                                          >
                                            {label}
                                          </button>
                                        );
                                      })}
                                    </div>
                                    <button
                                      type="button"
                                      disabled={deepDiveLoading}
                                      onClick={() => void openAlertDeepDive(alert)}
                                      className="flex items-center gap-2 text-xs text-[#a5b4fc] hover:text-white disabled:opacity-50"
                                    >
                                      <ExternalLink className="size-3.5" />
                                      Open full alert report
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}

                    {/* ── Related logs tab ─────────────────────────────── */}
                    {activeTab === 'logs' && (
                      <div className="space-y-2">
                        {relatedLogs.length === 0 ? (
                          <p className="text-sm text-gray-500 text-center py-8">
                            No related logs in the last 48h window (matched by source IP or rule type).
                          </p>
                        ) : (
                          <div className="overflow-x-auto border border-[#2a2a3a]">
                            <table className="w-full text-left text-sm">
                              <thead className="bg-[#1a1a24] text-xs text-gray-500 uppercase">
                                <tr>
                                  <th className="px-3 py-2">Time</th>
                                  <th className="px-3 py-2">Severity</th>
                                  <th className="px-3 py-2">Event</th>
                                  <th className="px-3 py-2">IP</th>
                                  <th className="px-3 py-2">Source</th>
                                  <th className="px-3 py-2">Message</th>
                                </tr>
                              </thead>
                              <tbody>
                                {relatedLogs.map((log) => (
                                  <tr
                                    key={
                                      readString(log._id) ??
                                      readString(log.event_id) ??
                                      `${log.timestamp}-${log.event}`
                                    }
                                    className="border-t border-[#2a2a3a] hover:bg-[#1a1a24]"
                                  >
                                    <td className="px-3 py-2 text-gray-400 whitespace-nowrap">
                                      {formatTs(log.timestamp)}
                                    </td>
                                    <td className="px-3 py-2">
                                      <span className="text-xs uppercase text-gray-300">
                                        {readString(log.severity) ?? '—'}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 font-mono text-xs text-gray-300">
                                      {readString(log.event) ?? '—'}
                                    </td>
                                    <td className="px-3 py-2 font-mono text-xs text-gray-300">
                                      {readString(log.ip) ?? '—'}
                                    </td>
                                    <td className="px-3 py-2 text-gray-400">
                                      {readString(log.source) ?? '—'}
                                    </td>
                                    <td className="px-3 py-2 text-gray-400 max-w-xs truncate">
                                      {readString(log.message) ?? '—'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                        <p className="text-xs text-gray-600 text-center">
                          Showing {relatedLogs.length} log(s) near case timeframe
                        </p>
                      </div>
                    )}

                    {/* ── IP alert history tab ─────────────────────────── */}
                    {activeTab === 'history' && (
                      <div className="space-y-2">
                        {ipHistoryAlerts.length === 0 ? (
                          <p className="text-sm text-gray-500 text-center py-8">
                            No other alerts from these IPs outside this case rule group.
                          </p>
                        ) : (
                          ipHistoryAlerts.map((alert) => {
                            return (
                              <div
                                key={getAlertId(alert)}
                                className="flex items-center justify-between bg-[#1a1a24] border border-[#2a2a3a] px-4 py-3"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <Server className="size-4 text-gray-500 flex-shrink-0" />
                                  <div className="min-w-0">
                                    <p className="text-sm text-white truncate">
                                      {readString(alert.rule_name) ??
                                        humanizeRule(readString(alert.rule_id))}
                                    </p>
                                    <p className="text-xs text-gray-500 font-mono mt-0.5">
                                      {getAlertIp(alert)} · {formatTs(getAlertTimestamp(alert))}
                                    </p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => void openAlertDeepDive(alert)}
                                  className="text-xs text-[#a5b4fc] hover:text-white flex-shrink-0 ml-2"
                                >
                                  View
                                </button>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}

                    {/* ── Timeline tab ──────────────────────────────────── */}
                    {activeTab === 'timeline' && (
                      <div className="space-y-0">
                        {selectedCase.timeline.length === 0 ? (
                          <p className="text-sm text-gray-500 text-center py-8">No timeline entries yet.</p>
                        ) : (
                          [...selectedCase.timeline].reverse().map((entry, idx) => (
                            <div key={entry.id} className="flex gap-4">
                              {/* Spine */}
                              <div className="flex flex-col items-center">
                                <div className="size-2.5 rounded-full bg-[#4f46e5] flex-shrink-0 mt-1" />
                                {idx < selectedCase.timeline.length - 1 && (
                                  <div className="w-px flex-1 bg-[#2a2a3a] mt-1" />
                                )}
                              </div>
                              {/* Content */}
                              <div className="pb-5 flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-sm text-white font-medium">{entry.actor}</span>
                                  <span className="text-xs text-gray-500">{entry.action}</span>
                                </div>
                                {entry.detail && (
                                  <p className="text-xs text-gray-400 bg-[#1a1a24] border border-[#2a2a3a] px-3 py-2 mt-1 font-mono">
                                    {entry.detail}
                                  </p>
                                )}
                                <p className="text-xs text-gray-600 mt-1">
                                  {formatTs(entry.timestamp)}
                                </p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {/* ── Notes tab ─────────────────────────────────────── */}
                    {activeTab === 'notes' && (
                      <div className="space-y-4">
                        {/* Existing notes */}
                        {selectedCase.notes.length === 0 ? (
                          <p className="text-sm text-gray-500 text-center py-4">
                            No notes yet. Add your first note below.
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {selectedCase.notes.map((note) => (
                              <div
                                key={note.id}
                                className="bg-[#1a1a24] border border-[#2a2a3a] p-4"
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <div className="size-6 bg-[#4f46e5] flex items-center justify-center">
                                      <span className="text-xs text-white font-medium">
                                        {note.author.charAt(0).toUpperCase()}
                                      </span>
                                    </div>
                                    <span className="text-sm text-white">{note.author}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500">{formatTs(note.timestamp)}</span>
                                    <MoreHorizontal className="size-4 text-gray-600" />
                                  </div>
                                </div>
                                <p className="text-sm text-gray-300 leading-relaxed pl-8">
                                  {note.content}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Add note input */}
                        <div className="border border-[#2a2a3a] bg-[#1a1a24]">
                          <textarea
                            ref={noteRef}
                            value={noteInput}
                            onChange={(e) => setNoteInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addNote();
                            }}
                            placeholder="Add an investigation note... (Ctrl+Enter to submit)"
                            rows={3}
                            className="w-full bg-transparent px-4 pt-3 pb-2 text-sm text-white placeholder:text-gray-600 focus:outline-none resize-none"
                          />
                          <div className="flex items-center justify-between px-4 pb-3">
                            <div className="flex items-center gap-2 text-gray-600">
                              <Paperclip className="size-4 cursor-pointer hover:text-gray-400" />
                            </div>
                            <button
                              onClick={addNote}
                              disabled={!noteInput.trim()}
                              className="flex items-center gap-2 px-3 py-1.5 bg-[#4f46e5] hover:bg-[#4338ca] text-white text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <Send className="size-3" />
                              Add Note
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      <AlertDeepDiveModal
        alert={deepDiveAlert}
        isOpen={deepDiveOpen}
        onClose={() => {
          setDeepDiveOpen(false);
          setDeepDiveAlert(null);
        }}
      />
    </div>
  );
}