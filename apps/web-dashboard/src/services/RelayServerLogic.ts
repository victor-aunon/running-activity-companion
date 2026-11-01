import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';

interface RoomSession {
  token: string;
  gatewayWs: WebSocket | null;
  spectators: Map<string, WebSocket>;
  sessionId?: string;
  spectatorPin?: string;
  athleteName?: string;
  targetPaceSecPerKm?: number;
  raceDistanceM?: number;
  lastTelemetry?: unknown;
  lastNowPlaying?: unknown;
  lastSessionState?: unknown;
  hasLoggedFirstTelemetry?: boolean;
  verbose?: boolean;
  pathHistory: [number, number][];
  cheersHistory: Map<string, any>;
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
  code?: number;
  reason?: string;
}

export interface RelayServerOptions {
  verbose?: boolean;
  silent?: boolean;
}

let isSilent = false;

function relayLog(...args: unknown[]) {
  if (!isSilent) console.log(...args);
}

function relayWarn(...args: unknown[]) {
  if (!isSilent) console.warn(...args);
}

export interface SessionVerificationResult {
  valid: boolean;
  active: boolean;
  error?: string;
  athleteName?: string;
  token?: string;
}

function safeSend(ws: WebSocket | null | undefined, payload: string) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  try {
    ws.send(payload, (err) => {
      if (err) {
        relayWarn(`⚠️ [RELAY] Error en socket send: ${err.message}`);
      }
    });
  } catch (err) {
    relayWarn(`⚠️ [RELAY] Excepción en socket send: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function broadcastToSpectators(room: RoomSession, payload: string) {
  room.spectators.forEach((s) => {
    safeSend(s, payload);
  });
}

function handleGatewayRegister(ws: WebSocket, room: RoomSession, msg: any) {
  room.sessionId = msg.sessionId;
  room.spectatorPin = (msg.spectatorPin || '').toString().trim();
  room.athleteName = msg.athleteName;
  if (msg.targetPaceSecPerKm && Number(msg.targetPaceSecPerKm) > 0) {
    room.targetPaceSecPerKm = Number(msg.targetPaceSecPerKm);
  }
  if (msg.totalRaceDistanceM && Number(msg.totalRaceDistanceM) > 0) {
    room.raceDistanceM = Number(msg.totalRaceDistanceM);
  }
  const paceLog = room.targetPaceSecPerKm ? ` | Ritmo Obj: ${room.targetPaceSecPerKm}s/km` : '';
  const distLog = room.raceDistanceM ? ` | Distancia: ${room.raceDistanceM}m` : '';
  relayLog(
    `🔑 [RELAY] Pasarela registrada → Sesión: "${msg.sessionId || room.token}" | PIN: ${room.spectatorPin} | Atleta: "${msg.athleteName || 'Atleta'}"${paceLog}${distLog}`,
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
    safeSend(room.gatewayWs, JSON.stringify(msg));
    relayLog(`📲 [RELAY] Ánimo reenviado a la pasarela Android para el reloj`);
  } else {
    relayWarn(
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
  relayLog(
    `📣 [RELAY] Ánimo recibido en "${room.token}" de "${sender}": "${msg.body}" (PIN recibido: "${providedPin}")`,
  );

  if (!expectedPin || providedPin !== expectedPin) {
    relayWarn(
      `❌ [RELAY] Ánimo rechazado en "${room.token}": PIN "${providedPin}" no coincide con "${expectedPin || 'NO REGISTRADO'}"`,
    );
    handleInvalidPin(ws, tracker, now);
    return;
  }

  tracker.failedAttempts = 0;
  relayLog(`✅ [RELAY] PIN válido para sesión "${room.token}"`);
  forwardCheerToGateway(room, msg);

  const cheerData = {
    notificationId: msg.notificationId,
    sessionId: msg.sessionId,
    senderName: msg.senderName || 'Espectador',
    body: msg.body || '¡Ánimo!',
    status: 'ENVIADO',
    timestamp: now,
  };
  room.cheersHistory.set(msg.notificationId, cheerData);

  broadcastToSpectators(
    room,
    JSON.stringify({
      type: 'CHEER_STATUS_UPDATE',
      ...cheerData,
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
    relayLog(
      `🚀 [RELAY] Primer paquete de telemetría recibido en "${room.token}" (#${seq || 1}) | Pulso: ${hr} ppm | Vel: ${speed} m/s | Espectadores: ${room.spectators.size}`,
    );
  } else if (room.verbose) {
    relayLog(
      `🏃 [RELAY] Telemetría en "${room.token}" (#${seq || '?'}) | Pulso: ${hr} ppm | Vel: ${speed} m/s | Espectadores: ${room.spectators.size}`,
    );
  }
}

function handleTelemetrySnapshot(room: RoomSession, msg: any) {
  if (msg.metrics) {
    if (!msg.metrics.targetPaceSecPerKm && room.targetPaceSecPerKm) {
      msg.metrics.targetPaceSecPerKm = room.targetPaceSecPerKm;
    }
    if (!msg.metrics.totalRaceDistanceM && room.raceDistanceM) {
      msg.metrics.totalRaceDistanceM = room.raceDistanceM;
    }
  }
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
  relayLog(`🎵 [RELAY] Música en "${room.token}" | ${title} - ${artist} (${state})`);
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
      safeSend(ws, JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
      sendSpectatorBacklog(ws, room);
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
      room.lastSessionState = msg;
      relayLog(`🏁 [RELAY] Estado de sesión cambiado en "${room.token}": ${msg.status}`);
      broadcastToSpectators(room, JSON.stringify(msg));
      break;
    case 'CHEER_STATUS_UPDATE': {
      const cached = room.cheersHistory?.get(msg.notificationId);
      const enriched = {
        ...msg,
        senderName: msg.senderName || cached?.senderName || 'Espectador',
        body: msg.body || cached?.body || '¡Ánimo!',
      };
      if (cached) {
        cached.status = msg.status || cached.status;
        if (msg.runnerReplyText) cached.runnerReplyText = msg.runnerReplyText;
      }
      broadcastToSpectators(room, JSON.stringify(enriched));
      break;
    }
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
  relayLog(`📡 [RELAY] Pasarela Android conectada en sesión "${token}"`);
}

const initializedSpectators = new WeakSet<WebSocket>();

function sendSpectatorBacklog(ws: WebSocket, room: RoomSession) {
  if (initializedSpectators.has(ws)) return;
  initializedSpectators.add(ws);

  try {
    if (ws.readyState !== WebSocket.OPEN) return;

    if (room.pathHistory.length > 0) {
      safeSend(
        ws,
        JSON.stringify({
          type: 'PATH_HISTORY',
          sessionId: room.sessionId || room.token,
          coordinates: room.pathHistory,
        }),
      );
    }
    if (room.lastTelemetry && ws.readyState === WebSocket.OPEN) {
      safeSend(ws, JSON.stringify(room.lastTelemetry));
    }
    if (room.lastNowPlaying && ws.readyState === WebSocket.OPEN) {
      safeSend(ws, JSON.stringify(room.lastNowPlaying));
    }
    if (room.lastSessionState && ws.readyState === WebSocket.OPEN) {
      safeSend(ws, JSON.stringify(room.lastSessionState));
    }
    if (room.cheersHistory && room.cheersHistory.size > 0 && ws.readyState === WebSocket.OPEN) {
      for (const cheer of room.cheersHistory.values()) {
        safeSend(ws, JSON.stringify({ type: 'CHEER_STATUS_UPDATE', ...cheer }));
      }
    }
  } catch (err) {
    relayWarn(
      `⚠️ [RELAY] Error en replay de estado inicial para "${room.token}": ${err instanceof Error ? err.message : String(err)}`,
    );
  }
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
    relayWarn(
      `🔒 [RELAY] Espectador rechazado en "${token}": PIN "${cleanPin}" incorrecto (esperado "${room.spectatorPin}")`,
    );
    safeSend(
      ws,
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
  relayLog(
    `👁️ [RELAY] Espectador conectado en sesión "${token}" (Total espectadores: ${room.spectators.size})`,
  );

  setTimeout(() => {
    if (ws.readyState === WebSocket.OPEN) {
      sendSpectatorBacklog(ws, room);
    }
  }, 50);
}

function handleSocketClose(ctx: SocketCloseContext) {
  const { ws, room, token, role, clientId, code, reason } = ctx;
  const detail = code != null ? ` [Código: ${code}${reason ? ` | Motivo: "${reason}"` : ''}]` : '';
  if (role === 'gateway') {
    if (room.gatewayWs === ws) room.gatewayWs = null;
    room.hasLoggedFirstTelemetry = false;
    relayLog(`🔌 [RELAY] Pasarela Android desconectada de sesión "${token}"${detail}`);
  } else if (room.spectators.get(clientId) === ws) {
    room.spectators.delete(clientId);
    relayLog(
      `🔌 [RELAY] Espectador desconectado de sesión "${token}" (Restantes: ${room.spectators.size})${detail}`,
    );
  }
}

function verifyRoomPin(
  room: RoomSession | undefined,
  token: string,
  pin: string,
): SessionVerificationResult {
  const cleanPin = pin.trim();

  // If a live room exists with an explicit registered PIN, validate strictly against that live PIN
  if (room && room.spectatorPin) {
    if (room.spectatorPin !== cleanPin) {
      relayWarn(
        `🔒 [RELAY] Verificación de PIN rechazada en "${token}": recibido "${cleanPin}" vs esperado "${room.spectatorPin}"`,
      );
      return {
        valid: false,
        active: true,
        error: 'El PIN de 4 dígitos es incorrecto para esta sesión.',
      };
    }
    relayLog(`🔑 [RELAY] Verificación de PIN correcta para sesión "${token}"`);
    return {
      valid: true,
      active: true,
      athleteName: room.athleteName || 'Atleta',
      token: room.token,
    };
  }

  // If the room has not registered a PIN yet or does not exist yet:
  return {
    valid: false,
    active: false,
    error: `La sesión "${token}" no existe o aún no ha registrado el PIN desde la app Android.`,
  };
}

export function createRelayServer(wss: WebSocketServer, options: RelayServerOptions = {}) {
  const rooms = new Map<string, RoomSession>();
  const clientRateLimits = new WeakMap<WebSocket, RateLimitTracker>();
  isSilent = options.silent ?? (process.env.NODE_ENV === 'test');
  const verbose = options.verbose === true;

  function getOrCreateRoom(rawToken: string): RoomSession {
    const token = rawToken.trim().toLowerCase();
    let room = rooms.get(token);
    if (!room) {
      room = {
        token,
        gatewayWs: null,
        spectators: new Map(),
        verbose,
        pathHistory: [],
        cheersHistory: new Map(),
      };
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
    ws.on('error', (err) => {
      relayWarn(`⚠️ [RELAY] Error en socket "${token}" (${role}): ${err.message}`);
    });
    ws.on('close', (code, reason) => {
      const reasonStr = reason ? reason.toString('utf-8') : '';
      handleSocketClose({ ws, room, rooms, token, role, clientId, code, reason: reasonStr });
    });
  });

  return {
    close: () => rooms.clear(),
    verifySession: (token: string, pin: string) =>
      verifyRoomPin(rooms.get(token.trim().toLowerCase()), token, pin),
    getRoomDetails: (token: string) => {
      const room = rooms.get(token.trim().toLowerCase());
      if (!room) return null;
      return {
        token: room.token,
        sessionId: room.sessionId,
        spectatorPin: room.spectatorPin,
        hasGateway: !!room.gatewayWs,
        gatewayReadyState: room.gatewayWs?.readyState,
        spectatorsCount: room.spectators.size,
        pathHistoryLength: room.pathHistory?.length || 0,
        hasLastTelemetry: !!room.lastTelemetry,
        lastTelemetrySeq: room.lastTelemetry ? (room.lastTelemetry as any).seq : null,
        hasLastNowPlaying: !!room.lastNowPlaying,
        hasLastSessionState: !!room.lastSessionState,
        cheersCount: room.cheersHistory?.size || 0,
      };
    },
    getAllRooms: () => {
      const result: Record<string, any> = {};
      for (const [k, r] of rooms.entries()) {
        result[k] = {
          hasGateway: !!r.gatewayWs,
          gatewayReadyState: r.gatewayWs?.readyState,
          spectators: r.spectators.size,
          pathLength: r.pathHistory?.length || 0,
        };
      }
      return result;
    },
  };
}
