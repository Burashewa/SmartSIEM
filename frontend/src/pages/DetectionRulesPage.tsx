import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { rulesService } from '../api/services/rules.service';
import { EmptyState } from '../components/shared/EmptyState';

export default function DetectionRulesPage() {
  const queryClient = useQueryClient();
  const rulesQuery = useQuery({
    queryKey: ['rules'],
    queryFn: rulesService.list,
  });
  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => rulesService.toggle(id, enabled),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['rules'] });
    },
  });

  if (rulesQuery.isLoading) {
    return <div className="text-gray-300">Loading detection rules...</div>;
  }

  if (!rulesQuery.data || rulesQuery.data.length === 0) {
    return <EmptyState title="No rules configured" description="Create rules from backend API to start detections." />;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl text-white">Detection Rules</h2>
      <div className="bg-[#0f0f17] border border-[#1f1f2e] divide-y divide-[#1f1f2e]">
        {rulesQuery.data.map((rule) => (
          <div key={rule.id} className="p-4 flex items-center justify-between">
            <div>
              <div className="text-white">{rule.name}</div>
              <div className="text-xs text-gray-400">
                {rule.type} • {rule.severity}
              </div>
            </div>
            <button
              type="button"
              onClick={() => toggleMutation.mutate({ id: rule.id, enabled: rule.status !== 'ACTIVE' })}
              className="px-3 py-1.5 bg-[#1a1a24] border border-[#2a2a3a] text-sm text-white"
            >
              {rule.status === 'ACTIVE' ? 'Disable' : 'Enable'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
