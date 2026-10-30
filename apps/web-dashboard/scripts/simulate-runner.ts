import { WebSocket } from 'ws';

const args = process.argv.slice(2);
function getArg(name: string, fallback: string): string {
  const arg = args.find((a) => a.startsWith(`--${name}=`));
  if (arg) return arg.split('=')[1];
  const idx = args.indexOf(`--${name}`);
  if (idx !== -1 && args[idx + 1]) return args[idx + 1];
  return fallback;
}

const WS_PORT = parseInt(getArg('port', process.env.WS_PORT || process.env.PORT || '3001'), 10);
const TOKEN = getArg('token', process.env.TOKEN || 'live-session');
const PIN = getArg('pin', process.env.PIN || '4829');
const ATHLETE_NAME = getArg('athlete', process.env.NEXT_PUBLIC_ATHLETE_NAME || 'Víctor');
const TOTAL_RACE_DISTANCE_M = parseInt(getArg('raceDistance', '10000'), 10);

const WS_URL = `ws://localhost:${WS_PORT}/api/ws/session?token=${encodeURIComponent(TOKEN)}&role=gateway`;

console.log(`\n🏃 [SIMULATOR] Iniciando simulador de corredor virtual`);
console.log(`📡 Conectando a: ${WS_URL}`);
console.log(
  `🔑 Sesión: "${TOKEN}" | PIN: "${PIN}" | Atleta: "${ATHLETE_NAME}" | Distancia Carrera: ${TOTAL_RACE_DISTANCE_M}m\n`,
);

const ws = new WebSocket(WS_URL);

// Base coordinates: Casa de Campo / Paseo de la Castellana, Madrid
const BASE_LAT = 40.4168;
const BASE_LNG = -3.7038;
const BASE_ELEVATION = 650.0;

let seq = 0;
let elapsedSeconds = 0;
let distanceM = 0;
let distanceOffsetM = 0;
let heartRateOverride: number | null = null;
let cadenceOverride: number | null = null;
let telemetryInterval: NodeJS.Timeout | null = null;
const sessionId = '550e8400-e29b-41d4-a716-446655440000';

function buildTelemetryPacket(curSeq: number, elapsed: number, distance: number) {
  const speedMps = 3.65 + Math.sin(curSeq / 10) * 0.2;
  const paceSecPerKm = 1000 / speedMps;
  const baseHeartRate = Math.round(155 + Math.sin(curSeq / 8) * 12);
  const heartRate = heartRateOverride ?? baseHeartRate;
  const baseCadence = Math.round(176 + Math.sin(curSeq / 5) * 4);
  const cadence = cadenceOverride ?? baseCadence;
  const effectiveDistance = distance + distanceOffsetM;
  const angle = curSeq * 0.02;
  const lat = BASE_LAT + Math.sin(angle) * 0.005;
  const lng = BASE_LNG + Math.cos(angle) * 0.005;

  return {
    speedMps,
    paceSecPerKm,
    heartRate,
    packet: {
      type: 'TELEMETRY_SNAPSHOT' as const,
      sessionId,
      seq: curSeq,
      timestamp: Date.now(),
      coordinates: { lat, lng, elevationM: BASE_ELEVATION + Math.sin(angle) * 15, gpsQuality: 4 },
      metrics: {
        heartRateBpm: heartRate,
        speedMps: Number(speedMps.toFixed(2)),
        paceSecPerKm: Number(paceSecPerKm.toFixed(1)),
        cadenceSpm: cadence,
        stepCount: curSeq * 3,
        totalDistanceM: Number(effectiveDistance.toFixed(1)),
        totalRaceDistanceM: TOTAL_RACE_DISTANCE_M,
        elapsedSeconds: elapsed,
      },
      deviceHealth: {
        watchBatteryPct: Math.max(10, 92 - Math.floor(curSeq / 100)),
        phoneBatteryPct: 80,
        bleRssi: -58,
      },
    },
  };
}

function startTelemetryInterval(client: WebSocket) {
  telemetryInterval = setInterval(() => {
    seq++;
    elapsedSeconds++;
    const { speedMps, paceSecPerKm, heartRate, packet } = buildTelemetryPacket(
      seq,
      elapsedSeconds,
      distanceM,
    );
    distanceM += speedMps;
    client.send(JSON.stringify(packet));
    if (seq % 5 === 0) {
      const min = Math.floor(paceSecPerKm / 60);
      const sec = Math.floor(paceSecPerKm % 60)
        .toString()
        .padStart(2, '0');
      console.log(
        `[1Hz STREAM] Seq: ${seq} | HR: ${heartRate} bpm | Ritmo: ${min}:${sec} min/km | Dist: ${(distanceM / 1000).toFixed(2)} km`,
      );
    }
  }, 1000);
}

function finishActivity(client: WebSocket) {
  if (telemetryInterval) {
    clearInterval(telemetryInterval);
    telemetryInterval = null;
  }
  const finishPacket = {
    type: 'SESSION_STATE_CHANGED',
    sessionId,
    status: 'COMPLETED',
    timestamp: Date.now(),
  };
  client.send(JSON.stringify(finishPacket));
  console.log('\n🏁 [ACTIVIDAD FINALIZADA] Estado de sesión cambiado a COMPLETED.');
  console.log('📊 El dashboard web mostrará automáticamente el modal de resumen de carrera.');
  console.log('👉 Pulsa Ctrl+C para salir del simulador.\n');
}

ws.on('open', () => {
  console.log('✓ ¡Conectado al servidor Relay como Pasarela!');
  console.log(`✓ Registrando sesión con PIN de espectador: ${PIN}`);
  ws.send(
    JSON.stringify({
      type: 'GATEWAY_REGISTER',
      sessionId,
      spectatorPin: PIN,
      athleteName: ATHLETE_NAME,
      totalRaceDistanceM: TOTAL_RACE_DISTANCE_M,
      startTime: Date.now(),
    }),
  );
  console.log('✓ Sesión registrada exitosamente.');
  console.log('🚀 Emitiendo telemetría en vivo a 1 Hz (Pulsa Ctrl+C para detener)...');
  console.log('⌨️  Controles interactivos en tiempo real:');
  console.log('   [k] Sumar +1 km a la distancia recorrida');
  console.log('   [h] Alternar override de pulso alto (190 bpm)');
  console.log('   [c] Alternar override de cadencia alta (210 spm)');
  console.log('   [r] Enviar agradecimiento del corredor al último ánimo recibido');
  console.log('   [f] Finalizar actividad (COMPLETED)\n');
  startTelemetryInterval(ws);
});

let lastReceivedNotificationId: string | null = null;

function sendGratitudeReply(notifId: string, client: WebSocket) {
  const replyPacket = {
    type: 'CHEER_STATUS_UPDATE',
    notificationId: notifId,
    sessionId,
    status: 'AGRADECIDO',
    runnerReplyText: `${ATHLETE_NAME} te lo agradece`,
    timestamp: Date.now(),
  };
  client.send(JSON.stringify(replyPacket));
  console.log(
    `❤️ [AGRADECIMIENTO ENVIADO] Respuesta del corredor: "${ATHLETE_NAME} te lo agradece" (ID: ${notifId})`,
  );
}

if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');

  process.stdin.on('data', (key) => {
    if (key.toString() === '\u0003') {
      process.exit();
    }
    const char = key.toString().toLowerCase();
    if (char === 'k') {
      distanceOffsetM += 1000;
      console.log(
        `⚡️ [ACCELERATION] +1 km añadido. Distancia simulada: ${((distanceM + distanceOffsetM) / 1000).toFixed(2)} km`,
      );
    }
    if (char === 'h') {
      if (heartRateOverride === 190) {
        heartRateOverride = null;
        console.log(`❤️ [PULSO] Override desactivado (volviendo a pulso natural ~155-167 bpm).`);
      } else {
        heartRateOverride = 190;
        console.log(`🔥 [PULSO] Override activado a 190 bpm (provocará alerta EXERTION en web).`);
      }
    }
    if (char === 'c') {
      if (cadenceOverride === 210) {
        cadenceOverride = null;
        console.log(
          `👟 [CADENCIA] Override desactivado (volviendo a cadencia natural ~176-180 spm).`,
        );
      } else {
        cadenceOverride = 210;
        console.log(
          `⚡️ [CADENCIA] Override activado a 210 spm (con pulso alto provocará alerta SPRINT).`,
        );
      }
    }
    if (char === 'r') {
      if (lastReceivedNotificationId) {
        sendGratitudeReply(lastReceivedNotificationId, ws);
        lastReceivedNotificationId = null;
      } else {
        console.log('No hay ánimos pendientes de respuesta.');
      }
    }
    if (char === 'f') {
      finishActivity(ws);
    }
  });
}

ws.on('message', (data) => {
  try {
    const text = Buffer.isBuffer(data)
      ? data.toString('utf-8')
      : new TextDecoder().decode(data as ArrayBuffer);
    const msg = JSON.parse(text);
    if (msg.type === 'DISPATCH_CHEER') {
      lastReceivedNotificationId = msg.notificationId;
      console.log(
        `\n🎉 [ÁNIMO RECIBIDO] ${msg.senderName}: "${msg.body}" (ID: ${msg.notificationId})`,
      );
      console.log('👉 Pulsa [r] en este terminal para enviar el agradecimiento del corredor.');
    }
  } catch (err) {
    console.error('Error procesando mensaje:', err);
  }
});

ws.on('error', (err) => {
  console.error(`\n❌ [SIMULATOR] Error de conexión: ${err.message}`);
  console.error('───────────────────────────────────────────────────────────────────────');
  console.error('💡 Causa probable:');
  console.error(`   El servidor WebSocket Relay no está escuchando en el puerto ${WS_PORT}.`);
  console.error('   Next.js ("next dev" en puerto 3000) no procesa WebSockets nativamente.');
  console.error('');
  console.error('👉 Solución:');
  console.error('   1. Inicia el servidor WebSocket Relay en otra terminal:');
  console.error('      pnpm --filter web-dashboard relay');
  console.error('   2. Luego vuelve a ejecutar este simulador:');
  console.error(`      pnpm --filter web-dashboard simulate:runner -- --port=${WS_PORT}`);
  console.error('───────────────────────────────────────────────────────────────────────\n');
});

ws.on('close', () => {
  console.log('Conexión cerrada. Saliendo.');
  process.exit(0);
});
