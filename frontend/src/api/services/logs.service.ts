import { ENDPOINTS } from '../../constants/endpoints';
import type { ApiListResponse, LogEntry } from '../../types/api.types';
import { apiClient } from '../client';

export interface LogsQuery {
  page?: number;
  limit?: number;
  search?: string;
  severity?: string;
  source_ip?: string;
  sort?: string;
}

function toQuery(params: LogsQuery): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value));
    }
  });
  const q = searchParams.toString();
  return q ? `?${q}` : '';
}

export const logsService = {
  list: (params: LogsQuery = {}) =>
    apiClient.get<ApiListResponse<LogEntry>>(`${ENDPOINTS.logs}${toQuery(params)}`),
  ingest: (payload: unknown) => apiClient.post<{ status: string; count: number }>(ENDPOINTS.collector.ingest, payload),
};
