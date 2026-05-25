import { useEffect, useMemo, useReducer, useState } from 'react';
import {
  Filter,
  ChevronDown,
  ChevronRight,
  Trash2,
} from 'lucide-react';
import { fetchLogs, deleteLog, type BackendLogRecord } from '../api/dashboard';
import { fetchAgents, type AgentRecord } from '../api/agents';

interface LogDetails {
  eventId?: string;
  agentId?: string;
  userId?: string;
  event?: string;
  action?: string;
  status?: string;
  user?: string;
  role?: string;
  ip?: string;
  endpoint?: string;
  method?: string;
  resource?: string | null;
  deviceId?: string;
  sessionId?: string;
  userAgent?: string;
  latitude?: number;
  longitude?: number;
  tags?: string[];
  payload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  raw?: Record<string, unknown>;
}

interface LogEntry {
  id: string;
  timestamp: string;
  level: string;
  source: string;
  message: string;
  details: LogDetails;
}

interface FilterState {
  ip: string;
  agent: string;
}

type FilterAction =
  | { type: 'SET_FILTER'; key: keyof FilterState; value: string }
  | { type: 'RESET' };

const defaultFilters: FilterState = {
  ip: '',
  agent: '',
};

function filterReducer(state: FilterState, action: FilterAction): FilterState {
  switch (action.type) {
    case 'SET_FILTER':
      return { ...state, [action.key]: action.value };

    case 'RESET':
      return defaultFilters;

    default:
      return state;
  }
}

const normalizeLog = (log: BackendLogRecord): LogEntry => {
  const messageParts = [log.event, log.action, log.status]
    .filter(Boolean)
    .map((part) => String(part).replace(/_/g, ' '));

  return {
    id: log._id ?? log.id ?? log.event_id ?? `${log.event}-${log.timestamp}`,
    timestamp: new Date(log.timestamp).toLocaleString(),
    level: String(log.level ?? log.severity).toUpperCase(),
    source: log.source ?? 'Unknown source',
    message:
      log.message ??
      (messageParts.length > 0 ? messageParts.join(' ') : log.event),
    details: {
      eventId: log.event_id,
      agentId: log.agentId,
      userId: log.userId ? String(log.userId) : undefined,
      event: log.event,
      action: log.action,
      status: log.status,
      user: log.user,
      role: log.role,
      ip: log.ip,
      endpoint: log.endpoint,
      resource: log.resource,
      method: log.method,
      deviceId: log.deviceId,
      sessionId: log.sessionId,
      userAgent: log.userAgent,
      latitude: log.latitude,
      longitude: log.longitude,
      tags: log.tags,
      payload: log.payload,
      metadata: log.metadata,
      raw: log.raw,
    },
  };
};

const ROW_SUMMARY_KEYS = new Set([
  'timestamp',
  'level',
  'source',
  'message',
  'severity',
  'id',
]);

const NESTED_CONTAINER_KEYS = new Set(['payload', 'metadata', 'raw']);

function normalizeDetailKey(key: string): string {
  return key.toLowerCase().replace(/[_-]/g, '');
}

function isEmptyValue(value: unknown): boolean {
  if (value == null || value === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value as object).length === 0
  ) {
    return true;
  }
  return false;
}

function isMessageDerived(log: LogEntry): boolean {
  const { event, action, status } = log.details;
  const parts = [event, action, status]
    .filter(Boolean)
    .map((part) => String(part).replace(/_/g, ' '));

  if (parts.length === 0) return false;
  return log.message.trim() === parts.join(' ');
}

function mergeUniqueFields(
  target: Record<string, unknown>,
  seen: Set<string>,
  exclude: Set<string>,
  source?: Record<string, unknown>,
) {
  if (!source) return;

  for (const [key, value] of Object.entries(source)) {
    const norm = normalizeDetailKey(key);
    if (exclude.has(norm) || NESTED_CONTAINER_KEYS.has(norm) || seen.has(norm)) {
      continue;
    }
    if (isEmptyValue(value)) continue;

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      for (const [nestedKey, nestedValue] of Object.entries(value)) {
        const nestedNorm = normalizeDetailKey(nestedKey);
        if (exclude.has(nestedNorm) || seen.has(nestedNorm) || isEmptyValue(nestedValue)) {
          continue;
        }
        if (
          typeof nestedValue === 'object' &&
          nestedValue !== null &&
          !Array.isArray(nestedValue)
        ) {
          continue;
        }
        seen.add(nestedNorm);
        target[nestedKey] = nestedValue;
      }
      continue;
    }

    seen.add(norm);
    target[key] = value;
  }
}

function buildCleanLogJson(
  log: LogEntry,
  agentName?: string,
): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  const seen = new Set<string>();
  const exclude = new Set(ROW_SUMMARY_KEYS);

  if (isMessageDerived(log)) {
    exclude.add('event');
    exclude.add('action');
    exclude.add('status');
  }

  const assign = (key: string, value: unknown) => {
    if (isEmptyValue(value)) return;
    const norm = normalizeDetailKey(key);
    if (exclude.has(norm) || seen.has(norm)) return;
    seen.add(norm);
    clean[key] = value;
  };

  if (log.details.agentId) {
    const agent: Record<string, unknown> = { id: log.details.agentId };
    if (agentName) agent.name = agentName;
    assign('agent', agent);
  }

  const scalarKeys: Array<keyof LogDetails> = [
    'eventId',
    'userId',
    'user',
    'role',
    'ip',
    'endpoint',
    'method',
    'resource',
    'deviceId',
    'sessionId',
    'userAgent',
    'tags',
  ];

  if (!isMessageDerived(log)) {
    scalarKeys.unshift('event', 'action', 'status');
  }

  for (const key of scalarKeys) {
    assign(key, log.details[key]);
  }

  if (log.details.latitude != null || log.details.longitude != null) {
    assign('location', {
      latitude: log.details.latitude ?? null,
      longitude: log.details.longitude ?? null,
    });
  }

  mergeUniqueFields(clean, seen, exclude, log.details.payload);
  mergeUniqueFields(clean, seen, exclude, log.details.metadata);
  mergeUniqueFields(clean, seen, exclude, log.details.raw);

  return clean;
}

export function LogManagementPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [selectedLog, setSelectedLog] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [singleDeleteTarget, setSingleDeleteTarget] = useState<string | null>(null);
  const [isBulkConfirmOpen, setIsBulkConfirmOpen] = useState(false);
  const [singleDeleteErrorToast, setSingleDeleteErrorToast] = useState<string | null>(
    null,
  );
  const [bulkDeleteFailedIds, setBulkDeleteFailedIds] = useState<string[]>([]);
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [isAgentsLoading, setIsAgentsLoading] = useState(true);

  const [filters, dispatch] = useReducer(filterReducer, defaultFilters, (init) => {
    if (typeof window === 'undefined') return init;

    const params = new URLSearchParams(window.location.search);

    return {
      ip: params.get('ip') ?? init.ip,
      agent: params.get('agent') ?? init.agent,
    };
  });

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [debouncedIp, setDebouncedIp] = useState(filters.ip);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedIp(filters.ip), 350);
    return () => clearTimeout(t);
  }, [filters.ip]);

  useEffect(() => {
    let isMounted = true;

    const loadAgents = async () => {
      setIsAgentsLoading(true);
      try {
        const response = await fetchAgents();
        if (!isMounted) return;
        setAgents(
          [...response].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
        );
      } catch {
        if (!isMounted) return;
        setAgents([]);
      } finally {
        if (isMounted) setIsAgentsLoading(false);
      }
    };

    void loadAgents();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadLogs = async () => {
      setIsLoading(true);
      try {
        const response = await fetchLogs();
        if (!isMounted) return;
        setLogs(response.map(normalizeLog));
        setError(null);
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load logs');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void loadLogs();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();

    if (filters.ip) params.set('ip', filters.ip);
    if (filters.agent) params.set('agent', filters.agent);

    const query = params.toString();
    window.history.replaceState(
      null,
      '',
      query ? `?${query}` : window.location.pathname,
    );
  }, [filters]);

  useEffect(() => {
    if (!singleDeleteErrorToast) return;
    const timer = window.setTimeout(() => setSingleDeleteErrorToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [singleDeleteErrorToast]);

  const filteredLogs = useMemo(() => {
    const ipQuery = debouncedIp.trim().toLowerCase();
    const selectedAgentId = filters.agent.trim();

    return logs.filter((log) => {
      const logIp = String(log.details.ip ?? '').toLowerCase();
      const logAgentId = String(log.details.agentId ?? '');

      const ipOk = !ipQuery || logIp.includes(ipQuery);
      const agentOk =
        !selectedAgentId || logAgentId === selectedAgentId;

      return ipOk && agentOk;
    });
  }, [logs, debouncedIp, filters.agent]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters.ip, filters.agent]);

  const pageCount = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage]);

  const visibleIds = useMemo(() => filteredLogs.map((log) => log.id), [filteredLogs]);

  const agentNameById = useMemo(
    () => Object.fromEntries(agents.map((agent) => [agent.agentId, agent.name])),
    [agents],
  );

  const selectedCount = selectedIds.size;

  const allVisibleSelected = useMemo(
    () => visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id)),
    [visibleIds, selectedIds],
  );

  const isSomeVisibleSelected = useMemo(
    () => visibleIds.some((id) => selectedIds.has(id)),
    [visibleIds, selectedIds],
  );


  const getLevelColor = (level: string) => {
    switch (level) {
      case 'CRITICAL':
        return 'text-[#dc2626]';
      case 'HIGH':
        return 'text-[#ef4444]';
      case 'MEDIUM':
        return 'text-[#f59e0b]';
      case 'LOW':
        return 'text-[#3b82f6]';
      case 'ERROR':
        return 'text-[#ef4444]';
      case 'WARN':
        return 'text-[#f59e0b]';
      case 'INFO':
        return 'text-[#3b82f6]';
      case 'DEBUG':
        return 'text-[#6b7280]';
      default:
        return 'text-gray-400';
    }
  };

  const toggleRowSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);

      if (allVisibleSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }

      return next;
    });
  };

  const restoreEntries = (entriesToRestore: Array<{ entry: LogEntry; index: number }>) => {
    setLogs((prev) => {
      const next = [...prev];

      entriesToRestore
        .sort((a, b) => a.index - b.index)
        .forEach(({ entry, index }) => {
          if (next.some((existing) => existing.id === entry.id)) {
            return;
          }
          const safeIndex = Math.max(0, Math.min(index, next.length));
          next.splice(safeIndex, 0, entry);
        });

      return next;
    });
  };

  const handleConfirmSingleDelete = async () => {
    if (!singleDeleteTarget) return;

    const targetId = singleDeleteTarget;
    const previousIndex = logs.findIndex((log) => log.id === targetId);
    const removedEntry = previousIndex >= 0 ? logs[previousIndex] : null;
    const wasSelected = selectedIds.has(targetId);

    if (!removedEntry || previousIndex < 0) {
      setSingleDeleteTarget(null);
      return;
    }

    setLogs((prev) => prev.filter((log) => log.id !== targetId));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(targetId);
      return next;
    });
    setSelectedLog((prev) => (prev === targetId ? null : prev));
    setBulkDeleteFailedIds((prev) => prev.filter((id) => id !== targetId));

    try {
      await deleteLog(targetId);
    } catch {
      restoreEntries([{ entry: removedEntry, index: previousIndex }]);
      if (wasSelected) {
        setSelectedIds((prev) => new Set(prev).add(targetId));
      }
      setSingleDeleteErrorToast(`Failed to delete log ${targetId}. Changes were reverted.`);
    } finally {
      setSingleDeleteTarget(null);
    }
  };

  const handleBulkDelete = async () => {
    const idsToDelete = Array.from(selectedIds);
    if (idsToDelete.length === 0) return;

    const byId = new Map(logs.map((entry, index) => [entry.id, { entry, index }]));
    const removedEntries = idsToDelete
      .map((id) => {
        const tracked = byId.get(id);
        if (!tracked) return null;
        return { id, ...tracked };
      })
      .filter((value): value is { id: string; entry: LogEntry; index: number } => Boolean(value));

    setLogs((prev) => prev.filter((entry) => !selectedIds.has(entry.id)));
    setSelectedLog((prev) => (prev && selectedIds.has(prev) ? null : prev));
    setBulkDeleteFailedIds([]);

    const results = await Promise.allSettled(idsToDelete.map((id) => deleteLog(id)));
    const failedIds = idsToDelete.filter((_, index) => results[index].status === 'rejected');

    if (failedIds.length > 0) {
      const failedSet = new Set(failedIds);
      restoreEntries(
        removedEntries
          .filter((entry) => failedSet.has(entry.id))
          .map((entry) => ({ entry: entry.entry, index: entry.index })),
      );
      setSelectedIds(new Set(failedIds));
      setBulkDeleteFailedIds(failedIds);
    } else {
      setSelectedIds(new Set());
      setBulkDeleteFailedIds([]);
    }

    setIsBulkConfirmOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* FILTER ENGINE */}
      <div className="bg-[#0f0f17] border border-[#1f1f2e] p-6">
        <h2 className="text-xl font-medium text-white mb-4">
          Log Management
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm text-gray-400">IP address</label>
            <input
              value={filters.ip}
              onChange={(e) =>
                dispatch({
                  type: 'SET_FILTER',
                  key: 'ip',
                  value: e.target.value,
                })
              }
              className="w-full mt-2 bg-[#1a1a24] border border-[#2a2a3a] px-3 py-2 text-sm text-white"
              placeholder="192.168.1.10"
            />
          </div>

          <div>
            <label className="text-sm text-gray-400">Agent</label>
            <select
              value={filters.agent}
              disabled={isAgentsLoading}
              onChange={(e) =>
                dispatch({
                  type: 'SET_FILTER',
                  key: 'agent',
                  value: e.target.value,
                })
              }
              className="w-full mt-2 bg-[#1a1a24] border border-[#2a2a3a] px-3 py-2 text-sm text-white disabled:opacity-50"
            >
              <option value="">
                {isAgentsLoading ? 'Loading agents...' : 'All agents'}
              </option>
              {filters.agent &&
                !agents.some((agent) => agent.agentId === filters.agent) && (
                  <option value={filters.agent}>{filters.agent} (unavailable)</option>
                )}
              {agents.map((agent) => (
                <option key={agent.agentId} value={agent.agentId}>
                  {agent.name} ({agent.agentId})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end gap-2">
            <button
              onClick={() => dispatch({ type: 'RESET' })}
              className="flex-1 bg-[#4f46e5] text-white px-4 py-2 text-sm"
            >
              <Filter className="inline size-4 mr-2" />
              Reset
            </button>
          </div>
        </div>

      </div>

      {/* RESULTS */}
      <div className="bg-[#0f0f17] border border-[#1f1f2e]">
        <div className="px-6 py-4 border-b border-[#1f1f2e] space-y-3">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-white font-medium">
              Logs ({filteredLogs.length.toLocaleString()})
            </h3>
            <label className="inline-flex items-center gap-2 text-xs text-gray-300">
              <input
                type="checkbox"
                className="size-4 accent-indigo-500"
                checked={allVisibleSelected}
                ref={(el) => {
                  if (!el) return;
                  el.indeterminate = isSomeVisibleSelected && !allVisibleSelected;
                }}
                onChange={toggleSelectAllVisible}
              />
              Select all visible
            </label>
          </div>
          {singleDeleteErrorToast && (
            <div className="border border-red-700/40 bg-red-600/10 px-3 py-2 text-xs text-red-300">
              {singleDeleteErrorToast}
            </div>
          )}
          {error && (
            <div className="border border-red-700/40 bg-red-600/10 px-3 py-2 text-xs text-red-300">
              {error}
            </div>
          )}
          {bulkDeleteFailedIds.length > 0 && (
            <div className="border border-red-700/40 bg-red-600/10 px-3 py-2 text-xs text-red-300">
              Failed to delete: {bulkDeleteFailedIds.join(', ')}
            </div>
          )}
        </div>

        <div className="divide-y divide-[#1f1f2e]">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="px-6 py-5 animate-pulse bg-[#1a1a24]" />
              ))
            : paginatedLogs.map((log) => (
                <div key={log.id}>
                  <div
                    className="group relative px-6 py-4 cursor-pointer hover:bg-[#1a1a24]"
                    onClick={() =>
                      setSelectedLog(selectedLog === log.id ? null : log.id)
                    }
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-[1px] size-4 accent-indigo-500"
                        checked={selectedIds.has(log.id)}
                        onClick={(event) => event.stopPropagation()}
                        onChange={() => toggleRowSelection(log.id)}
                        aria-label={`Select log ${log.id}`}
                      />
                      {selectedLog === log.id ? (
                        <ChevronDown className="size-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="size-4 text-gray-400" />
                      )}

                      <div className="flex-1">
                        <div className="flex gap-3 text-xs text-gray-400 mb-1">
                          <span>{log.timestamp}</span>
                          <span className={getLevelColor(log.level)}>
                            {log.level}
                          </span>
                          <span>{log.source}</span>
                        </div>
                        <div className="text-white text-sm">
                          {log.message}
                        </div>
                      </div>

                      <div className="relative">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSingleDeleteTarget((prev) =>
                              prev === log.id ? null : log.id,
                            );
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300 p-1"
                          aria-label={`Delete log ${log.id}`}
                        >
                          <Trash2 className="size-4" />
                        </button>
                        {singleDeleteTarget === log.id && (
                          <div
                            className="absolute right-0 top-7 z-20 w-64 bg-[#1a1a2b] border border-[#3b3b5a] p-3 shadow-2xl ring-1 ring-white/10"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <p className="text-xs text-white">
                              Delete 1 entry?
                            </p>
                            <div className="mt-3 flex justify-end gap-2">
                              <button
                                type="button"
                                className="px-2 py-1 text-xs text-gray-100 border border-[#4a4a6b] bg-[#202036] hover:bg-[#2a2a45] hover:border-[#5a5a7d]"
                                onClick={() => setSingleDeleteTarget(null)}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                className="px-2 py-1 text-xs bg-red-500/35 text-red-50 border border-red-400/70 hover:bg-red-500/45"
                                onClick={() => void handleConfirmSingleDelete()}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {selectedLog === log.id && (
                    <div className="px-6 pb-4 pl-14">
                      <pre className="overflow-x-auto rounded border border-[#1f1f2e] bg-black p-3 text-xs leading-relaxed text-green-400">
                        {JSON.stringify(
                          buildCleanLogJson(
                            log,
                            log.details.agentId
                              ? agentNameById[String(log.details.agentId)]
                              : undefined,
                          ),
                          null,
                          2,
                        )}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
        </div>

        <div className="px-6 py-4 border-t border-[#1f1f2e] flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-sm text-gray-300">
          <div>
            Showing {filteredLogs.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}–
            {filteredLogs.length === 0 ? 0 : Math.min(currentPage * pageSize, filteredLogs.length)} of {filteredLogs.length} logs
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              className="px-3 py-2 text-sm border border-[#2a2a3a] text-gray-200 disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-gray-400">
              Page {currentPage} of {pageCount}
            </span>
            <button
              type="button"
              disabled={currentPage >= pageCount}
              onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))}
              className="px-3 py-2 text-sm border border-[#2a2a3a] text-gray-200 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {selectedCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-[#0f0f17] border-t border-[#1e1e2e] px-6 py-3">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4">
            <span className="text-sm text-gray-200">{selectedCount} selected</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="px-3 py-2 text-sm text-gray-200 border border-[#2a2a3a] hover:border-[#3a3a4f]"
                onClick={() => setSelectedIds(new Set())}
              >
                Clear selection
              </button>
              <button
                type="button"
                className="px-3 py-2 text-sm bg-red-600/15 text-red-200 border border-red-700/40 hover:bg-red-600/25"
                onClick={() => setIsBulkConfirmOpen(true)}
              >
                Delete selected
              </button>
            </div>
          </div>
        </div>
      )}

      {isBulkConfirmOpen && selectedCount > 0 && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md bg-[#11111a] border border-[#232336] p-5 shadow-xl">
            <h4 className="text-white text-sm font-medium">Confirm deletion</h4>
            <p className="mt-2 text-sm text-gray-200">
              Delete {selectedCount} entr{selectedCount === 1 ? 'y' : 'ies'}?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="px-3 py-2 text-sm text-gray-200 border border-[#2a2a3a] hover:border-[#3a3a4f]"
                onClick={() => setIsBulkConfirmOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-3 py-2 text-sm bg-red-600/15 text-red-200 border border-red-700/40 hover:bg-red-600/25"
                onClick={() => void handleBulkDelete()}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}