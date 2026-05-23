/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from 'react';
import { Search, Server } from 'lucide-react';
import { adminApi, type Agent } from '../api/adminApi';
import { cardCls, ErrorBanner, mutedText, relTime, SkeletonRow } from '../components/shared';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

export default function AgentsTab({ refreshKey, onOwnerClick }: { refreshKey: number; onOwnerClick: (username: string) => void }) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    setLoading(true);
    setError(null);
    adminApi
      .getAgents()
      .then(setAgents)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load agents'))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const filtered = useMemo(() => {
    const term = query.toLowerCase().trim();
    if (!term) return agents;
    return agents.filter(
      (agent) =>
        agent.name.toLowerCase().includes(term) ||
        (agent.ownerUsername ?? '').toLowerCase().includes(term) ||
        agent.agentId.toLowerCase().includes(term),
    );
  }, [agents, query]);

  if (error) return <ErrorBanner error={error} />;

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b7280]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, owner, or agent ID..."
          className="w-full rounded-md border border-[#1f1f2e] bg-[#0f0f17] py-2 pl-9 pr-3 text-sm text-white placeholder:text-[#6b7280] focus:border-[#4f46e5] focus:outline-none"
        />
      </div>

      <div className={`${cardCls} overflow-hidden`}>
        <table className="w-full text-sm">
          <thead className={`${mutedText} text-left text-xs uppercase`}>
            <tr className="border-b border-[#1f1f2e]">
              <th className="px-4 py-3 font-medium">Agent Name</th>
              <th className="px-4 py-3 font-medium">Agent ID</th>
              <th className="px-4 py-3 font-medium">Owner</th>
              <th className="px-4 py-3 font-medium">Storage Mode</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium">Updated</th>
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
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={6}>
                  <div className="flex flex-col items-center gap-2 py-12">
                    <Server className="h-8 w-8 text-[#6b7280]" />
                    <p className={mutedText}>No agents registered yet</p>
                  </div>
                </td>
              </tr>
            )}
            <TooltipProvider>
              {!loading &&
                filtered.map((agent) => (
                  <tr key={agent.agentId} className="border-b border-[#1f1f2e] last:border-0 hover:bg-[#1a1a24]">
                    <td className="px-4 py-3 text-white">{agent.name}</td>
                    <td className="px-4 py-3 font-mono text-[#9ca3af]">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-default">{agent.agentId.slice(0, 16)}...</span>
                        </TooltipTrigger>
                        <TooltipContent className="border-[#1f1f2e] bg-[#0f0f17] text-white">{agent.agentId}</TooltipContent>
                      </Tooltip>
                    </td>
                    <td className="px-4 py-3">
                      {agent.ownerUsername ? (
                        <button type="button" onClick={() => onOwnerClick(agent.ownerUsername!)} className="font-mono text-[#a5b4fc] hover:underline">
                          {agent.ownerUsername}
                        </button>
                      ) : (
                        <span className={mutedText}>-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-white">{agent.storageMode}</td>
                    <td className={`px-4 py-3 ${mutedText}`}>{relTime(agent.createdAt)}</td>
                    <td className={`px-4 py-3 ${mutedText}`}>{relTime(agent.updatedAt)}</td>
                  </tr>
                ))}
            </TooltipProvider>
          </tbody>
        </table>
      </div>
    </div>
  );
}
