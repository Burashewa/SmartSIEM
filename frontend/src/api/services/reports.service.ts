import { ENDPOINTS } from '../../constants/endpoints';
import type { Report } from '../../types/api.types';
import { apiClient } from '../client';

export const reportsService = {
  list: () => apiClient.get<Report[]>(ENDPOINTS.reports),
  create: (payload: { name: string; filters?: Record<string, unknown> }) =>
    apiClient.post<Report>(ENDPOINTS.reports, payload),
  delete: (id: string) => apiClient.delete<void>(`${ENDPOINTS.reports}/${id}`),
};
