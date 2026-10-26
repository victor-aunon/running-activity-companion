import http from 'node:http';
import { parse } from 'node:url';
import next from 'next';
import { WebSocketServer } from 'ws';
import { createRelayServer } from './src/services/RelayServerLogic.ts';

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port, dir: import.meta.dirname });
const handle = app.getRequestHandler();

await app.prepare();

const server = http.createServer((req, res) => {
  const parsedUrl = parse(req.url || '', true);
  void handle(req, res, parsedUrl);
});

const wss = new WebSocketServer({ noServer: true });
const relay = createRelayServer(wss);

server.on('upgrade', (req, socket, head) => {
  const { pathname } = parse(req.url || '');
  if (pathname === '/api/ws/session') {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  }
});

server.listen(port, hostname, () => {
  console.log(`\n🚀 [UNIFIED SERVER] Servidor unificado en producción activo`);
  console.log(`🌐 Web Dashboard: http://${hostname}:${port}`);
  console.log(`📡 WebSocket Relay: ws://${hostname}:${port}/api/ws/session\n`);
});

function handleShutdown(signal) {
  console.log(
    `\n🛑 [UNIFIED SERVER] Recibida señal ${signal}. Cerrando servidor de forma segura...`,
  );
  try {
    relay.close();
    wss.clients.forEach((client) => {
      try {
        client.terminate();
      } catch {
        // Ignorar
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

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
