import { ENDPOINTS } from '../../constants/endpoints';
import type { WsEvent, WsEventType } from '../../types/ws.types';

type Listener<T extends WsEvent = WsEvent> = (event: T) => void;

class WSService {
  private socket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private shouldReconnect = true;
  private listeners = new Map<WsEventType, Set<Listener>>();
  private wildcardListeners = new Set<Listener>();
  private token: string | null = null;

  connect(token: string) {
    if (!token) {
      return;
    }
    this.token = token;
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      return;
    }
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8080';
    const wsBase = apiBase.replace(/^http/, 'ws');
    this.socket = new WebSocket(`${wsBase}${ENDPOINTS.ws}?token=${encodeURIComponent(token)}`);

    this.socket.onopen = () => {
      this.reconnectAttempts = 0;
    };

    this.socket.onmessage = (message) => {
      try {
        const parsed = JSON.parse(message.data) as WsEvent;
        this.listeners.get(parsed.type)?.forEach((listener) => listener(parsed));
        this.wildcardListeners.forEach((listener) => listener(parsed));
      } catch {
        // Ignore malformed events.
      }
    };

    this.socket.onclose = () => {
      this.socket = null;
      if (this.shouldReconnect && this.token) {
        this.scheduleReconnect();
      }
    };
  }

  disconnect() {
    this.shouldReconnect = false;
    this.token = null;
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.reconnectAttempts = 0;
  }

  enableReconnect() {
    this.shouldReconnect = true;
  }

  subscribe<T extends WsEvent>(type: WsEventType, listener: Listener<T>): () => void {
    const typed = listener as unknown as Listener;
    const bucket = this.listeners.get(type) ?? new Set<Listener>();
    bucket.add(typed);
    this.listeners.set(type, bucket);
    return () => {
      bucket.delete(typed);
    };
  }

  subscribeAll(listener: Listener): () => void {
    this.wildcardListeners.add(listener);
    return () => {
      this.wildcardListeners.delete(listener);
    };
  }

  private scheduleReconnect() {
    this.reconnectAttempts += 1;
    const delayMs = Math.min(30000, 1000 * 2 ** Math.max(0, this.reconnectAttempts - 1));
    window.setTimeout(() => {
      if (this.shouldReconnect && this.token) {
        this.connect(this.token);
      }
    }, delayMs);
  }
}

export const wsService = new WSService();
