import { ENDPOINTS } from '../../constants/endpoints';
import type { User } from '../../types/api.types';
import { apiClient } from '../client';

export const usersService = {
  list: () => apiClient.get<User[]>(ENDPOINTS.users),
  create: (payload: { username: string; email: string; password: string; role: string; is_active?: boolean }) =>
    apiClient.post<User>(ENDPOINTS.users, payload),
  delete: (id: string) => apiClient.delete<void>(`${ENDPOINTS.users}/${id}`),
};
