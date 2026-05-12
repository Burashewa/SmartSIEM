import { ENDPOINTS } from '../../constants/endpoints';
import type { Agent } from '../../types/api.types';
import { apiClient } from '../client';

export const agentsService = {
  list: () => apiClient.get<Agent[]>(ENDPOINTS.agents),
  create: (payload: Agent) => apiClient.post<{ status: string; agent_id: string }>(ENDPOINTS.agents, payload),
  delete: (id: string) => apiClient.delete<void>(`${ENDPOINTS.agents}/${id}`),
};
