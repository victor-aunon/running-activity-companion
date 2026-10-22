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

function handleSocketMessage(
  ws: WebSocket,
  room: RoomSession,
  tracker: RateLimitTracker,
  raw: unknown,
) {
  try {
    const text = Buffer.isBuffer(raw)
      ? raw.toString('utf-8')
      : typeof raw === 'string'
        ? raw
        : JSON.stringify(raw);
    const msg = JSON.parse(text);

    if (msg.type === 'PING') {
      ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
    } else if (msg.type === 'GATEWAY_REGISTER') {
      handleGatewayRegister(ws, room, msg);
    } else if (msg.type === 'TELEMETRY_SNAPSHOT') {
      room.lastTelemetry = msg;
      broadcastToSpectators(room, JSON.stringify(msg));
    } else if (msg.type === 'SESSION_STATE_CHANGED' || msg.type === 'CHEER_STATUS_UPDATE') {
      broadcastToSpectators(room, JSON.stringify(msg));
    } else if (msg.type === 'DISPATCH_CHEER') {
      handleDispatchCheer(ws, room, tracker, msg);
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
    } else {
      room.spectators.add(ws);
      if (room.lastTelemetry) ws.send(JSON.stringify(room.lastTelemetry));
    }

    const tracker: RateLimitTracker = { failedAttempts: 0, lockedUntil: 0 };
    clientRateLimits.set(ws, tracker);

    ws.on('message', (raw) => handleSocketMessage(ws, room, tracker, raw));

    ws.on('close', () => {
      if (role === 'gateway') {
        if (room.gatewayWs === ws) room.gatewayWs = null;
      } else {
        room.spectators.delete(ws);
      }
      if (!room.gatewayWs && room.spectators.size === 0) rooms.delete(token);
    });
  });

  return { close: () => rooms.clear() };
}
