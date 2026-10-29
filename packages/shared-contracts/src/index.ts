/**
 * Shared Contracts & Protocol Schemas for Running Activity Support System
 * Single Source of Truth for TypeScript, WebSockets, and Multi-Tier Validation
 */

export type SessionStatus =
  | 'INITIALIZING'
  | 'ACTIVE'
  | 'PAUSED'
  | 'COMPLETED'
  | 'INTERRUPTED';

export type CheerStatus =
  | 'ENVIADO'
  | 'EN_RELOJ'
  | 'AGRADECIDO'
  | 'EXPIRADO';

export type CheerPreset =
  | 'MUCHO_ANIMO'
  | 'TU_PUEDES'
  | 'SIGUE_ASI'
  | 'CUSTOM';

export interface GpsCoordinates {
  lat: number;
  lng: number;
  elevationM: number;
  gpsQuality: number; // 0 = NOT_AVAILABLE, 1 = LAST_KNOWN, 2 = POOR, 3 = USABLE, 4 = GOOD
}

export interface RunningMetrics {
  heartRateBpm: number;
  speedMps: number;
  paceSecPerKm: number;
  cadenceSpm: number;
  stepCount?: number;
  totalDistanceM: number;
  elapsedSeconds: number;
  targetPaceSecPerKm?: number;
}

export interface DeviceHealth {
  watchBatteryPct?: number;
  phoneBatteryPct?: number;
  bleRssi?: number;
}

export interface TelemetrySnapshotPacket {
  type: 'TELEMETRY_SNAPSHOT';
  sessionId: string;
  seq: number;
  timestamp: number;
  coordinates: GpsCoordinates;
  metrics: RunningMetrics;
  deviceHealth?: DeviceHealth;
}

export interface SessionStateChangedEvent {
  type: 'SESSION_STATE_CHANGED';
  sessionId: string;
  status: SessionStatus;
  timestamp: number;
}

export interface GatewayRegisterMessage {
  type: 'GATEWAY_REGISTER';
  sessionId: string;
  spectatorPin: string;
  athleteName: string;
  startTime: number;
}

export interface GatewayRegisterAck {
  type: 'GATEWAY_REGISTER_ACK';
  status: 'READY' | 'ERROR';
  message?: string;
}

export interface DispatchCheerCommand {
  type: 'DISPATCH_CHEER';
  notificationId: string;
  sessionId: string;
  spectatorPin: string;
  senderName: string;
  presetId: CheerPreset;
  body: string;
  ttlSeconds: number;
}

export interface CheerStatusEvent {
  type: 'CHEER_STATUS_UPDATE';
  notificationId: string;
  sessionId: string;
  status: CheerStatus;
  runnerReplyText?: string;
  timestamp: number;
}

export interface ProtocolError {
  type: 'ERROR';
  code: 'UNAUTHORIZED_PIN' | 'PIN_RATE_LIMITED' | 'INVALID_PAYLOAD' | 'SESSION_NOT_FOUND';
  message: string;
}

export interface PingMessage {
  type: 'PING';
}

export interface PongMessage {
  type: 'PONG';
  timestamp: number;
}

export type PlaybackState = 'PLAYING' | 'PAUSED' | 'STOPPED' | 'NONE';

export interface RunnerTrackInfo {
  trackId: string;
  title: string;
  artist: string;
  album?: string;
  artworkUrl?: string;
  durationMs: number;
  spotifyUrl: string;
}

export interface RunnerPlaybackStatus {
  state: PlaybackState;
  positionMs: number;
  capturedAt: number;
  isLiveSync?: boolean;
}

export interface NowPlayingUpdatePacket {
  type: 'NOW_PLAYING_UPDATE';
  sessionId: string;
  timestamp: number;
  playback: RunnerPlaybackStatus;
  track: RunnerTrackInfo | null;
}

export interface PathHistoryPacket {
  type: 'PATH_HISTORY';
  sessionId: string;
  coordinates: [number, number][];
}

export type WebSocketUplinkMessage =
  | TelemetrySnapshotPacket
  | SessionStateChangedEvent
  | CheerStatusEvent
  | GatewayRegisterMessage
  | DispatchCheerCommand
  | NowPlayingUpdatePacket
  | PingMessage;

export type WebSocketDownlinkMessage =
  | TelemetrySnapshotPacket
  | PathHistoryPacket
  | DispatchCheerCommand
  | CheerStatusEvent
  | SessionStateChangedEvent
  | GatewayRegisterAck
  | NowPlayingUpdatePacket
  | ProtocolError
  | PongMessage;

// Type Guards
export function isTelemetrySnapshotPacket(msg: unknown): msg is TelemetrySnapshotPacket {
  if (typeof msg !== 'object' || msg === null) return false;
  const m = msg as Record<string, unknown>;
  return (
    m.type === 'TELEMETRY_SNAPSHOT' &&
    typeof m.sessionId === 'string' &&
    typeof m.seq === 'number' &&
    typeof m.timestamp === 'number' &&
    typeof m.coordinates === 'object' &&
    m.coordinates !== null &&
    typeof m.metrics === 'object' &&
    m.metrics !== null
  );
}

export function isDispatchCheerCommand(msg: unknown): msg is DispatchCheerCommand {
  if (typeof msg !== 'object' || msg === null) return false;
  const m = msg as Record<string, unknown>;
  return (
    m.type === 'DISPATCH_CHEER' &&
    typeof m.notificationId === 'string' &&
    typeof m.sessionId === 'string' &&
    typeof m.spectatorPin === 'string' &&
    typeof m.senderName === 'string' &&
    typeof m.body === 'string'
  );
}

export function isCheerStatusEvent(msg: unknown): msg is CheerStatusEvent {
  if (typeof msg !== 'object' || msg === null) return false;
  const m = msg as Record<string, unknown>;
  return (
    m.type === 'CHEER_STATUS_UPDATE' &&
    typeof m.notificationId === 'string' &&
    typeof m.sessionId === 'string' &&
    typeof m.status === 'string'
  );
}

export function isSessionStateChangedEvent(msg: unknown): msg is SessionStateChangedEvent {
  if (typeof msg !== 'object' || msg === null) return false;
  const m = msg as Record<string, unknown>;
  return (
    m.type === 'SESSION_STATE_CHANGED' &&
    typeof m.sessionId === 'string' &&
    typeof m.status === 'string' &&
    typeof m.timestamp === 'number'
  );
}

export function isNowPlayingUpdatePacket(msg: unknown): msg is NowPlayingUpdatePacket {
  if (typeof msg !== 'object' || msg === null) return false;
  const m = msg as Record<string, unknown>;
  if (m.type !== 'NOW_PLAYING_UPDATE' || typeof m.sessionId !== 'string' || typeof m.timestamp !== 'number') {
    return false;
  }
  if (typeof m.playback !== 'object' || m.playback === null) {
    return false;
  }
  const pb = m.playback as Record<string, unknown>;
  const validStates = ['PLAYING', 'PAUSED', 'STOPPED', 'NONE'];
  if (
    typeof pb.state !== 'string' ||
    !validStates.includes(pb.state) ||
    typeof pb.positionMs !== 'number' ||
    typeof pb.capturedAt !== 'number'
  ) {
    return false;
  }
  if (m.track !== null) {
    if (typeof m.track !== 'object' || m.track === null) {
      return false;
    }
    const tr = m.track as Record<string, unknown>;
    if (
      typeof tr.trackId !== 'string' ||
      typeof tr.title !== 'string' ||
      typeof tr.artist !== 'string' ||
      typeof tr.durationMs !== 'number' ||
      typeof tr.spotifyUrl !== 'string'
    ) {
      return false;
    }
  }
  return true;
}

