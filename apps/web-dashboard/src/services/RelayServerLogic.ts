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
  hasLoggedFirstTelemetry?: boolean;
  verbose?: boolean;
  pathHistory: [number, number][];
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

export interface RelayServerOptions {
  verbose?: boolean;
}

export interface SessionVerificationResult {
  valid: boolean;
  active: boolean;
  error?: string;
  athleteName?: string;
  token?: string;
}

function broadcastToSpectators(room: RoomSession, payload: string) {
  room.spectators.forEach((s) => {
    if (s.readyState === WebSocket.OPEN) s.send(payload);
  });
}

function handleGatewayRegister(ws: WebSocket, room: RoomSession, msg: any) {
  room.sessionId = msg.sessionId;
  room.spectatorPin = (msg.spectatorPin || '').toString().trim();
  room.athleteName = msg.athleteName;
  console.log(
    `🔑 [RELAY] Pasarela registrada → Sesión: "${msg.sessionId || room.token}" | PIN: ${room.spectatorPin} | Atleta: "${msg.athleteName || 'Atleta'}"`,
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

function forwardCheerToGateway(room: RoomSession, msg: any) {
  if (room.gatewayWs && room.gatewayWs.readyState === WebSocket.OPEN) {
    room.gatewayWs.send(JSON.stringify(msg));
    console.log(`📲 [RELAY] Ánimo reenviado a la pasarela Android para el reloj`);
  } else {
    console.warn(
      `⚠️ [RELAY] Pasarela Android no conectada en sesión "${room.token}", ánimo no entregado`,
    );
  }
}

function handleDispatchCheer(
  ws: WebSocket,
  room: RoomSession,
  tracker: RateLimitTracker,
  msg: any,
) {
  const now = Date.now();
  if (isLockedOut(ws, tracker, now)) return;

  const expectedPin = (room.spectatorPin || '').trim();
  const providedPin = (msg.spectatorPin || '').toString().trim();
  const sender = msg.senderName || 'Anónimo';
  console.log(
    `📣 [RELAY] Ánimo recibido en "${room.token}" de "${sender}": "${msg.body}" (PIN recibido: "${providedPin}")`,
  );

  if (!expectedPin || providedPin !== expectedPin) {
    console.warn(
      `❌ [RELAY] Ánimo rechazado en "${room.token}": PIN "${providedPin}" no coincide con "${expectedPin || 'NO REGISTRADO'}"`,
    );
    handleInvalidPin(ws, tracker, now);
    return;
  }

  tracker.failedAttempts = 0;
  console.log(`✅ [RELAY] PIN válido para sesión "${room.token}"`);
  forwardCheerToGateway(room, msg);

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

function appendPathHistory(room: RoomSession, coords: any) {
  if (!coords?.lat || !coords?.lng) return;
  room.pathHistory.push([coords.lat, coords.lng]);
  if (room.pathHistory.length > 5000) {
    room.pathHistory.shift();
  }
}

function logTelemetryStats(room: RoomSession, seq: any, metrics: any) {
  const hr = metrics?.heartRateBpm ?? '--';
  const speed = metrics?.speedMps != null ? Number(metrics.speedMps).toFixed(1) : '--';

  if (!room.hasLoggedFirstTelemetry) {
    room.hasLoggedFirstTelemetry = true;
    console.log(
      `🚀 [RELAY] Primer paquete de telemetría recibido en "${room.token}" (#${seq || 1}) | Pulso: ${hr} ppm | Vel: ${speed} m/s | Espectadores: ${room.spectators.size}`,
    );
  } else if (room.verbose) {
    console.log(
      `🏃 [RELAY] Telemetría en "${room.token}" (#${seq || '?'}) | Pulso: ${hr} ppm | Vel: ${speed} m/s | Espectadores: ${room.spectators.size}`,
    );
  }
}

function handleTelemetrySnapshot(room: RoomSession, msg: any) {
  room.lastTelemetry = msg;
  appendPathHistory(room, msg.coordinates);
  logTelemetryStats(room, msg.seq, msg.metrics);
  broadcastToSpectators(room, JSON.stringify(msg));
}

function handleNowPlayingUpdate(room: RoomSession, msg: any) {
  const isStopped = msg.playback?.state === 'STOPPED' || msg.playback?.state === 'NONE';
  const prevTrack = (room.lastNowPlaying as any)?.track;
  const mergedTrack = isStopped ? null : (msg.track ?? prevTrack ?? null);
  const updatedMsg = {
    ...msg,
    track: mergedTrack,
  };
  room.lastNowPlaying = updatedMsg;
  const title = updatedMsg.track?.title || 'Sin título';
  const artist = updatedMsg.track?.artist || 'Sin artista';
  const state = updatedMsg.playback?.state || 'IDLE';
  console.log(`🎵 [RELAY] Música en "${room.token}" | ${title} - ${artist} (${state})`);
  broadcastToSpectators(room, JSON.stringify(updatedMsg));
}

function parseRawMessage(raw: unknown) {
  if (Buffer.isBuffer(raw)) return JSON.parse(raw.toString('utf-8'));
  if (typeof raw === 'string') return JSON.parse(raw);
  return JSON.parse(JSON.stringify(raw));
}

function processTypedMessage(
  ws: WebSocket,
  room: RoomSession,
  tracker: RateLimitTracker,
  msg: any,
) {
  switch (msg.type) {
    case 'PING':
      ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
      break;
    case 'GATEWAY_REGISTER':
      handleGatewayRegister(ws, room, msg);
      break;
    case 'DISPATCH_CHEER':
      handleDispatchCheer(ws, room, tracker, msg);
      break;
    case 'TELEMETRY_SNAPSHOT':
      handleTelemetrySnapshot(room, msg);
      break;
    case 'NOW_PLAYING_UPDATE':
      handleNowPlayingUpdate(room, msg);
      break;
    case 'SESSION_STATE_CHANGED':
    case 'CHEER_STATUS_UPDATE':
      broadcastToSpectators(room, JSON.stringify(msg));
      break;
  }
}

function handleSocketMessage(
  ws: WebSocket,
  room: RoomSession,
  tracker: RateLimitTracker,
  raw: unknown,
) {
  try {
    const msg = parseRawMessage(raw);
    processTypedMessage(ws, room, tracker, msg);
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
  pin?: string,
) {
  const cleanPin = (pin || '').trim();
  if (room.spectatorPin && cleanPin && cleanPin !== room.spectatorPin) {
    console.warn(
      `🔒 [RELAY] Espectador rechazado en "${token}": PIN "${cleanPin}" incorrecto (esperado "${room.spectatorPin}")`,
    );
    ws.send(
      JSON.stringify({
        type: 'ERROR',
        code: 'UNAUTHORIZED_PIN',
        message: 'PIN de espectador incorrecto para esta sesión.',
      }),
    );
    ws.close(4001, 'Unauthorized PIN');
    return;
  }

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
  if (room.pathHistory.length > 0) {
    ws.send(
      JSON.stringify({
        type: 'PATH_HISTORY',
        sessionId: room.sessionId || room.token,
        coordinates: room.pathHistory,
      }),
    );
  }
  if (room.lastTelemetry) ws.send(JSON.stringify(room.lastTelemetry));
  if (room.lastNowPlaying) ws.send(JSON.stringify(room.lastNowPlaying));
}

function handleSocketClose(ctx: SocketCloseContext) {
  const { ws, room, rooms, token, role, clientId } = ctx;
  if (role === 'gateway') {
    if (room.gatewayWs === ws) room.gatewayWs = null;
    room.hasLoggedFirstTelemetry = false;
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

function verifyRoomPin(
  room: RoomSession | undefined,
  token: string,
  pin: string,
): SessionVerificationResult {
  const cleanPin = pin.trim();
  const lowerToken = token.trim().toLowerCase();
  if (lowerToken === 'live-demo' || lowerToken === 'demo' || lowerToken === 'unstarted-live-session') {
    if (cleanPin === '4829' || !cleanPin) {
      return { valid: true, active: false, athleteName: 'Víctor', token: lowerToken };
    }
  }
  if (!room) {
    return {
      valid: false,
      active: false,
      error: `No existe la sesión "${token}". Inicia el servicio en la app Android primero.`,
    };
  }
  if (!room.spectatorPin) {
    return {
      valid: false,
      active: true,
      error: `La sesión "${token}" aún no ha registrado su PIN. Espera a que la pasarela Android se registre.`,
    };
  }
  if (room.spectatorPin !== cleanPin) {
    console.warn(
      `🔒 [RELAY] Verificación de PIN rechazada en "${token}": recibido "${cleanPin}" vs esperado "${room.spectatorPin}"`,
    );
    return {
      valid: false,
      active: true,
      error: 'El PIN de 4 dígitos es incorrecto para esta sesión.',
    };
  }
  console.log(`🔑 [RELAY] Verificación de PIN correcta para sesión "${token}"`);
  return {
    valid: true,
    active: true,
    athleteName: room.athleteName || 'Atleta',
    token: room.token,
  };
}

export function createRelayServer(wss: WebSocketServer, options: RelayServerOptions = {}) {
  const rooms = new Map<string, RoomSession>();
  const clientRateLimits = new WeakMap<WebSocket, RateLimitTracker>();
  const verbose = options.verbose === true;

  function getOrCreateRoom(rawToken: string): RoomSession {
    const token = rawToken.trim().toLowerCase();
    let room = rooms.get(token);
    if (!room) {
      room = { token, gatewayWs: null, spectators: new Map(), verbose, pathHistory: [] };
      rooms.set(token, room);
    }
    return room;
  }

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url || '', 'ws://localhost');
    const token = (url.searchParams.get('token') || 'default').trim().toLowerCase();
    const role = url.searchParams.get('role') || 'spectator';
    const pin = (url.searchParams.get('pin') || '').trim();
    const clientId =
      url.searchParams.get('clientId') || `spectator-${Math.random().toString(36).slice(2, 8)}`;
    const room = getOrCreateRoom(token);

    if (role === 'gateway') {
      registerGatewayConnection(ws, room, token);
    } else {
      registerSpectatorConnection(ws, room, token, clientId, pin);
    }

    const tracker: RateLimitTracker = { failedAttempts: 0, lockedUntil: 0 };
    clientRateLimits.set(ws, tracker);

    ws.on('message', (raw) => handleSocketMessage(ws, room, tracker, raw));
    ws.on('close', () => handleSocketClose({ ws, room, rooms, token, role, clientId }));
  });

  return {
    close: () => rooms.clear(),
    verifySession: (token: string, pin: string) =>
      verifyRoomPin(rooms.get(token.trim().toLowerCase()), token, pin),
  };
}
