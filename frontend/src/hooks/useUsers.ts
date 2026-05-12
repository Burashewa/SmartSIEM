import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { usersService } from '../api/services/users.service';

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: usersService.list,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: usersService.create,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}
