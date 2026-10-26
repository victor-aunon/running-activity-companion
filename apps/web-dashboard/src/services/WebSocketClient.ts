/**
 * Resilient WebSocket Client Adapter for Next.js Web Dashboard
 * Handles heartbeat pings (15s), exponential backoff reconnection, and typed message dispatch
 */

import type {
  WebSocketDownlinkMessage,
  WebSocketUplinkMessage,
} from '@running-support/shared-contracts';

export type MessageHandler = (message: WebSocketDownlinkMessage) => void;
export type ConnectionState = 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING';
export type StateChangeHandler = (state: ConnectionState) => void;

export interface WebSocketClientOptions {
  url: string;
  token: string;
  role?: 'spectator' | 'gateway';
  clientId?: string;
  heartbeatIntervalMs?: number;
  initialReconnectDelayMs?: number;
  maxReconnectDelayMs?: number;
}

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private options: Required<WebSocketClientOptions>;
  private clientId: string;
  private messageHandlers: Set<MessageHandler> = new Set();
  private stateHandlers: Set<StateChangeHandler> = new Set();
  private state: ConnectionState = 'DISCONNECTED';
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay: number;
  private explicitlyClosed = false;

  constructor(options: WebSocketClientOptions) {
    this.clientId = options.clientId || `client-${Math.random().toString(36).slice(2, 10)}`;
    this.options = {
      role: 'spectator',
      clientId: this.clientId,
      heartbeatIntervalMs: 15000,
      initialReconnectDelayMs: 1000,
      maxReconnectDelayMs: 16000,
      ...options,
    };
    this.reconnectDelay = this.options.initialReconnectDelayMs;
  }

  public connect(): void {
    if (typeof window === 'undefined') return; // Browser only
    this.explicitlyClosed = false;
    this.setState('CONNECTING');

    if (this.ws) {
      try {
        this.ws.onclose = null;
        this.ws.onerror = null;
        this.ws.close();
      } catch {
        // Safe disposal of existing socket
      }
      this.ws = null;
    }

    const wsUrl = new URL(this.options.url, window.location.origin.replace(/^http/, 'ws'));
    wsUrl.searchParams.set('token', this.options.token);
    wsUrl.searchParams.set('role', this.options.role);
    wsUrl.searchParams.set('clientId', this.clientId);

    try {
      this.ws = new WebSocket(wsUrl.toString());

      this.ws.onopen = () => {
        this.setState('CONNECTED');
        this.reconnectDelay = this.options.initialReconnectDelayMs;
        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as WebSocketDownlinkMessage;
          if (data.type === 'PONG') return;
          this.messageHandlers.forEach((handler) => handler(data));
        } catch {
          // Ignore malformed frames gracefully
        }
      };

      this.ws.onclose = () => {
        this.stopHeartbeat();
        if (!this.explicitlyClosed) {
          this.setState('RECONNECTING');
          this.scheduleReconnect();
        } else {
          this.setState('DISCONNECTED');
        }
      };

      this.ws.onerror = () => {
        this.ws?.close();
      };
    } catch {
      this.setState('RECONNECTING');
      this.scheduleReconnect();
    }
  }

  public send(message: WebSocketUplinkMessage): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  public onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  public onStateChange(handler: StateChangeHandler): () => void {
    this.stateHandlers.add(handler);
    handler(this.state);
    return () => this.stateHandlers.delete(handler);
  }

  public disconnect(): void {
    this.explicitlyClosed = true;
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setState('DISCONNECTED');
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.send({ type: 'PING' });
    }, this.options.heartbeatIntervalMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.options.maxReconnectDelayMs);
      this.connect();
    }, this.reconnectDelay);
  }

  private setState(newState: ConnectionState): void {
    this.state = newState;
    this.stateHandlers.forEach((handler) => handler(newState));
  }
}
