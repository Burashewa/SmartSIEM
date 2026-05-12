import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { rulesService } from '../api/services/rules.service';

export function useRules() {
  return useQuery({
    queryKey: ['rules'],
    queryFn: rulesService.list,
  });
}

export function useCreateRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: rulesService.create,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['rules'] });
    },
  });
}
