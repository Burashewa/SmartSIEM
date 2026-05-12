import { ENDPOINTS } from '../../constants/endpoints';
import type { DashboardKpis } from '../../types/api.types';
import { apiClient } from '../client';

export const dashboardService = {
  kpis: () => apiClient.get<DashboardKpis>(ENDPOINTS.dashboard.kpis),
  logsChart: () => apiClient.get<{ series: Array<{ time: string; count: number }> }>(ENDPOINTS.dashboard.chartLogs),
  alertsChart: () =>
    apiClient.get<{ series: Array<{ severity: string; count: number }> }>(ENDPOINTS.dashboard.chartAlerts),
  geo: () => apiClient.get<{ points: Array<{ lat: number; lon: number; ip: string }> }>(ENDPOINTS.dashboard.geo),
  topSources: () =>
    apiClient.get<{ sources: Array<{ ip: string; count: number }> }>(ENDPOINTS.dashboard.topSources),
};
