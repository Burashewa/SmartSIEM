import { useEffect, useRef } from 'react';
import { wsService } from '../api/ws/ws.service';
import { authStorage } from '../api/client';

export function useSmartSiemWebSocket(onEvent: (event: any) => void) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    const token = authStorage.getAccessToken();
    if (!token) {
      return;
    }
    wsService.enableReconnect();
    wsService.connect(token);
    const unsubscribe = wsService.subscribeAll((event) => onEventRef.current(event));
    return () => {
      unsubscribe();
    };
  }, [authStorage.getAccessToken()]);
}
