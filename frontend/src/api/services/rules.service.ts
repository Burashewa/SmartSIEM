import { ENDPOINTS } from '../../constants/endpoints';
import type { DetectionRule } from '../../types/api.types';
import { apiClient } from '../client';

export const rulesService = {
  list: () => apiClient.get<DetectionRule[]>(ENDPOINTS.rules),
  create: (payload: Omit<DetectionRule, 'id'>) => apiClient.post<DetectionRule>(ENDPOINTS.rules, payload),
  update: (id: string, payload: Omit<DetectionRule, 'id'>) =>
    apiClient.put<{ status: string }>(`${ENDPOINTS.rules}/${id}`, payload),
  toggle: (id: string, enabled: boolean) =>
    apiClient.patch<{ status: string }>(`${ENDPOINTS.rules}/${id}/toggle`, { enabled }),
  delete: (id: string) => apiClient.delete<void>(`${ENDPOINTS.rules}/${id}`),
};
