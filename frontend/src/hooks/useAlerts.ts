import { useQuery } from '@tanstack/react-query';

import { alertsService, type AlertsQuery } from '../api/services/alerts.service';

export function useAlerts(params: AlertsQuery) {
  return useQuery({
    queryKey: ['alerts', params],
    queryFn: () => alertsService.list(params),
    staleTime: 5000,
  });
}
