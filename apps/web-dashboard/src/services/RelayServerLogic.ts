import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';

interface RoomSession {
  token: string;
  gatewayWs: WebSocket | null;
  spectators: Set<WebSocket>;
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

function handleBroadcastOrTelemetry(room: RoomSession, msg: { type: string }) {
  if (msg.type === 'TELEMETRY_SNAPSHOT') {
    room.lastTelemetry = msg;
  } else if (msg.type === 'NOW_PLAYING_UPDATE') {
    room.lastNowPlaying = msg;
  }
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
  TELEMETRY_SNAPSHOT: (_ws, room, _tracker, msg) => handleBroadcastOrTelemetry(room, msg),
  NOW_PLAYING_UPDATE: (_ws, room, _tracker, msg) => handleBroadcastOrTelemetry(room, msg),
  SESSION_STATE_CHANGED: (_ws, room, _tracker, msg) => handleBroadcastOrTelemetry(room, msg),
  CHEER_STATUS_UPDATE: (_ws, room, _tracker, msg) => handleBroadcastOrTelemetry(room, msg),
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

export function createRelayServer(wss: WebSocketServer) {
  const rooms = new Map<string, RoomSession>();
  const clientRateLimits = new WeakMap<WebSocket, RateLimitTracker>();

  function getOrCreateRoom(token: string): RoomSession {
    let room = rooms.get(token);
    if (!room) {
      room = { token, gatewayWs: null, spectators: new Set() };
      rooms.set(token, room);
    }
    return room;
  }

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url || '', 'ws://localhost');
    const token = url.searchParams.get('token') || 'default';
    const role = url.searchParams.get('role') || 'spectator';
    const room = getOrCreateRoom(token);

    if (role === 'gateway') {
      room.gatewayWs = ws;
      console.log(`📡 [RELAY] Pasarela Android conectada en sesión "${token}"`);
    } else {
      room.spectators.add(ws);
      console.log(
        `👁️ [RELAY] Espectador conectado en sesión "${token}" (Total espectadores: ${room.spectators.size})`,
      );
      if (room.lastTelemetry) ws.send(JSON.stringify(room.lastTelemetry));
      if (room.lastNowPlaying) ws.send(JSON.stringify(room.lastNowPlaying));
    }

    const tracker: RateLimitTracker = { failedAttempts: 0, lockedUntil: 0 };
    clientRateLimits.set(ws, tracker);

    ws.on('message', (raw) => handleSocketMessage(ws, room, tracker, raw));

    ws.on('close', () => {
      if (role === 'gateway') {
        if (room.gatewayWs === ws) room.gatewayWs = null;
        console.log(`🔌 [RELAY] Pasarela Android desconectada de sesión "${token}"`);
      } else {
        room.spectators.delete(ws);
        console.log(
          `🔌 [RELAY] Espectador desconectado de sesión "${token}" (Restantes: ${room.spectators.size})`,
        );
      }
      if (!room.gatewayWs && room.spectators.size === 0) rooms.delete(token);
    });
  });

  return { close: () => rooms.clear() };
}
