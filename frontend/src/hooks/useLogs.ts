import { useQuery } from '@tanstack/react-query';

import { logsService, type LogsQuery } from '../api/services/logs.service';

export function useLogs(params: LogsQuery) {
  const { page, limit } = params;
  return useQuery({
    queryKey: ['logs', page, limit, params],
    queryFn: () => logsService.list(params),
    staleTime: 5000,
  });
}
