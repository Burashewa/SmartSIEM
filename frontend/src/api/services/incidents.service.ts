import { ENDPOINTS } from '../../constants/endpoints';
import type { Incident } from '../../types/api.types';
import { apiClient } from '../client';

export const incidentsService = {
  list: () => apiClient.get<Incident[]>(ENDPOINTS.incidents),
  create: (payload: Partial<Incident>) => apiClient.post<Incident>(ENDPOINTS.incidents, payload),
  update: (id: string, payload: Partial<Incident>) =>
    apiClient.patch<{ status: string }>(`${ENDPOINTS.incidents}/${id}`, payload),
  delete: (id: string) => apiClient.delete<void>(`${ENDPOINTS.incidents}/${id}`),
};
