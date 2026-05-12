import { ENDPOINTS } from '../../constants/endpoints';
import { apiClient } from '../client';

export interface AppSettings {
  retention_days: number;
  alerting_enabled: boolean;
  integrations: Record<string, unknown>;
}

export const settingsService = {
  get: () => apiClient.get<AppSettings>(ENDPOINTS.settings),
  update: (payload: Partial<AppSettings>) =>
    apiClient.put<{ status: string }>(ENDPOINTS.settings, payload),
};
