import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { reportsService } from '../api/services/reports.service';
import { EmptyState } from '../components/shared/EmptyState';

export default function ReportsPage() {
  const [name, setName] = useState('');
  const queryClient = useQueryClient();
  const reportsQuery = useQuery({
    queryKey: ['reports'],
    queryFn: reportsService.list,
  });
  const createMutation = useMutation({
    mutationFn: reportsService.create,
    onSuccess: () => {
      setName('');
      void queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });

  return (
    <div className="space-y-4">
      <h2 className="text-xl text-white">Reports</h2>
      <div className="bg-[#0f0f17] border border-[#1f1f2e] p-4 flex gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Report name"
          className="bg-[#1a1a24] border border-[#2a2a3a] px-3 py-2 text-sm text-white"
        />
        <button
          type="button"
          onClick={() => createMutation.mutate({ name, filters: {} })}
          className="px-4 py-2 bg-[#4f46e5] text-white text-sm"
        >
          Create Report
        </button>
      </div>
      {!reportsQuery.data || reportsQuery.data.length === 0 ? (
        <EmptyState title="No reports yet" description="Generate report definitions from this page." />
      ) : (
        <div className="bg-[#0f0f17] border border-[#1f1f2e] divide-y divide-[#1f1f2e]">
          {reportsQuery.data.map((report) => (
            <div key={report.id} className="p-4">
              <div className="text-white">{report.name}</div>
              <div className="text-xs text-gray-400">{new Date(report.created_at).toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
