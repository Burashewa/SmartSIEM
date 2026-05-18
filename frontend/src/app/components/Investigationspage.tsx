import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  FolderOpen, Plus, Clock, User, AlertTriangle, CheckCircle,
  XCircle, ChevronRight, MessageSquare, Link2, Search,
  RefreshCw, Shield, Activity, TrendingUp, Send, Tag,
  MoreHorizontal, Paperclip, Eye,
} from 'lucide-react';
import { fetchAlerts, type BackendAlertRecord } from '../api/dashboard';

// ─── Types ──────────────────────────────────────────────────────────────────

type CaseStatus = 'open' | 'in_progress' | 'pending_review' | 'closed';
type CasePriority = 'critical' | 'high' | 'medium' | 'low';

interface TimelineEntry {
  id: string;
  actor: string;
  action: string;
  detail?: string;
  timestamp: string;
}

interface CaseNote {
  id: string;
  author: string;
  content: string;
  timestamp: string;
}

interface LinkedAlert {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  sourceIp: string;
  timestamp: string;
}

interface Case {
  id: string;
  title: string;
  description: string;
  status: CaseStatus;
  priority: CasePriority;
  assignee: string;
  createdAt: string;
  updatedAt: string;
  linkedAlerts: LinkedAlert[];
  notes: CaseNote[];
  timeline: TimelineEntry[];
  tags: string[];
  resolutionNotes?: string;
}

type StatusFilter = 'all' | CaseStatus;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const readString = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim() : undefined;

const humanizeRule = (id?: string): string => {
  if (!id) return 'Security Alert';
  return id.replace(/[-_]+/g, ' ').split(' ').filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

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

// Build synthetic cases from alert data grouped by rule
const buildCasesFromAlerts = (alerts: BackendAlertRecord[]): Case[] => {
  const groupMap = new Map<string, BackendAlertRecord[]>();

  for (const alert of alerts) {
    const key =
      readString(alert.rule_id) ??
      readString(alert.rule_name) ??
      'unknown';
    const arr = groupMap.get(key) ?? [];
    arr.push(alert);
    groupMap.set(key, arr);
  }

  const cases: Case[] = [];
  let idx = 1;

  for (const [key, group] of groupMap.entries()) {
    const sorted = [...group].sort(
      (a, b) =>
        new Date(b.trigger_time ?? 0).getTime() -
        new Date(a.trigger_time ?? 0).getTime(),
    );
    const first = sorted[0];
    const oldest = sorted[sorted.length - 1];

    const severities = group.map((a) =>
      (readString(a.severity) ?? 'low').toLowerCase(),
    );
    const priority: CasePriority = severities.includes('critical')
      ? 'critical'
      : severities.includes('high')
      ? 'high'
      : severities.includes('medium')
      ? 'medium'
      : 'low';

    const rawStatus = readString(first.status) ?? 'open';
    const status: CaseStatus =
      rawStatus === 'investigating' ? 'in_progress'
      : rawStatus === 'resolved' || rawStatus === 'closed' ? 'closed'
      : rawStatus === 'false_positive' ? 'closed'
      : 'open';

    const ruleName = readString(first.rule_name) ?? humanizeRule(key);
    const caseId = `CASE-${String(idx).padStart(4, '0')}`;

    const linkedAlerts: LinkedAlert[] = group.slice(0, 5).map((a) => ({
      id: readString(a.alert_id) ?? readString(a._id) ?? a.id ?? caseId,
      title: readString(a.rule_name) ?? humanizeRule(readString(a.rule_id)),
      severity: (readString(a.severity) ?? 'low').toLowerCase() as LinkedAlert['severity'],
      sourceIp: readString(a.ip) ?? 'Unknown',
      timestamp: formatTs(a.trigger_time ?? new Date().toISOString()),
    }));

    const createdAt = oldest.trigger_time ?? new Date().toISOString();
    const updatedAt = first.trigger_time ?? new Date().toISOString();

    const timeline: TimelineEntry[] = [
      {
        id: `${caseId}-t1`,
        actor: 'Detection Engine',
        action: 'Case auto-created from grouped alerts',
        detail: `${group.length} alert(s) matched rule: ${ruleName}`,
        timestamp: createdAt,
      },
      ...(status === 'in_progress'
        ? [{
            id: `${caseId}-t2`,
            actor: 'System Analyst',
            action: 'Status changed to In Progress',
            timestamp: updatedAt,
          }]
        : []),
      ...(status === 'closed'
        ? [{
            id: `${caseId}-t3`,
            actor: 'System Analyst',
            action: 'Case closed',
            timestamp: updatedAt,
          }]
        : []),
    ];

    cases.push({
      id: caseId,
      title: `${ruleName} — ${group.length} event${group.length > 1 ? 's' : ''}`,
      description: `Grouped investigation for rule "${ruleName}". ${group.length} alert(s) triggered from ${new Set(group.map((a) => readString(a.ip) ?? 'unknown')).size} unique source IP(s).`,
      status,
      priority,
      assignee: 'Unassigned',
      createdAt,
      updatedAt,
      linkedAlerts,
      notes: [],
      timeline,
      tags: [ruleName.split(' ')[0], priority],
    });

    idx++;
  }

  return cases.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
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
  const [cases, setCases] = useState<Case[]>([]);
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | CasePriority>('all');
  const [search, setSearch] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [activeTab, setActiveTab] = useState<'timeline' | 'alerts' | 'notes'>('timeline');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const loadCases = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const alerts = await fetchAlerts();
      const built = buildCasesFromAlerts(alerts);
      setCases(built);
      if (built.length > 0 && !selectedCase) setSelectedCase(built[0]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cases');
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
        const alerts = await fetchAlerts();
        if (cancelled) return;
        const built = buildCasesFromAlerts(alerts);
        setCases(built);
        if (built.length > 0) setSelectedCase(built[0]);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load cases');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void run();
    return () => { cancelled = true; };
  }, []);

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

    const updated: Case = {
      ...selectedCase,
      status: newStatus,
      updatedAt: new Date().toISOString(),
      timeline: [...selectedCase.timeline, timelineEntry],
    };

    setCases((prev) => prev.map((c) => (c.id === selectedCase.id ? updated : c)));
    setSelectedCase(updated);
    setTimeout(() => setIsUpdatingStatus(false), 400);
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

    const updated: Case = {
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
              Group alerts into tracked investigations with timeline and notes
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
                      onClick={() => { setSelectedCase(c); setActiveTab('timeline'); }}
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
                          <span>{c.linkedAlerts.length} alerts</span>
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
                      <p className="text-xs text-gray-500 mb-1">Linked Alerts</p>
                      <div className="flex items-center gap-1.5">
                        <Link2 className="size-3.5 text-gray-400" />
                        <span className="text-sm text-gray-300">{selectedCase.linkedAlerts.length}</span>
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
                  <div className="flex border-b border-[#1f1f2e]">
                    {(
                      [
                        { key: 'timeline', label: 'Timeline', icon: Activity, count: selectedCase.timeline.length },
                        { key: 'alerts',   label: 'Linked Alerts', icon: Shield, count: selectedCase.linkedAlerts.length },
                        { key: 'notes',    label: 'Notes', icon: MessageSquare, count: selectedCase.notes.length },
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
                        <span
                          className={`text-xs px-1.5 py-0.5 ${
                            activeTab === key
                              ? 'bg-[#4f46e5]/30 text-[#a5b4fc]'
                              : 'bg-[#1a1a24] text-gray-500'
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className="p-5">

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

                    {/* ── Linked alerts tab ─────────────────────────────── */}
                    {activeTab === 'alerts' && (
                      <div className="space-y-2">
                        {selectedCase.linkedAlerts.length === 0 ? (
                          <p className="text-sm text-gray-500 text-center py-8">No linked alerts.</p>
                        ) : (
                          selectedCase.linkedAlerts.map((alert) => (
                            <div
                              key={alert.id}
                              className="flex items-center justify-between bg-[#1a1a24] border border-[#2a2a3a] px-4 py-3"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div
                                  className={`size-2 rounded-full flex-shrink-0 ${
                                    SEVERITY_DOT[alert.severity] ?? 'bg-gray-500'
                                  }`}
                                />
                                <div className="min-w-0">
                                  <p className="text-sm text-white truncate">{alert.title}</p>
                                  <p className="text-xs text-gray-500 font-mono mt-0.5">
                                    {alert.sourceIp} · {alert.timestamp}
                                  </p>
                                </div>
                              </div>
                              <span
                                className={`text-xs font-medium px-2 py-0.5 uppercase flex-shrink-0 ml-3 ${
                                  PRIORITY_STYLES[alert.severity as CasePriority]?.badge ?? 'bg-gray-500 text-white'
                                }`}
                              >
                                {alert.severity}
                              </span>
                            </div>
                          ))
                        )}
                        {selectedCase.linkedAlerts.length > 0 && (
                          <p className="text-xs text-gray-600 text-center pt-1">
                            Showing top {selectedCase.linkedAlerts.length} linked alert(s)
                          </p>
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
    </div>
  );
}