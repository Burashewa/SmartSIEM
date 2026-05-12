import { useQueries, useQuery } from '@tanstack/react-query';

import { dashboardService } from '../api/services/dashboard.service';

export function useDashboardKpis() {
  return useQuery({
    queryKey: ['dashboard', 'kpis'],
    queryFn: dashboardService.kpis,
    refetchInterval: 15000,
  });
}

export function useDashboardData() {
  return useQueries({
    queries: [
      { queryKey: ['dashboard', 'kpis'], queryFn: dashboardService.kpis, refetchInterval: 15000 },
      { queryKey: ['dashboard', 'logsChart'], queryFn: dashboardService.logsChart },
      { queryKey: ['dashboard', 'alertsChart'], queryFn: dashboardService.alertsChart },
      { queryKey: ['dashboard', 'geo'], queryFn: dashboardService.geo },
      { queryKey: ['dashboard', 'topSources'], queryFn: dashboardService.topSources },
    ],
  });
}
