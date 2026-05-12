import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Filter, Download, ChevronDown, ChevronRight } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useQueryClient } from '@tanstack/react-query';

import { useLogs } from '../../hooks/useLogs';
import { useWS } from '../../hooks/useWS';
import { usePagination } from '../../hooks/usePagination';
import { PaginationBar } from '../../components/shared/PaginationBar';

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  source: string;
  message: string;
  details: Record<string, unknown>;
}

export function LogManagementPage() {
  const [selectedLog, setSelectedLog] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const queryClient = useQueryClient();
  const ws = useWS();
  const { page, limit, setPage } = usePagination(1, 50);
  const logsQuery = useLogs({
    page,
    limit,
    search: debouncedSearch || undefined,
    severity: levelFilter === 'all' ? undefined : levelFilter,
  });

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(searchQuery), 500);
    return () => window.clearTimeout(timeout);
  }, [searchQuery]);

  useEffect(() => {
    const unsubscribe = ws.subscribe('log.new', () => {
      void queryClient.invalidateQueries({ queryKey: ['logs'] });
    });
    return () => unsubscribe();
  }, [queryClient, ws]);

  const logs = useMemo<LogEntry[]>(
    () =>
      (logsQuery.data?.data || []).map((log) => {
        const level = String(log.event?.severity || 'INFO').toUpperCase();
        return {
          id: String(log.id),
          timestamp: String(log.timestamp || ''),
          level: (['INFO', 'WARN', 'ERROR', 'DEBUG'].includes(level) ? level : 'INFO') as LogEntry['level'],
          source: String(log.source?.host?.name || log.source?.ip || 'collector'),
          message: String(log.message || ''),
          details: log as unknown as Record<string, unknown>,
        };
      }),
    [logsQuery.data?.data],
  );

  const parentRef = useRef<HTMLDivElement | null>(null);
  const virtualizer = useVirtualizer({
    count: logs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 74,
    overscan: 10,
  });

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'ERROR': return 'text-[#ef4444]';
      case 'WARN': return 'text-[#f59e0b]';
      case 'INFO': return 'text-[#3b82f6]';
      case 'DEBUG': return 'text-[#6b7280]';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="space-y-6">
      {/* Search and Filter Section */}
      <div className="bg-[#0f0f17] border border-[#1f1f2e] p-6">
        <h2 className="text-xl font-medium text-white mb-4">Log Management</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="md:col-span-2">
            <label className="block text-sm text-gray-400 mb-2">Search Query</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="source:firewall AND level:ERROR"
                className="w-full bg-[#1a1a24] border border-[#2a2a3a] pl-10 pr-4 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-[#4f46e5]"
              />
            </div>
          </div>

          {/* Level Filter */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Level</label>
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="w-full bg-[#1a1a24] border border-[#2a2a3a] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#4f46e5]"
            >
              <option value="all">All Levels</option>
              <option value="ERROR">ERROR</option>
              <option value="WARN">WARN</option>
              <option value="INFO">INFO</option>
              <option value="DEBUG">DEBUG</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex items-end gap-2">
            <button className="flex-1 bg-[#4f46e5] hover:bg-[#4338ca] text-white px-4 py-2 text-sm flex items-center justify-center gap-2">
              <Filter className="size-4" />
              Filter
            </button>
            <button className="px-4 py-2 bg-[#1a1a24] hover:bg-[#2a2a3a] border border-[#2a2a3a] text-white text-sm">
              <Download className="size-4" />
            </button>
          </div>
        </div>

        {/* Advanced Filters */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Time Range</label>
            <select className="w-full bg-[#1a1a24] border border-[#2a2a3a] px-3 py-2 text-sm text-white">
              <option>Last 1 hour</option>
              <option>Last 24 hours</option>
              <option>Last 7 days</option>
              <option>Custom range</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Source</label>
            <select className="w-full bg-[#1a1a24] border border-[#2a2a3a] px-3 py-2 text-sm text-white">
              <option>All Sources</option>
              <option>Firewall</option>
              <option>IDS/IPS</option>
              <option>Web Server</option>
              <option>Database</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Sort By</label>
            <select className="w-full bg-[#1a1a24] border border-[#2a2a3a] px-3 py-2 text-sm text-white">
              <option>Newest First</option>
              <option>Oldest First</option>
              <option>Severity</option>
            </select>
          </div>
        </div>
      </div>

      {/* Log Results */}
      <div className="bg-[#0f0f17] border border-[#1f1f2e]">
        <div className="border-b border-[#1f1f2e] px-6 py-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-white">
              Log Entries ({logs.length.toLocaleString()} results)
            </h3>
            <div className="text-sm text-gray-400">
              Showing {(page - 1) * limit + 1}-{Math.min(page * limit, logsQuery.data?.total || logs.length)} of{' '}
              {(logsQuery.data?.total || logs.length).toLocaleString()}
            </div>
          </div>
        </div>

        <div ref={parentRef} className="h-[520px] overflow-auto">
          <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const log = logs[virtualRow.index];
              return (
                <div
                  key={virtualRow.key}
                  className="hover:bg-[#1a1a24] transition-colors border-b border-[#1f1f2e]"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <div
                    className="px-6 py-4 cursor-pointer"
                    onClick={() => setSelectedLog(selectedLog === log.id ? null : log.id)}
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 pt-1">
                        {selectedLog === log.id ? (
                          <ChevronDown className="size-4 text-gray-400" />
                        ) : (
                          <ChevronRight className="size-4 text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-4 mb-2">
                          <span className="font-mono text-xs text-gray-500 whitespace-nowrap">
                            {log.timestamp}
                          </span>
                          <span className={`font-mono text-xs font-medium ${getLevelColor(log.level)} whitespace-nowrap`}>
                            {log.level}
                          </span>
                          <span className="font-mono text-xs text-[#8b5cf6] whitespace-nowrap">{log.source}</span>
                        </div>
                        <div className="text-sm text-white">{log.message}</div>
                      </div>
                    </div>
                  </div>
                  {selectedLog === log.id && (
                    <div className="px-6 pb-4">
                      <div className="ml-8 bg-[#000000] border border-[#2a2a3a] p-4 overflow-x-auto">
                        <pre className="text-xs font-mono text-[#10b981]">{JSON.stringify(log.details, null, 2)}</pre>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Pagination */}
        <div className="border-t border-[#1f1f2e] px-6 py-4">
          <PaginationBar
            page={page}
            limit={limit}
            total={logsQuery.data?.total || logs.length}
            onPageChange={setPage}
          />
        </div>
      </div>
    </div>
  );
}
