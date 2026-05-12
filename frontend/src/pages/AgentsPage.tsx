import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { agentsService } from '../api/services/agents.service';
import { EmptyState } from '../components/shared/EmptyState';

export default function AgentsPage() {
  const queryClient = useQueryClient();
  const agentsQuery = useQuery({
    queryKey: ['agents'],
    queryFn: agentsService.list,
  });
  const registerMutation = useMutation({
    mutationFn: agentsService.create,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
  });

  if (agentsQuery.isLoading) {
    return <div className="text-gray-300">Loading agents...</div>;
  }

  if (!agentsQuery.data || agentsQuery.data.length === 0) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() =>
            registerMutation.mutate({
              agent_id: 'frontend-agent-001',
              hostname: 'kali-dev',
              ip: '192.168.1.50',
              status: 'online',
            })
          }
          className="bg-[#4f46e5] hover:bg-[#4338ca] text-white px-4 py-2 text-sm"
        >
          Register Agent
        </button>
        <EmptyState title="No agents registered" description="Register an agent to start ingesting logs." />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl text-white">Agents</h2>
      <div className="bg-[#0f0f17] border border-[#1f1f2e] divide-y divide-[#1f1f2e]">
        {agentsQuery.data.map((agent) => (
          <div key={agent.id || agent.agent_id} className="p-4">
            <div className="text-white">{agent.agent_id}</div>
            <div className="text-xs text-gray-400">
              {agent.hostname || 'unknown-host'} • {agent.status}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
