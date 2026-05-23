import { useEffect, useMemo, useReducer, useState } from 'react';
import {
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  Trash2,
} from 'lucide-react';
import { fetchLogs, deleteLog, type BackendLogRecord } from '../api/dashboard';

interface LogEntry {
  id: string;
  timestamp: string;
  level: string;
  source: string;
  message: string;
  details: Record<string, unknown>;
}

type LogicalOp = 'AND' | 'OR';

interface FilterState {
  search: string;
  level: 'all' | string;
  sources: string[];
  users: string[];
  ips: string[];
  logicalOp: LogicalOp;
}

type FilterAction =
  | { type: 'SET_FILTER'; key: keyof FilterState; value: string | LogicalOp }
  | { type: 'TOGGLE_ARRAY_FILTER'; key: 'sources' | 'users' | 'ips'; value: string }
  | { type: 'RESET' };

const defaultFilters: FilterState = {
  search: '',
  level: 'all',
  sources: [],
  users: [],
  ips: [],
  logicalOp: 'AND',
};

function filterReducer(state: FilterState, action: FilterAction): FilterState {
  switch (action.type) {
    case 'SET_FILTER':
      return { ...state, [action.key]: action.value };

    case 'TOGGLE_ARRAY_FILTER': {
      const arr = state[action.key];
      return {
        ...state,
        [action.key]: arr.includes(action.value)
          ? arr.filter((v) => v !== action.value)
          : [...arr, action.value],
      };
    }

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
      agentId: log.agentId,
      userId: log.userId,
      event: log.event,
      action: log.action,
      status: log.status,
      user: log.user,
      ip: log.ip,
      endpoint: log.endpoint,
      resource: log.resource,
      method: log.method,
      payload: log.payload,
      metadata: log.metadata,
      raw: log.raw,
    },
  };
};

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

  const [filters, dispatch] = useReducer(filterReducer, defaultFilters, (init) => {
    if (typeof window === 'undefined') return init;

    const params = new URLSearchParams(window.location.search);

    return {
      search: params.get('search') ?? init.search,
      level: params.get('level') ?? init.level,
      sources: params.get('sources')?.split(',').filter(Boolean) ?? init.sources,
      users: params.get('users')?.split(',').filter(Boolean) ?? init.users,
      ips: params.get('ips')?.split(',').filter(Boolean) ?? init.ips,
      logicalOp: (params.get('logicalOp') as LogicalOp) ?? init.logicalOp,
    };
  });

  const [debouncedSearch, setDebouncedSearch] = useState(filters.search);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(filters.search), 350);
    return () => clearTimeout(t);
  }, [filters.search]);

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

    params.set('search', filters.search);
    params.set('level', filters.level);
    params.set('sources', filters.sources.join(','));
    params.set('users', filters.users.join(','));
    params.set('ips', filters.ips.join(','));
    params.set('logicalOp', filters.logicalOp);

    window.history.replaceState(null, '', `?${params.toString()}`);
  }, [filters]);

  useEffect(() => {
    if (!singleDeleteErrorToast) return;
    const timer = window.setTimeout(() => setSingleDeleteErrorToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [singleDeleteErrorToast]);

  const filteredLogs = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();

    const matchArray = (field: string, selected: string[]) =>
      selected.length === 0 || selected.includes(field);

    return logs.filter((log) => {
      const levelOk =
        filters.level === 'all' || log.level === filters.level.toUpperCase();

      const sourceOk = matchArray(log.source, filters.sources);

      const userOk =
        filters.users.length === 0 ||
        filters.users.includes(String(log.details.userId ?? ''));

      const ipOk =
        filters.ips.length === 0 ||
        filters.ips.includes(String(log.details.ip ?? ''));

      const searchOk =
        !q ||
        [
          log.timestamp,
          log.level,
          log.source,
          log.message,
          JSON.stringify(log.details),
        ]
          .join(' ')
          .toLowerCase()
          .includes(q);

      const checks = [levelOk, sourceOk, userOk, ipOk, searchOk];

      return filters.logicalOp === 'AND'
        ? checks.every(Boolean)
        : checks.some(Boolean);
    });
  }, [logs, filters, debouncedSearch]);

  const visibleIds = useMemo(() => filteredLogs.map((log) => log.id), [filteredLogs]);

  const selectedCount = selectedIds.size;

  const allVisibleSelected = useMemo(
    () => visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id)),
    [visibleIds, selectedIds],
  );

  const isSomeVisibleSelected = useMemo(
    () => visibleIds.some((id) => selectedIds.has(id)),
    [visibleIds, selectedIds],
  );

  const uniqueSources = useMemo(
    () => Array.from(new Set(logs.map((l) => l.source))),
    [logs],
  );

  const uniqueUsers = useMemo(
    () =>
      Array.from(
        new Set(logs.map((l) => String(l.details.userId ?? 'unknown'))),
      ),
    [logs],
  );

  const uniqueIps = useMemo(
    () => Array.from(new Set(logs.map((l) => String(l.details.ip ?? 'unknown')))),
    [logs],
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

        {/* Search */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="text-sm text-gray-400">Search (KQL-style)</label>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-500" />
              <input
                value={filters.search}
                onChange={(e) =>
                  dispatch({
                    type: 'SET_FILTER',
                    key: 'search',
                    value: e.target.value,
                  })
                }
                className="w-full bg-[#1a1a24] border border-[#2a2a3a] pl-10 pr-4 py-2 text-sm text-white"
                placeholder="event:auth AND ip:192.168..."
              />
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-400">Level</label>
            <select
              value={filters.level}
              onChange={(e) =>
                dispatch({
                  type: 'SET_FILTER',
                  key: 'level',
                  value: e.target.value,
                })
              }
              className="w-full mt-2 bg-[#1a1a24] border border-[#2a2a3a] px-3 py-2 text-sm text-white"
            >
              <option value="all">ALL</option>
              <option value="ERROR">ERROR</option>
              <option value="WARN">WARN</option>
              <option value="INFO">INFO</option>
              <option value="DEBUG">DEBUG</option>
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

        {/* Advanced SIEM filters */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="text-sm text-gray-400">Sources</label>
            <div className="mt-2 max-h-32 overflow-auto border border-[#2a2a3a]">
              {uniqueSources.map((s) => (
                <button
                  key={s}
                  onClick={() =>
                    dispatch({
                      type: 'TOGGLE_ARRAY_FILTER',
                      key: 'sources',
                      value: s,
                    })
                  }
                  className={`block w-full text-left px-3 py-1 text-sm ${
                    filters.sources.includes(s)
                      ? 'bg-[#4f46e5] text-white'
                      : 'text-gray-300'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-400">Users</label>
            <div className="mt-2 max-h-32 overflow-auto border border-[#2a2a3a]">
              {uniqueUsers.map((u) => (
                <button
                  key={u}
                  onClick={() =>
                    dispatch({
                      type: 'TOGGLE_ARRAY_FILTER',
                      key: 'users',
                      value: u,
                    })
                  }
                  className={`block w-full text-left px-3 py-1 text-sm ${
                    filters.users.includes(u)
                      ? 'bg-[#4f46e5] text-white'
                      : 'text-gray-300'
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-400">IPs</label>
            <div className="mt-2 max-h-32 overflow-auto border border-[#2a2a3a]">
              {uniqueIps.map((ip) => (
                <button
                  key={ip}
                  onClick={() =>
                    dispatch({
                      type: 'TOGGLE_ARRAY_FILTER',
                      key: 'ips',
                      value: ip,
                    })
                  }
                  className={`block w-full text-left px-3 py-1 text-sm ${
                    filters.ips.includes(ip)
                      ? 'bg-[#4f46e5] text-white'
                      : 'text-gray-300'
                  }`}
                >
                  {ip}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-400">Logic</label>
            <select
              value={filters.logicalOp}
              onChange={(e) =>
                dispatch({
                  type: 'SET_FILTER',
                  key: 'logicalOp',
                  value: e.target.value,
                })
              }
              className="w-full mt-2 bg-[#1a1a24] border border-[#2a2a3a] px-3 py-2 text-sm text-white"
            >
              <option value="AND">AND (strict)</option>
              <option value="OR">OR (flexible)</option>
            </select>
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
            : filteredLogs.map((log) => (
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
                    <div className="px-6 pb-4">
                      <pre className="text-xs text-green-400 bg-black p-3 overflow-x-auto">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
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