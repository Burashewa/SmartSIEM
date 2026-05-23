import { useEffect, useRef } from 'react';
import { getSession } from '../app/api/auth';

export function useSmartSiemWebSocket(onEvent: (event: unknown) => void) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    const token = getSession()?.accessToken;
    if (!token) {
      return;
    }
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}/api/ws?token=${encodeURIComponent(token)}`);
    socket.addEventListener('message', (event: MessageEvent<string>) => {
      try {
        onEventRef.current(JSON.parse(event.data) as unknown);
      } catch {
        onEventRef.current(event.data);
      }
    });
    return () => {
      socket.close();
    };
  }, []);
}
