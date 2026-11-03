import http from 'node:http';
import { parse } from 'node:url';
import { WebSocketServer } from 'ws';
import { createRelayServer } from '../src/services/RelayServerLogic.ts';
import { handleRelayHttpRequest } from '../src/services/RelayHttpRouter.ts';

const PORT = parseInt(process.env.WS_PORT || process.env.PORT || '3001', 10);
const isVerbose = process.argv.includes('--verbose') || process.argv.includes('-v');

const wss = new WebSocketServer({ noServer: true });
const relay = createRelayServer(wss, { verbose: isVerbose });

const server = http.createServer((req, res) => {
  const parsedUrl = parse(req.url || '', true);

  if (handleRelayHttpRequest(req, res, relay, parsedUrl)) {
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(
    JSON.stringify({
      status: 'UP',
      service: 'Unified Relay Server (Dev)',
      endpoint: '/api/ws/session',
      httpEndpoints: [
        '/api/gateway/*',
        '/api/session/stream',
        '/api/session/cheer',
        '/api/session/verify',
        '/api/session/path',
      ],
    }),
  );
});

server.on('upgrade', (req, socket, head) => {
  const { pathname } = parse(req.url || '');
  if (pathname === '/api/ws/session') {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  } else {
    socket.destroy();
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(
    `\n🚀 [RELAY DEV] Unified Relay Server listening on: http://localhost:${PORT} (WS: /api/ws/session)`,
  );
  console.log(
    `📡 Ready to relay HTTP Gateway, SSE stream and WebSockets (${isVerbose ? 'Modo VERBOSE: 1 Hz' : 'Modo LIMPIO | añade --verbose para ver cada segundo'})`,
  );
  console.log('👉 In another terminal, run: pnpm --filter web-dashboard simulate:runner\n');
});

function handleShutdown(signal: string) {
  console.log(`\n🛑 [RELAY] Recibida señal ${signal}. Cerrando servidor de forma segura...`);
  try {
    relay.close();
    wss.clients.forEach((client) => {
      try {
        client.terminate();
      } catch {
        // Ignorar sockets ya cerrados
      }
    });
    wss.close();
    if (typeof server.closeAllConnections === 'function') {
      server.closeAllConnections();
    }
    server.close(() => {
      process.exit(0);
    });
  } catch {
    process.exit(0);
  }

  setTimeout(() => {
    process.exit(0);
  }, 1000).unref();
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
