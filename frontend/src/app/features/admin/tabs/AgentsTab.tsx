import { useEffect, useMemo, useState } from 'react';
import { Search, Server } from 'lucide-react';
import { adminApi, isAbortError, type Agent } from '../api/adminApi';
import { cardCls, ErrorBanner, mutedText, relTime, SkeletonRow, SortHeader, type SortDir } from '../components/shared';
import { TooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';

type SortKey = 'name' | 'ownerUsername' | 'storageMode' | 'createdAt' | 'updatedAt';

const PAGE_SIZE = 25;

function sortAgents(agents: Agent[], key: SortKey | null, dir: SortDir): Agent[] {
  if (!key || !dir) return agents;
  return [...agents].sort((a, b) => {
    let cmp = 0;
    if (key === 'name') cmp = a.name.localeCompare(b.name);
    else if (key === 'ownerUsername')
      cmp = (a.ownerUsername ?? '').localeCompare(b.ownerUsername ?? '');
    else if (key === 'storageMode') cmp = a.storageMode.localeCompare(b.storageMode);
    else if (key === 'createdAt') {
      cmp = (a.createdAt ? new Date(a.createdAt).getTime() : 0) -
            (b.createdAt ? new Date(b.createdAt).getTime() : 0);
    } else if (key === 'updatedAt') {
      cmp = (a.updatedAt ? new Date(a.updatedAt).getTime() : 0) -
            (b.updatedAt ? new Date(b.updatedAt).getTime() : 0);
    }
    return dir === 'asc' ? cmp : -cmp;
  });
}

export default function AgentsTab({
  refreshKey,
  onOwnerClick,
}: {
  refreshKey: number;
  onOwnerClick: (username: string) => void;
}) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey | null>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    adminApi
      .getAgents(controller.signal)
      .then(setAgents)
      .catch((e: unknown) => {
        if (!isAbortError(e)) {
          setError(e instanceof Error ? e.message : 'Failed to load agents');
        }
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [refreshKey]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : d === 'desc' ? null : 'asc'));
      if (sortDir === null) setSortKey(null);
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(0);
  };

  const filtered = useMemo(() => {
    const term = query.toLowerCase().trim();
    if (!term) return agents;
    return agents.filter(
      (a) =>
        a.name.toLowerCase().includes(term) ||
        (a.ownerUsername ?? '').toLowerCase().includes(term) ||
        a.agentId.toLowerCase().includes(term),
    );
  }, [agents, query]);

  const sorted = useMemo(() => sortAgents(filtered, sortKey, sortDir), [filtered, sortKey, sortDir]);
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visible = sorted.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const thCls = `px-4 py-3 font-medium ${mutedText}`;

  if (error) return <ErrorBanner error={error} />;

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b7280]" />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(0); }}
          placeholder="Search by name, owner, or agent ID…"
          className="w-full rounded-md border border-[#1f1f2e] bg-[#0f0f17] py-2 pl-9 pr-3 text-sm text-white placeholder:text-[#6b7280] focus:border-[#4f46e5] focus:outline-none"
        />
      </div>

      <div className={`${cardCls} overflow-hidden`}>
        <TooltipProvider>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase">
              <tr className="border-b border-[#1f1f2e]">
                <th className={thCls}>
                  <SortHeader label="Agent Name" field="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                </th>
                <th className={thCls}>Agent ID</th>
                <th className={thCls}>
                  <SortHeader label="Owner" field="ownerUsername" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                </th>
                <th className={thCls}>
                  <SortHeader label="Storage Mode" field="storageMode" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                </th>
                <th className={thCls}>
                  <SortHeader label="Created" field="createdAt" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                </th>
                <th className={thCls}>
                  <SortHeader label="Updated" field="updatedAt" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="p-4">
                    <SkeletonRow cols={6} />
                    <SkeletonRow cols={6} />
                  </td>
                </tr>
              )}
              {!loading && visible.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <div className="flex flex-col items-center gap-2 py-12">
                      <Server className="h-8 w-8 text-[#6b7280]" />
                      <p className={mutedText}>
                        {query ? 'No agents match your search.' : 'No agents registered yet.'}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
              {!loading &&
                visible.map((agent) => (
                  <tr
                    key={agent.agentId}
                    className="border-b border-[#1f1f2e] last:border-0 hover:bg-[#1a1a24]"
                  >
                    <td className="px-4 py-3 text-white">{agent.name}</td>
                    <td className="px-4 py-3 font-mono text-[#9ca3af]">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-default">{agent.agentId.slice(0, 16)}…</span>
                        </TooltipTrigger>
                        <TooltipContent className="border-[#1f1f2e] bg-[#0f0f17] font-mono text-white">
                          {agent.agentId}
                        </TooltipContent>
                      </Tooltip>
                    </td>
                    <td className="px-4 py-3">
                      {agent.ownerUsername ? (
                        <button
                          type="button"
                          onClick={() => onOwnerClick(agent.ownerUsername!)}
                          className="font-mono text-[#a5b4fc] hover:underline"
                        >
                          {agent.ownerUsername}
                        </button>
                      ) : (
                        <span className={mutedText}>—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-white">{agent.storageMode}</td>
                    <td className={`px-4 py-3 ${mutedText}`}>{relTime(agent.createdAt)}</td>
                    <td className={`px-4 py-3 ${mutedText}`}>{relTime(agent.updatedAt)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </TooltipProvider>

        {!loading && sorted.length > 0 && (
          <div className="flex items-center justify-between border-t border-[#1f1f2e] px-4 py-2 text-xs">
            <span className={mutedText}>
              {sorted.length === 0
                ? '0 agents'
                : `${safePage * PAGE_SIZE + 1}–${Math.min((safePage + 1) * PAGE_SIZE, sorted.length)} of ${sorted.length} agents`}
            </span>
            {pageCount > 1 && (
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={safePage === 0}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded border border-[#1f1f2e] px-3 py-1 text-white hover:bg-[#1a1a24] disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={safePage >= pageCount - 1}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded border border-[#1f1f2e] px-3 py-1 text-white hover:bg-[#1a1a24] disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
