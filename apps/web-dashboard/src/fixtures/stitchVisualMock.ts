import type {
  TelemetrySnapshotPacket,
  NowPlayingUpdatePacket,
} from '@running-support/shared-contracts';
import type { CheerItem } from '../types/cheer';

export const MOCK_STITCH_TELEMETRY: TelemetrySnapshotPacket = {
  type: 'TELEMETRY_SNAPSHOT',
  sessionId: '550e8400-e29b-41d4-a716-446655440000',
  seq: 2895,
  timestamp: 1792577000000,
  coordinates: {
    lat: 40.4168,
    lng: -3.7038,
    elevationM: 668,
    gpsQuality: 4,
  },
  metrics: {
    heartRateBpm: 158,
    speedMps: 3.82,
    paceSecPerKm: 262,
    cadenceSpm: 178,
    stepCount: 8690,
    totalDistanceM: 10420,
    elapsedSeconds: 2895,
  },
  deviceHealth: {
    watchBatteryPct: 92,
    phoneBatteryPct: 80,
    bleRssi: -58,
  },
};

export const MOCK_STITCH_CHEERS: CheerItem[] = [
  {
    notificationId: 'notif-1',
    senderName: 'María Colomer',
    body: '¡Estás volando Víctor! Vas clavando el ritmo objetivo de 4:20. ¡Te vemos en Cibeles!',
    status: 'ENVIADO',
    timestamp: 1792576940000,
  },
  {
    notificationId: 'notif-2',
    senderName: 'Javier Ruiz (Coach)',
    body: 'Controla pulsaciones en el repecho del km 12. Hidrata bien en el siguiente avituallamiento 💧',
    status: 'ENVIADO',
    timestamp: 1792576820000,
  },
  {
    notificationId: 'notif-3',
    senderName: 'Sara P.',
    body: '¡A por esa marca personal! Toda la familia empujando desde casa 👏🏁',
    status: 'ENVIADO',
    timestamp: 1792576700000,
  },
  {
    notificationId: 'notif-4',
    senderName: 'Alberto León',
    body: '¡Ese sprint de la Castellana es tuyo! 🔥🔥🔥',
    status: 'ENVIADO',
    timestamp: 1792576520000,
  },
];

export const MOCK_STITCH_PATH: [number, number][] = [
  [40.41, -3.7038],
  [40.412, -3.7035],
  [40.414, -3.7036],
  [40.4168, -3.7038],
];

export const MOCK_STITCH_CONFIG = {
  pin: '4829',
  athleteName: 'Víctor',
  locality: 'Madrid, España',
  spectatorCount: 184,
  routeName: 'Ruta GPS en Directo • Paseo de la Castellana',
  elevationProfileText: 'Perfil de Elevación: +142m / -85m',
  eta: '10:48 AM',
};

export const MOCK_STITCH_NOW_PLAYING_ACTIVE: NowPlayingUpdatePacket = {
  type: 'NOW_PLAYING_UPDATE',
  sessionId: '550e8400-e29b-41d4-a716-446655440000',
  timestamp: 1792577000000,
  playback: {
    state: 'PLAYING',
    positionMs: 84000,
    capturedAt: 1792577000000,
    isLiveSync: true,
  },
  track: {
    trackId: '4cOdK2wGLETKBW3PvgPWqT',
    title: 'The Pretender',
    artist: 'Foo Fighters',
    album: 'Echoes, Silence, Patience & Grace',
    artworkUrl: 'https://i.scdn.co/image/ab67616d0000b273b5e434e7978280f1ef726cf9',
    durationMs: 269000,
    spotifyUrl: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
  },
};

export const MOCK_STITCH_NOW_PLAYING_IDLE: NowPlayingUpdatePacket = {
  type: 'NOW_PLAYING_UPDATE',
  sessionId: '550e8400-e29b-41d4-a716-446655440000',
  timestamp: 1792577000000,
  playback: {
    state: 'NONE',
    positionMs: 0,
    capturedAt: 1792577000000,
  },
  track: null,
};

export const MOCK_STITCH_FIXTURE = {
  telemetry: MOCK_STITCH_TELEMETRY,
  cheers: MOCK_STITCH_CHEERS,
  pathCoordinates: MOCK_STITCH_PATH,
  nowPlaying: MOCK_STITCH_NOW_PLAYING_ACTIVE,
  config: MOCK_STITCH_CONFIG,
};
