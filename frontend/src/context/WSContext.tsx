import { createContext, useContext, useEffect, useMemo } from 'react';

import { wsService } from '../api/ws/ws.service';
import type { WsEvent, WsEventType } from '../types/ws.types';
import { useAuthStore } from '../store/authStore';

interface WSContextValue {
  subscribe: <T extends WsEvent>(
    type: WsEventType,
    listener: (event: T) => void,
  ) => () => void;
  subscribeAll: (listener: (event: WsEvent) => void) => () => void;
}

const WSContext = createContext<WSContextValue | null>(null);

export function WSProvider({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((state) => state.accessToken);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      wsService.disconnect();
      return;
    }
    wsService.enableReconnect();
    wsService.connect(token);
    return () => {
      wsService.disconnect();
    };
  }, [isAuthenticated, token]);

  const value = useMemo<WSContextValue>(
    () => ({
      subscribe: wsService.subscribe.bind(wsService),
      subscribeAll: wsService.subscribeAll.bind(wsService),
    }),
    [],
  );

  return <WSContext.Provider value={value}>{children}</WSContext.Provider>;
}

export function useWSContext(): WSContextValue {
  const ctx = useContext(WSContext);
  if (!ctx) {
    throw new Error('useWSContext must be used within WSProvider');
  }
  return ctx;
}
