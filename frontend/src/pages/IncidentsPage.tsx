import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { incidentsService } from '../api/services/incidents.service';
import { EmptyState } from '../components/shared/EmptyState';

export default function IncidentsPage() {
  const queryClient = useQueryClient();
  const incidentsQuery = useQuery({
    queryKey: ['incidents'],
    queryFn: incidentsService.list,
  });
  const createMutation = useMutation({
    mutationFn: incidentsService.create,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['incidents'] });
    },
  });

  if (incidentsQuery.isLoading) {
    return <div className="text-gray-300">Loading incidents...</div>;
  }

  if (!incidentsQuery.data || incidentsQuery.data.length === 0) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() =>
            createMutation.mutate({
              title: 'Sample Incident',
              status: 'open',
              severity: 'medium',
              description: 'Created from frontend',
            })
          }
          className="bg-[#4f46e5] hover:bg-[#4338ca] text-white px-4 py-2 text-sm"
        >
          Create Incident
        </button>
        <EmptyState title="No incidents yet" description="Create one to start tracking investigations." />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl text-white">Incidents</h2>
      <div className="bg-[#0f0f17] border border-[#1f1f2e] divide-y divide-[#1f1f2e]">
        {incidentsQuery.data.map((incident) => (
          <div key={incident.id} className="p-4">
            <div className="text-white">{incident.title}</div>
            <div className="text-xs text-gray-400">
              {incident.severity} • {incident.status}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
