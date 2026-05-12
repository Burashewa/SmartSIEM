import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { settingsService } from '../api/services/settings.service';

export default function SettingsPage() {
  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: settingsService.get,
  });
  const [retention, setRetention] = useState(90);
  const updateMutation = useMutation({
    mutationFn: settingsService.update,
  });

  return (
    <div className="space-y-4">
      <h2 className="text-xl text-white">Settings</h2>
      <div className="bg-[#0f0f17] border border-[#1f1f2e] p-4 space-y-4">
        <div className="text-sm text-gray-400">
          Current retention: {settingsQuery.data?.retention_days || retention} days
        </div>
        <input
          type="number"
          value={retention}
          min={7}
          onChange={(e) => setRetention(Number(e.target.value))}
          className="bg-[#1a1a24] border border-[#2a2a3a] px-3 py-2 text-sm text-white"
        />
        <button
          type="button"
          onClick={() => updateMutation.mutate({ retention_days: retention })}
          className="px-4 py-2 bg-[#4f46e5] text-white text-sm"
        >
          Save Settings
        </button>
      </div>
    </div>
  );
}
