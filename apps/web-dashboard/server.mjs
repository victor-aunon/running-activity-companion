import http from 'node:http';
import { parse } from 'node:url';
import next from 'next';
import { WebSocketServer } from 'ws';
import { createRelayServer } from './src/services/RelayServerLogic.ts';

const recentLogs = [];
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

function captureLog(type, ...args) {
  const line = `[${new Date().toISOString()}] [${type}] ${args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')}`;
  recentLogs.push(line);
  if (recentLogs.length > 200) recentLogs.shift();
}

console.log = (...args) => {
  captureLog('INFO', ...args);
  originalLog(...args);
};
console.warn = (...args) => {
  captureLog('WARN', ...args);
  originalWarn(...args);
};
console.error = (...args) => {
  captureLog('ERROR', ...args);
  originalError(...args);
};

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port, dir: import.meta.dirname });
const handle = app.getRequestHandler();

await app.prepare();

const server = http.createServer((req, res) => {
  const parsedUrl = parse(req.url || '', true);
  if (parsedUrl.pathname === '/api/debug/logs') {
    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(recentLogs.join('\n'));
    return;
  }
  if (parsedUrl.pathname === '/api/debug/rooms') {
    const token = parsedUrl.query.token;
    const data = token ? relay.getRoomDetails(token) : relay.getAllRooms();
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify(data, null, 2));
    return;
  }
  if (parsedUrl.pathname === '/api/session/verify') {
    const token = parsedUrl.query.token || '';
    const pin = parsedUrl.query.pin || '';
    const result = relay.verifySession(token, pin);
    res.writeHead(result.valid ? 200 : 401, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify(result));
    return;
  }
  void handle(req, res, parsedUrl);
});

// Configure keep-alive timeouts strictly higher than reverse proxy to eliminate EOFException race conditions
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

const isVerbose = process.argv.includes('--verbose') || process.argv.includes('-v');
// Disable perMessageDeflate to prevent proxy compression desync (Context Takeover) that causes 1006 disconnects in browsers behind Traefik
const wss = new WebSocketServer({
  noServer: true,
  perMessageDeflate: false,
});
const relay = createRelayServer(wss, { verbose: isVerbose });

server.on('upgrade', (req, socket, head) => {
  const { pathname } = parse(req.url || '');
  console.log(
    `🔍 [UPGRADE] path=${pathname} | remote=${socket.remoteAddress}:${socket.remotePort} | upgrade=${req.headers.upgrade} | headers=${JSON.stringify(req.headers)}`,
  );

  socket.on('end', () => {
    console.log(`🛑 [TCP SOCKET END] Remote sent FIN`);
  });

  socket.on('error', (err) => {
    console.warn(`⚠️ [SOCKET ERROR]: ${err.message}`);
  });

  socket.on('close', (hadError) => {
    console.log(
      `🔌 [TCP SOCKET CLOSED] hadError=${hadError} | bytesRead=${socket.bytesRead} | bytesWritten=${socket.bytesWritten}`,
    );
  });

  if (pathname === '/api/ws/session') {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  } else {
    console.warn(`🛑 [UPGRADE REJECTED] Unknown path: ${pathname}`);
    socket.destroy();
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
