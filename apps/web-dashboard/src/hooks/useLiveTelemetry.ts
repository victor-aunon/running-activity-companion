import { useState, useEffect, useRef } from 'react';
import { WebSocketClient, type ConnectionState } from '../services/WebSocketClient';
import type {
  TelemetrySnapshotPacket,
  SessionStateChangedEvent,
  WebSocketDownlinkMessage,
} from '@running-support/shared-contracts';

export interface UseLiveTelemetryOptions {
  token: string;
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

interface TelemetrySetters {
  setTelemetry: React.Dispatch<React.SetStateAction<TelemetrySnapshotPacket | null>>;
  setPathCoordinates: React.Dispatch<React.SetStateAction<[number, number][]>>;
  setElevationHistory: React.Dispatch<React.SetStateAction<number[]>>;
  setSessionStatus: React.Dispatch<React.SetStateAction<string>>;
}

function handleDownlinkPacket(msg: WebSocketDownlinkMessage, setters: TelemetrySetters) {
  if (msg.type === 'TELEMETRY_SNAPSHOT') {
    setters.setTelemetry(msg);
    if (msg.coordinates && msg.coordinates.gpsQuality > 0) {
      setters.setPathCoordinates((prev) => [...prev, [msg.coordinates.lat, msg.coordinates.lng]]);
      setters.setElevationHistory((prev) => [...prev.slice(-300), msg.coordinates.elevationM]);
    }
  } else if (msg.type === 'SESSION_STATE_CHANGED') {
    const event = msg as SessionStateChangedEvent;
    setters.setSessionStatus(event.status);
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
  wsUrl,
  initialTelemetry = null,
  initialPathCoordinates = [],
}: UseLiveTelemetryOptions) {
  const state = useTelemetryState(initialTelemetry, initialPathCoordinates);
  const clientRef = useRef<WebSocketClient | null>(null);

  useEffect(() => {
    if (!token) return;

    const url = resolveDefaultWsUrl(wsUrl);
    const client = new WebSocketClient({ url, token, role: 'spectator' });
    clientRef.current = client;

    const unsubscribeState = client.onStateChange((s) => state.setConnectionState(s));
    const unsubscribeMsg = client.onMessage((msg) => handleDownlinkPacket(msg, state));

    client.connect();

    return () => {
      unsubscribeState();
      unsubscribeMsg();
      client.disconnect();
    };
  }, [token, wsUrl]);

  return {
    telemetry: state.telemetry,
    sessionStatus: state.sessionStatus,
    connectionState: state.connectionState,
    pathCoordinates: state.pathCoordinates,
    elevationHistory: state.elevationHistory,
    client: clientRef.current,
  };
}
