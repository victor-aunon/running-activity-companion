import http from 'node:http';
import { parse } from 'node:url';
import { WebSocketServer } from 'ws';
import { createRelayServer } from '../src/services/RelayServerLogic.ts';

const PORT = parseInt(process.env.WS_PORT || process.env.PORT || '3001', 10);

const wss = new WebSocketServer({ noServer: true });
const relay = createRelayServer(wss);

const server = http.createServer((req, res) => {
  const { pathname, query } = parse(req.url || '', true);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  if (pathname === '/api/session/verify') {
    const token = (query.token as string) || '';
    const pin = (query.pin as string) || '';
    const result = relay.verifySession(token, pin);
    res.writeHead(result.valid ? 200 : 401, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify(result));
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(
    JSON.stringify({
      status: 'UP',
      service: 'WebSocket Relay Server',
      endpoint: '/api/ws/session',
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

server.listen(PORT, () => {
  console.log(
    `\n🚀 [RELAY] WebSocket Relay Server listening on: ws://localhost:${PORT}/api/ws/session`,
  );
  console.log('📡 Ready to relay telemetry from Gateway/Simulator to Spectator Dashboards.');
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
