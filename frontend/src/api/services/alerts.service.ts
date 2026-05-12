import { ENDPOINTS } from '../../constants/endpoints';
import type { Alert, ApiListResponse } from '../../types/api.types';
import { apiClient } from '../client';

export interface AlertsQuery {
  page?: number;
  limit?: number;
  status?: string;
  severity?: string;
  sort?: string;
}

function toQuery(params: AlertsQuery): string {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') {
      sp.set(k, String(v));
    }
  });
  const q = sp.toString();
  return q ? `?${q}` : '';
}

export const alertsService = {
  list: (params: AlertsQuery = {}) =>
    apiClient.get<ApiListResponse<Alert>>(`${ENDPOINTS.alerts}${toQuery(params)}`),
  get: (id: string) => apiClient.get<Alert>(`${ENDPOINTS.alerts}/${id}`),
  patchStatus: (id: string, status: string) =>
    apiClient.patch<{ status: string }>(`${ENDPOINTS.alerts}/${id}`, { status }),
};
