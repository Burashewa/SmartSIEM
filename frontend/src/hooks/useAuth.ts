import { useEffect } from 'react';

import { useAuthStore } from '../store/authStore';

export function useAuth() {
  const store = useAuthStore();

  useEffect(() => {
    void store.bootstrap();
    // bootstrap once on initial use
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return store;
}
