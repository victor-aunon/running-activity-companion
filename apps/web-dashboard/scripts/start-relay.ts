import http from 'node:http';
import { parse } from 'node:url';
import { WebSocketServer } from 'ws';
import { createRelayServer } from '../src/services/RelayServerLogic.ts';

const PORT = parseInt(process.env.WS_PORT || process.env.PORT || '3001', 10);

const server = http.createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(
    JSON.stringify({
      status: 'UP',
      service: 'WebSocket Relay Server',
      endpoint: '/api/ws/session',
    }),
  );
});

const wss = new WebSocketServer({ noServer: true });
const relay = createRelayServer(wss);

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

process.on('SIGINT', () => {
  relay.close();
  wss.close();
  server.close(() => process.exit(0));
});
