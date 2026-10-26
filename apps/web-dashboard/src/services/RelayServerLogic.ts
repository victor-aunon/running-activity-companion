import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';

interface RoomSession {
  token: string;
  gatewayWs: WebSocket | null;
  spectators: Map<string, WebSocket>;
  sessionId?: string;
  spectatorPin?: string;
  athleteName?: string;
  lastTelemetry?: unknown;
  lastNowPlaying?: unknown;
}

interface RateLimitTracker {
  failedAttempts: number;
  lockedUntil: number;
}

interface SocketCloseContext {
  ws: WebSocket;
  room: RoomSession;
  rooms: Map<string, RoomSession>;
  token: string;
  role: string;
  clientId: string;
}

function broadcastToSpectators(room: RoomSession, payload: string) {
  room.spectators.forEach((s) => {
    if (s.readyState === WebSocket.OPEN) s.send(payload);
  });
}

function handleGatewayRegister(ws: WebSocket, room: RoomSession, msg: any) {
  room.sessionId = msg.sessionId;
  room.spectatorPin = msg.spectatorPin;
  room.athleteName = msg.athleteName;
  console.log(
    `🔑 [RELAY] Pasarela registrada → Sesión: "${msg.sessionId || room.token}" | PIN: ${msg.spectatorPin} | Atleta: "${msg.athleteName || 'Atleta'}"`,
  );
  ws.send(JSON.stringify({ type: 'GATEWAY_REGISTER_ACK', status: 'READY' }));
}

function isLockedOut(ws: WebSocket, tracker: RateLimitTracker, now: number): boolean {
  if (tracker.lockedUntil <= now) return false;
  ws.send(
    JSON.stringify({
      type: 'ERROR',
      code: 'PIN_RATE_LIMITED',
      message: 'Demasiados intentos fallidos. Inténtalo de nuevo en 60 segundos.',
    }),
  );
  return true;
}

function handleInvalidPin(ws: WebSocket, tracker: RateLimitTracker, now: number) {
  tracker.failedAttempts += 1;
  if (tracker.failedAttempts >= 5) {
    tracker.lockedUntil = now + 60000;
    tracker.failedAttempts = 0;
    ws.send(
      JSON.stringify({
        type: 'ERROR',
        code: 'PIN_RATE_LIMITED',
        message: 'Demasiados intentos fallidos. Inténtalo de nuevo en 60 segundos.',
      }),
    );
    return;
  }
  ws.send(
    JSON.stringify({
      type: 'ERROR',
      code: 'UNAUTHORIZED_PIN',
      message: 'PIN de espectador inválido',
    }),
  );
}

function handleDispatchCheer(
  ws: WebSocket,
  room: RoomSession,
  tracker: RateLimitTracker,
  msg: any,
) {
  const now = Date.now();
  if (isLockedOut(ws, tracker, now)) return;

  if (!room.spectatorPin || msg.spectatorPin !== room.spectatorPin) {
    handleInvalidPin(ws, tracker, now);
    return;
  }

  tracker.failedAttempts = 0;
  if (room.gatewayWs && room.gatewayWs.readyState === WebSocket.OPEN) {
    room.gatewayWs.send(JSON.stringify(msg));
  }

  broadcastToSpectators(
    room,
    JSON.stringify({
      type: 'CHEER_STATUS_UPDATE',
      notificationId: msg.notificationId,
      sessionId: msg.sessionId,
      status: 'ENVIADO',
      timestamp: now,
    }),
  );
}

function handleTelemetrySnapshot(room: RoomSession, msg: any) {
  room.lastTelemetry = msg;
  const metrics = msg.metrics || {};
  const hr = metrics.heartRateBpm ?? '--';
  const speed = metrics.speedMps != null ? Number(metrics.speedMps).toFixed(1) : '--';
  console.log(
    `🏃 [RELAY] Telemetría en "${room.token}" (#${msg.seq || '?'}) | Pulso: ${hr} ppm | Vel: ${speed} m/s | Espectadores: ${room.spectators.size}`,
  );
  broadcastToSpectators(room, JSON.stringify(msg));
}

function handleNowPlayingUpdate(room: RoomSession, msg: any) {
  room.lastNowPlaying = msg;
  const title = msg.track?.title || 'Sin título';
  const artist = msg.track?.artist || 'Sin artista';
  const state = msg.playback?.state || 'IDLE';
  console.log(`🎵 [RELAY] Música en "${room.token}" | ${title} - ${artist} (${state})`);
  broadcastToSpectators(room, JSON.stringify(msg));
}

function parseRawMessage(raw: unknown) {
  if (Buffer.isBuffer(raw)) return JSON.parse(raw.toString('utf-8'));
  if (typeof raw === 'string') return JSON.parse(raw);
  return JSON.parse(JSON.stringify(raw));
}

const MESSAGE_HANDLERS: Record<
  string,
  (ws: WebSocket, room: RoomSession, tracker: RateLimitTracker, msg: any) => void
> = {
  PING: (ws) => ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() })),
  GATEWAY_REGISTER: (ws, room, _tracker, msg) => handleGatewayRegister(ws, room, msg),
  DISPATCH_CHEER: (ws, room, tracker, msg) => handleDispatchCheer(ws, room, tracker, msg),
  TELEMETRY_SNAPSHOT: (_ws, room, _tracker, msg) => handleTelemetrySnapshot(room, msg),
  NOW_PLAYING_UPDATE: (_ws, room, _tracker, msg) => handleNowPlayingUpdate(room, msg),
  SESSION_STATE_CHANGED: (_ws, room, _tracker, msg) => {
    broadcastToSpectators(room, JSON.stringify(msg));
  },
  CHEER_STATUS_UPDATE: (_ws, room, _tracker, msg) => {
    broadcastToSpectators(room, JSON.stringify(msg));
  },
};

function handleSocketMessage(
  ws: WebSocket,
  room: RoomSession,
  tracker: RateLimitTracker,
  raw: unknown,
) {
  try {
    const msg = parseRawMessage(raw);
    const handler = MESSAGE_HANDLERS[msg.type];
    if (handler) {
      handler(ws, room, tracker, msg);
    }
  } catch {
    ws.send(
      JSON.stringify({ type: 'ERROR', code: 'INVALID_PAYLOAD', message: 'Malformed JSON payload' }),
    );
  }
}

function registerGatewayConnection(ws: WebSocket, room: RoomSession, token: string) {
  if (room.gatewayWs && room.gatewayWs !== ws) {
    try {
      room.gatewayWs.close(1000, 'Replaced by new gateway connection');
    } catch {
      // Ignore
    }
  }
  room.gatewayWs = ws;
  console.log(`📡 [RELAY] Pasarela Android conectada en sesión "${token}"`);
}

function registerSpectatorConnection(
  ws: WebSocket,
  room: RoomSession,
  token: string,
  clientId: string,
) {
  const existingWs = room.spectators.get(clientId);
  if (existingWs && existingWs !== ws) {
    try {
      existingWs.close(1000, 'Replaced by client reconnect');
    } catch {
      // Ignore
    }
  }
  room.spectators.set(clientId, ws);
  console.log(
    `👁️ [RELAY] Espectador conectado en sesión "${token}" (Total espectadores: ${room.spectators.size})`,
  );
  if (room.lastTelemetry) ws.send(JSON.stringify(room.lastTelemetry));
  if (room.lastNowPlaying) ws.send(JSON.stringify(room.lastNowPlaying));
}

function handleSocketClose(ctx: SocketCloseContext) {
  const { ws, room, rooms, token, role, clientId } = ctx;
  if (role === 'gateway') {
    if (room.gatewayWs === ws) room.gatewayWs = null;
    console.log(`🔌 [RELAY] Pasarela Android desconectada de sesión "${token}"`);
  } else if (room.spectators.get(clientId) === ws) {
    room.spectators.delete(clientId);
    console.log(
      `🔌 [RELAY] Espectador desconectado de sesión "${token}" (Restantes: ${room.spectators.size})`,
    );
  }
  if (!room.gatewayWs && room.spectators.size === 0) {
    rooms.delete(token);
  }
}

export function createRelayServer(wss: WebSocketServer) {
  const rooms = new Map<string, RoomSession>();
  const clientRateLimits = new WeakMap<WebSocket, RateLimitTracker>();

  function getOrCreateRoom(token: string): RoomSession {
    let room = rooms.get(token);
    if (!room) {
      room = { token, gatewayWs: null, spectators: new Map() };
      rooms.set(token, room);
    }
    return room;
  }

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url || '', 'ws://localhost');
    const token = url.searchParams.get('token') || 'default';
    const role = url.searchParams.get('role') || 'spectator';
    const clientId =
      url.searchParams.get('clientId') || `spectator-${Math.random().toString(36).slice(2, 8)}`;
    const room = getOrCreateRoom(token);

    if (role === 'gateway') {
      registerGatewayConnection(ws, room, token);
    } else {
      registerSpectatorConnection(ws, room, token, clientId);
    }

    const tracker: RateLimitTracker = { failedAttempts: 0, lockedUntil: 0 };
    clientRateLimits.set(ws, tracker);

    ws.on('message', (raw) => handleSocketMessage(ws, room, tracker, raw));
    ws.on('close', () => handleSocketClose({ ws, room, rooms, token, role, clientId }));
  });

  return { close: () => rooms.clear() };
}
