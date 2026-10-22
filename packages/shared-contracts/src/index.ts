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

export type WebSocketUplinkMessage =
  | TelemetrySnapshotPacket
  | SessionStateChangedEvent
  | CheerStatusEvent
  | GatewayRegisterMessage
  | DispatchCheerCommand
  | PingMessage;

export type WebSocketDownlinkMessage =
  | TelemetrySnapshotPacket
  | DispatchCheerCommand
  | CheerStatusEvent
  | SessionStateChangedEvent
  | GatewayRegisterAck
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
