import { WebSocket } from 'ws';
import type { NowPlayingUpdatePacket, PlaybackState } from '@running-support/shared-contracts';

const args = process.argv.slice(2);
function getArg(name: string, fallback: string): string {
  const arg = args.find((a) => a.startsWith(`--${name}=`));
  if (arg) return arg.split('=')[1];
  const idx = args.indexOf(`--${name}`);
  if (idx !== -1 && args[idx + 1]) return args[idx + 1];
  return fallback;
}

const WS_PORT = parseInt(getArg('port', process.env.WS_PORT || process.env.PORT || '3001'), 10);
const TOKEN = getArg('token', process.env.TOKEN || 'carrera-victor');
const STATE = getArg('state', 'PLAYING').toUpperCase() as PlaybackState;
const TRACK_TITLE = getArg('title', 'The Pretender');
const ARTIST = getArg('artist', 'Foo Fighters');
const TRACK_ID = getArg('trackId', '4cOdK2wGLETKBW3PvgPWqT');

const WS_URL = `ws://localhost:${WS_PORT}/api/ws/session?token=${encodeURIComponent(TOKEN)}&role=gateway`;

console.log(`\n🎵 [NOW PLAYING SIMULATOR] Conectando a ${WS_URL}`);
console.log(`Estado: ${STATE} | Pista: ${TRACK_TITLE} - ${ARTIST}`);

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
  const isIdle = STATE === 'NONE' || STATE === 'STOPPED';
  const packet: NowPlayingUpdatePacket = {
    type: 'NOW_PLAYING_UPDATE',
    sessionId: TOKEN,
    timestamp: Date.now(),
    playback: {
      state: STATE,
      positionMs: isIdle ? 0 : 45000,
      capturedAt: Date.now(),
      isLiveSync: true,
    },
    track: isIdle
      ? null
      : {
          trackId: TRACK_ID,
          title: TRACK_TITLE,
          artist: ARTIST,
          album: 'Echoes, Silence, Patience & Grace',
          artworkUrl: 'https://i.scdn.co/image/ab67616d0000b273b5e434e7978280f1ef726cf9',
          durationMs: 269000,
          spotifyUrl: `https://open.spotify.com/track/${TRACK_ID}`,
        },
  };

  ws.send(JSON.stringify(packet));
  console.log(`✓ Paquete NOW_PLAYING_UPDATE emitido exitosamente.`);
  setTimeout(() => {
    ws.close();
    process.exit(0);
  }, 500);
});

ws.on('error', (err) => {
  console.error(`❌ Error en WebSocket: ${err.message}`);
  process.exit(1);
});
