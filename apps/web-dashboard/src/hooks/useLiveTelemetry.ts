import { useEffect, useRef, useState } from 'react';
import { WebSocketClient } from '../services/WebSocketClient';
import type { ConnectionState } from '../services/WebSocketClient';
import type {
  TelemetrySnapshotPacket,
  SessionStateChangedEvent,
  PathHistoryPacket,
  WebSocketDownlinkMessage,
} from '@running-support/shared-contracts';

export interface UseLiveTelemetryOptions {
  token: string;
  pin?: string;
  wsUrl?: string;
  initialTelemetry?: TelemetrySnapshotPacket | null;
  initialPathCoordinates?: [number, number][];
}

function resolveDefaultWsUrl(wsUrl?: string): string {
  if (wsUrl) return wsUrl;
  if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL;
  if (typeof window !== 'undefined' && window.location.port === '3000') {
    return 'ws://localhost:3001/api/ws/session';
  }
  return '/api/ws/session';
}

interface TelemetryState {
  setTelemetry: (t: TelemetrySnapshotPacket) => void;
  setSessionStatus: (s: string) => void;
  setConnectionState: (c: ConnectionState) => void;
  setPathCoordinates: React.Dispatch<React.SetStateAction<[number, number][]>>;
  setElevationHistory: React.Dispatch<React.SetStateAction<number[]>>;
}

function handleDownlinkPacket(msg: WebSocketDownlinkMessage, state: TelemetryState) {
  if (msg.type === 'TELEMETRY_SNAPSHOT') {
    const snap = msg as TelemetrySnapshotPacket;
    state.setTelemetry(snap);
    if (snap.coordinates?.lat && snap.coordinates?.lng) {
      state.setPathCoordinates((prev) => [...prev, [snap.coordinates.lat, snap.coordinates.lng]]);
      state.setElevationHistory((prev) => [...prev, snap.coordinates.elevationM]);
    }
  } else if (msg.type === 'PATH_HISTORY') {
    const history = msg as PathHistoryPacket;
    if (Array.isArray(history.coordinates) && history.coordinates.length > 0) {
      state.setPathCoordinates(history.coordinates);
    }
  } else if (msg.type === 'SESSION_STATE_CHANGED') {
    const stateMsg = msg as SessionStateChangedEvent;
    state.setSessionStatus(stateMsg.status);
  }
}

function useTelemetryState(
  initialTelemetry: TelemetrySnapshotPacket | null,
  initialPath: [number, number][],
) {
  const [telemetry, setTelemetry] = useState<TelemetrySnapshotPacket | null>(initialTelemetry);
  const [sessionStatus, setSessionStatus] = useState<string>('ACTIVE');
  const [connectionState, setConnectionState] = useState<ConnectionState>('DISCONNECTED');
  const [pathCoordinates, setPathCoordinates] = useState<[number, number][]>(initialPath);
  const [elevationHistory, setElevationHistory] = useState<number[]>(
    initialTelemetry?.coordinates ? [initialTelemetry.coordinates.elevationM] : [],
  );
  return {
    telemetry,
    setTelemetry,
    sessionStatus,
    setSessionStatus,
    connectionState,
    setConnectionState,
    pathCoordinates,
    setPathCoordinates,
    elevationHistory,
    setElevationHistory,
  };
}

export function useLiveTelemetry({
  token,
  pin,
  wsUrl,
  initialTelemetry = null,
  initialPathCoordinates = [],
}: UseLiveTelemetryOptions) {
  const state = useTelemetryState(initialTelemetry, initialPathCoordinates);
  const [client, setClient] = useState<WebSocketClient | null>(null);
  const [isUnauthorized, setIsUnauthorized] = useState(false);

  useEffect(() => {
    if (!token) return;

    setIsUnauthorized(false);
    const url = resolveDefaultWsUrl(wsUrl);
    const newClient = new WebSocketClient({ url, token, role: 'spectator', pin });
    setClient(newClient);

    const unsubscribeState = newClient.onStateChange((s) => state.setConnectionState(s));
    const unsubscribeMsg = newClient.onMessage((msg) => {
      if (msg.type === 'ERROR' && (msg as any).code === 'UNAUTHORIZED_PIN') {
        setIsUnauthorized(true);
      }
      handleDownlinkPacket(msg, state);
    });

    newClient.connect();

    return () => {
      unsubscribeState();
      unsubscribeMsg();
      newClient.disconnect();
      setClient(null);
    };
  }, [token, pin, wsUrl]);

  return {
    telemetry: state.telemetry,
    sessionStatus: state.sessionStatus,
    connectionState: state.connectionState,
    pathCoordinates: state.pathCoordinates,
    elevationHistory: state.elevationHistory,
    client,
    isUnauthorized,
  };
}
