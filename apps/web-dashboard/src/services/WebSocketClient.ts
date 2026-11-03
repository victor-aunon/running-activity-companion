/**
 * Resilient Client Adapter for Next.js Web Dashboard
 * Transparently supports Server-Sent Events (SSE) + HTTP POST for spectators
 * and WebSocket for direct gateway connections and testing.
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
  pin?: string;
  heartbeatIntervalMs?: number;
  initialReconnectDelayMs?: number;
  maxReconnectDelayMs?: number;
}

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private es: EventSource | null = null;
  private options: Required<WebSocketClientOptions>;
  private clientId: string;
  private messageHandlers: Set<MessageHandler> = new Set();
  private stateHandlers: Set<StateChangeHandler> = new Set();
  private state: ConnectionState = 'DISCONNECTED';
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay: number;
  private explicitlyClosed = false;
  private lastPackets: Map<string, WebSocketDownlinkMessage> = new Map();

  private getDiagnosticContext(): { role: string; clientId: string; transport: string } {
    return {
      role: this.options.role,
      clientId: this.clientId,
      transport: this.es ? 'SSE' : 'WebSocket',
    };
  }

  constructor(options: WebSocketClientOptions) {
    this.clientId = options.clientId || `client-${Math.random().toString(36).slice(2, 10)}`;
    this.options = {
      role: 'spectator',
      clientId: this.clientId,
      pin: options.pin || '',
      heartbeatIntervalMs: 15000,
      initialReconnectDelayMs: 1000,
      maxReconnectDelayMs: 16000,
      ...options,
    };
    this.reconnectDelay = this.options.initialReconnectDelayMs;
  }

  private disposeConnection(): void {
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
    if (this.es) {
      try {
        this.es.onopen = null;
        this.es.onmessage = null;
        this.es.onerror = null;
        this.es.close();
      } catch {
        // Safe disposal of existing EventSource
      }
      this.es = null;
    }
  }

  public resolveHttpOrigin(): string {
    if (typeof window === 'undefined') return '';
    try {
      if (this.options.url) {
        const base = this.options.url.startsWith('ws')
          ? this.options.url.replace(/^ws/, 'http')
          : this.options.url;
        const parsed = new URL(base, window.location.origin);
        return parsed.origin;
      }
    } catch {
      // Fallback to window.location.origin
    }
    return window.location.origin;
  }

  private buildWsUrl(): string {
    const wsUrl = new URL(this.options.url, window.location.origin.replace(/^http/, 'ws'));
    wsUrl.searchParams.set('token', this.options.token);
    wsUrl.searchParams.set('role', this.options.role);
    wsUrl.searchParams.set('clientId', this.clientId);
    if (this.options.pin) {
      wsUrl.searchParams.set('pin', this.options.pin);
    }
    return wsUrl.toString();
  }

  public connect(): void {
    if (typeof window === 'undefined') return; // Browser only
    this.explicitlyClosed = false;
    this.setState('CONNECTING');
    this.disposeConnection();

    if (this.options.role === 'spectator' && typeof EventSource !== 'undefined') {
      this.connectSse();
    } else {
      this.connectWs();
    }
  }

  private connectSse(): void {
    try {
      const sseUrl = new URL('/api/session/stream', this.resolveHttpOrigin());
      sseUrl.searchParams.set('token', this.options.token);
      if (this.options.pin) {
        sseUrl.searchParams.set('pin', this.options.pin);
      }

      this.es = new EventSource(sseUrl.toString());

      this.es.onopen = () => {
        console.info('[WebSocketClient] SSE Stream Connected', this.getDiagnosticContext());
        this.setState('CONNECTED');
        this.reconnectDelay = this.options.initialReconnectDelayMs;
      };

      this.es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as WebSocketDownlinkMessage;
          if (data.type === 'PONG') return;
          this.lastPackets.set(data.type, data);
          this.messageHandlers.forEach((handler) => handler(data));
        } catch (error) {
          console.warn('[WebSocketClient] Ignored malformed SSE payload', {
            ...this.getDiagnosticContext(),
            error: error instanceof Error ? error.message : String(error),
          });
        }
      };

      this.es.onerror = () => {
        if (this.es?.readyState === EventSource.CLOSED) {
          this.disposeConnection();
          if (!this.explicitlyClosed) {
            this.setState('RECONNECTING');
            this.scheduleReconnect();
          }
          return;
        }
        if (!this.explicitlyClosed) {
          this.setState('RECONNECTING');
        } else {
          this.setState('DISCONNECTED');
        }
      };
    } catch (error) {
      console.error('[WebSocketClient] Could not create SSE stream', {
        ...this.getDiagnosticContext(),
        error: error instanceof Error ? error.message : String(error),
      });
      this.setState('RECONNECTING');
      this.scheduleReconnect();
    }
  }

  private connectWs(): void {
    try {
      this.ws = new WebSocket(this.buildWsUrl());

      this.ws.onopen = () => {
        console.info('[WebSocketClient] WS Connected', this.getDiagnosticContext());
        this.setState('CONNECTED');
        this.reconnectDelay = this.options.initialReconnectDelayMs;
        this.send({ type: 'PING' });
        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as WebSocketDownlinkMessage;
          if (data.type === 'PONG') return;
          this.lastPackets.set(data.type, data);
          this.messageHandlers.forEach((handler) => handler(data));
        } catch (error) {
          console.warn('[WebSocketClient] Ignored malformed message', {
            ...this.getDiagnosticContext(),
            error: error instanceof Error ? error.message : String(error),
          });
        }
      };

      this.ws.onclose = (event) => {
        this.stopHeartbeat();
        if (!this.explicitlyClosed) {
          this.setState('RECONNECTING');
          this.scheduleReconnect();
        } else {
          this.setState('DISCONNECTED');
        }
      };

      this.ws.onerror = (event) => {
        console.error('[WebSocketClient] WS Error', {
          ...this.getDiagnosticContext(),
          eventType: event.type,
          readyState: this.ws?.readyState,
        });
      };
    } catch (error) {
      console.error('[WebSocketClient] Could not create WS connection', {
        ...this.getDiagnosticContext(),
        error: error instanceof Error ? error.message : String(error),
      });
      this.setState('RECONNECTING');
      this.scheduleReconnect();
    }
  }

  public send(message: WebSocketUplinkMessage): boolean {
    if (this.es) {
      if (message.type === 'DISPATCH_CHEER') {
        const payload = {
          token: this.options.token,
          pin: this.options.pin,
          ...message,
        };
        fetch(`${this.resolveHttpOrigin()}/api/session/cheer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
          .then(async (res) => {
            if (res.ok) {
              const cheerAck: WebSocketDownlinkMessage = {
                type: 'CHEER_STATUS_UPDATE',
                notificationId: message.notificationId,
                status: 'ENVIADO',
                timestamp: Date.now(),
              } as any;
              this.messageHandlers.forEach((h) => h(cheerAck));
            } else {
              const errData = await res.json().catch(() => ({}));
              const errPacket: WebSocketDownlinkMessage = {
                type: 'ERROR',
                code:
                  errData.code ||
                  (res.status === 401
                    ? 'UNAUTHORIZED_PIN'
                    : res.status === 429
                      ? 'PIN_RATE_LIMITED'
                      : 'CHEER_REJECTED'),
                message: errData.message || 'Error al enviar mensaje de ánimo',
              } as any;
              this.messageHandlers.forEach((h) => h(errPacket));
            }
          })
          .catch(() => {
            const errPacket: WebSocketDownlinkMessage = {
              type: 'ERROR',
              code: 'NETWORK_ERROR',
              message: 'Error de red al enviar mensaje de ánimo',
            } as any;
            this.messageHandlers.forEach((h) => h(errPacket));
          });
        return true;
      }
      if (message.type === 'PING') {
        return true;
      }
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  public onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    this.lastPackets.forEach((cached) => {
      try {
        handler(cached);
      } catch {
        // Safe dispatch of cached packet
      }
    });
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
    this.disposeConnection();
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
