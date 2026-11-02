import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';

interface RoomSession {
  token: string;
  gatewayWs: WebSocket | null;
  spectators: Map<string, WebSocket>;
  sseSpectators: Set<(payload: string) => void>;
  pendingGatewayCheers: any[];
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
    relayWarn(
      `⚠️ [RELAY] Excepción en socket send: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

function broadcastToSpectators(room: RoomSession, payload: string) {
  room.spectators.forEach((s) => {
    safeSend(s, payload);
  });
  if (room.sseSpectators) {
    room.sseSpectators.forEach((cb) => {
      try {
        cb(payload);
      } catch {
        // Safe dispatch to SSE subscriber
      }
    });
  }
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
    relayLog(`📲 [RELAY] Ánimo reenviado a la pasarela Android (WS) para el reloj`);
  }
  if (!room.pendingGatewayCheers) {
    room.pendingGatewayCheers = [];
  }
  room.pendingGatewayCheers.push(msg);
  if (room.pendingGatewayCheers.length > 50) {
    room.pendingGatewayCheers.shift();
  }
  relayLog(`📲 [RELAY] Ánimo encolado para pasarela Android`);
}

function dispatchCheerCommand(
  room: RoomSession,
  msg: any,
  tracker?: RateLimitTracker,
): { success: boolean; status: number; message?: string; notificationId?: string; code?: string } {
  const now = Date.now();
  if (tracker && tracker.lockedUntil > now) {
    const remainingSec = Math.ceil((tracker.lockedUntil - now) / 1000);
    return {
      success: false,
      status: 429,
      code: 'PIN_RATE_LIMITED',
      message: `Demasiados intentos fallidos. Bloqueado durante ${remainingSec}s más.`,
    };
  }

  const expectedPin = (room.spectatorPin || '').trim();
  const providedPin = (msg.spectatorPin || msg.pin || '').toString().trim();
  const sender = (msg.senderName || '').trim() || 'Anónimo';

  relayLog(
    `📣 [RELAY] Ánimo recibido en "${room.token}" de "${sender}": "${msg.body}" (PIN recibido: "${providedPin}")`,
  );

  if (!expectedPin || providedPin !== expectedPin) {
    relayWarn(
      `❌ [RELAY] Ánimo rechazado en "${room.token}": PIN "${providedPin}" no coincide con "${expectedPin || 'NO REGISTRADO'}"`,
    );
    if (tracker) {
      tracker.failedAttempts += 1;
      if (tracker.failedAttempts >= 5) {
        tracker.lockedUntil = now + 60000;
        relayWarn(
          `🔒 [RELAY] Cliente bloqueado por 60s tras 5 intentos fallidos en sesión "${room.token}"`,
        );
        return {
          success: false,
          status: 429,
          code: 'PIN_RATE_LIMITED',
          message: 'Demasiados intentos fallidos de PIN. Bloqueado durante 60 segundos.',
        };
      }
    }
    return {
      success: false,
      status: 401,
      code: 'UNAUTHORIZED_PIN',
      message: 'PIN de espectador incorrecto para esta sesión.',
    };
  }

  if (tracker) {
    tracker.failedAttempts = 0;
    tracker.lockedUntil = 0;
  }

  const notificationId = msg.notificationId || crypto.randomUUID();
  const forwardMsg = {
    ...msg,
    notificationId,
    sessionId: msg.sessionId || room.sessionId || room.token,
    senderName: sender,
  };

  forwardCheerToGateway(room, forwardMsg);

  const cheerData = {
    notificationId,
    sessionId: msg.sessionId || room.sessionId || room.token,
    senderName: sender,
    body: (msg.body || '¡Ánimo!').substring(0, 50),
    status: 'ENVIADO',
    timestamp: now,
  };
  room.cheersHistory.set(notificationId, cheerData);

  broadcastToSpectators(
    room,
    JSON.stringify({
      type: 'CHEER_STATUS_UPDATE',
      ...cheerData,
    }),
  );

  return { success: true, status: 200, notificationId };
}

function handleDispatchCheer(
  ws: WebSocket,
  room: RoomSession,
  tracker: RateLimitTracker,
  msg: any,
) {
  const result = dispatchCheerCommand(room, msg, tracker);
  if (!result.success) {
    if (result.code === 'PIN_RATE_LIMITED') {
      safeSend(
        ws,
        JSON.stringify({
          type: 'ERROR',
          code: 'PIN_RATE_LIMITED',
          message:
            result.message || 'Demasiados intentos fallidos de PIN. Bloqueado temporalmente.',
        }),
      );
    } else {
      safeSend(
        ws,
        JSON.stringify({
          type: 'ERROR',
          code: 'UNAUTHORIZED_PIN',
          message: 'PIN de espectador incorrecto para esta sesión.',
        }),
      );
    }
    return;
  }

  relayLog(`✅ [RELAY] PIN válido para sesión "${room.token}"`);
}

function appendPathHistory(room: RoomSession, coords: any) {
  if (!coords?.lat || !coords?.lng) return;
  const last = room.pathHistory[room.pathHistory.length - 1];
  if (last && last[0] === coords.lat && last[1] === coords.lng) {
    return;
  }
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
  const currentSeq = (room.lastTelemetry as any)?.seq;
  if (currentSeq == null || msg.seq == null || msg.seq >= currentSeq) {
    room.lastTelemetry = msg;
  }
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

  sendSpectatorBacklog(ws, room);
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
  const httpRateLimits = new Map<string, RateLimitTracker>();
  isSilent = options.silent ?? process.env.NODE_ENV === 'test';
  const verbose = options.verbose === true;

  function getOrCreateRoom(rawToken: string): RoomSession {
    const token = rawToken.trim().toLowerCase();
    let room = rooms.get(token);
    if (!room) {
      room = {
        token,
        gatewayWs: null,
        spectators: new Map(),
        sseSpectators: new Set(),
        pendingGatewayCheers: [],
        verbose,
        pathHistory: [],
        cheersHistory: new Map(),
      };
      rooms.set(token, room);
    } else {
      if (!room.sseSpectators) room.sseSpectators = new Set();
      if (!room.pendingGatewayCheers) room.pendingGatewayCheers = [];
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
        hasGateway: !!room.gatewayWs || room.lastTelemetry !== undefined,
        gatewayReadyState: room.gatewayWs ? room.gatewayWs.readyState : room.lastTelemetry ? 1 : 0,
        spectatorsCount: room.spectators.size + (room.sseSpectators?.size || 0),
        pathHistoryLength: room.pathHistory?.length || 0,
        hasLastTelemetry: !!room.lastTelemetry,
        lastTelemetrySeq: room.lastTelemetry ? (room.lastTelemetry as any).seq : null,
        hasLastNowPlaying: !!room.lastNowPlaying,
        hasLastSessionState: !!room.lastSessionState,
        cheersCount: room.cheersHistory?.size || 0,
      };
    },
    getPathHistory: (token: string) => {
      const room = rooms.get(token.trim().toLowerCase());
      return room ? room.pathHistory : [];
    },
    subscribeSseSpectator: (token: string, onPayload: (payload: string) => void) => {
      const room = getOrCreateRoom(token);
      room.sseSpectators.add(onPayload);
      return () => {
        room.sseSpectators.delete(onPayload);
      };
    },
    getSpectatorBacklogMessages: (token: string) => {
      const room = rooms.get(token.trim().toLowerCase());
      if (!room) return [];
      const messages: string[] = [];
      if (room.lastTelemetry) messages.push(JSON.stringify(room.lastTelemetry));
      if (room.lastNowPlaying) messages.push(JSON.stringify(room.lastNowPlaying));
      if (room.lastSessionState) messages.push(JSON.stringify(room.lastSessionState));
      if (room.cheersHistory && room.cheersHistory.size > 0) {
        for (const cheer of room.cheersHistory.values()) {
          messages.push(JSON.stringify({ type: 'CHEER_STATUS_UPDATE', ...cheer }));
        }
      }
      return messages;
    },
    dispatchCheerHttp: (data: any, clientIdentifier?: string) => {
      const token = (data.token || data.sessionId || '').toString().trim().toLowerCase();
      const room = rooms.get(token);
      if (!room) {
        return { success: false, status: 404, message: `La sesión "${token}" no está activa.` };
      }
      const key = `${token}:${clientIdentifier || data.clientId || 'anonymous'}`;
      let tracker = httpRateLimits.get(key);
      if (!tracker) {
        tracker = { failedAttempts: 0, lockedUntil: 0 };
        httpRateLimits.set(key, tracker);
      }
      return dispatchCheerCommand(room, data, tracker);
    },
    registerGatewayHttp: (data: any) => {
      const token = (data.token || data.sessionId || '').toString().trim().toLowerCase();
      const room = getOrCreateRoom(token);
      room.sessionId = data.sessionId || token;
      room.spectatorPin = (data.spectatorPin || data.pin || '').toString().trim();
      room.athleteName = data.athleteName || 'Víctor';
      if (data.targetPaceSecPerKm && Number(data.targetPaceSecPerKm) > 0) {
        room.targetPaceSecPerKm = Number(data.targetPaceSecPerKm);
      }
      if (data.totalRaceDistanceM && Number(data.totalRaceDistanceM) > 0) {
        room.raceDistanceM = Number(data.totalRaceDistanceM);
      }
      const paceLog = room.targetPaceSecPerKm ? ` | Ritmo Obj: ${room.targetPaceSecPerKm}s/km` : '';
      const distLog = room.raceDistanceM ? ` | Distancia: ${room.raceDistanceM}m` : '';
      relayLog(
        `🔑 [RELAY] Pasarela registrada (HTTP) → Sesión: "${room.sessionId}" | PIN: ${room.spectatorPin} | Atleta: "${room.athleteName}"${paceLog}${distLog}`,
      );
      return { status: 'READY', sessionId: room.sessionId };
    },
    ingestTelemetryHttp: (data: any) => {
      const token = (data.token || data.sessionId || '').toString().trim().toLowerCase();
      const room = getOrCreateRoom(token);
      data.type = data.type || 'TELEMETRY_SNAPSHOT';
      handleTelemetrySnapshot(room, data);
      const pendingCheers = room.pendingGatewayCheers ? room.pendingGatewayCheers.splice(0) : [];
      return { status: 'OK', pendingCheers };
    },
    ingestNowPlayingHttp: (data: any) => {
      const token = (data.token || data.sessionId || '').toString().trim().toLowerCase();
      const room = getOrCreateRoom(token);
      data.type = data.type || 'NOW_PLAYING_UPDATE';
      handleNowPlayingUpdate(room, data);
      return { status: 'OK' };
    },
    completeSessionHttp: (data: any) => {
      const token = (data.token || data.sessionId || '').toString().trim().toLowerCase();
      const room = getOrCreateRoom(token);
      const msg = { type: 'SESSION_STATE_CHANGED', status: data.status || 'COMPLETED' };
      room.lastSessionState = msg;
      relayLog(`🏁 [RELAY] Estado de sesión cambiado en "${room.token}" (HTTP): ${msg.status}`);
      broadcastToSpectators(room, JSON.stringify(msg));
      return { status: 'OK' };
    },
    ackCheerHttp: (data: any) => {
      const token = (data.token || data.sessionId || '').toString().trim().toLowerCase();
      const room = getOrCreateRoom(token);
      const cached = room.cheersHistory?.get(data.notificationId);
      const enriched = {
        ...data,
        senderName: data.senderName || cached?.senderName || 'Espectador',
        body: data.body || cached?.body || '¡Ánimo!',
      };
      if (cached) {
        cached.status = data.status || cached.status;
        if (data.runnerReplyText) cached.runnerReplyText = data.runnerReplyText;
      }
      relayLog(
        `📬 [RELAY] Estado de ánimo actualizado en "${room.token}" (HTTP): ${data.notificationId} → ${data.status}`,
      );
      broadcastToSpectators(room, JSON.stringify(enriched));
      return { status: 'OK' };
    },
    getAllRooms: () => {
      const result: Record<string, any> = {};
      for (const [k, r] of rooms.entries()) {
        result[k] = {
          hasGateway: !!r.gatewayWs || r.lastTelemetry !== undefined,
          gatewayReadyState: r.gatewayWs ? r.gatewayWs.readyState : r.lastTelemetry ? 1 : 0,
          spectators: r.spectators.size + (r.sseSpectators?.size || 0),
          pathLength: r.pathHistory?.length || 0,
        };
      }
      return result;
    },
  };
}
