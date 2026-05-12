import { ENDPOINTS } from '../../constants/endpoints';
import { apiClient } from '../client';

export const analyticsService = {
  eventsBySource: () =>
    apiClient.get<{ items: Array<{ source_ip: string; count: number }> }>(ENDPOINTS.analytics.eventsBySource),
  alertsByRule: () =>
    apiClient.get<{ items: Array<{ rule_id: string; count: number }> }>(ENDPOINTS.analytics.alertsByRule),
};
