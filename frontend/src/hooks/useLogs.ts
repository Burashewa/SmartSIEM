import { useQuery } from '@tanstack/react-query';

import { logsService, type LogsQuery } from '../api/services/logs.service';

export function useLogs(params: LogsQuery) {
  return useQuery({
    queryKey: ['logs', params],
    queryFn: () => logsService.list(params),
    staleTime: 5000,
  });
}
