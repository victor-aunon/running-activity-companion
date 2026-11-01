import test from 'node:test';
import assert from 'node:assert/strict';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'node:http';
import { createRelayServer } from '../../src/services/RelayServerLogic.ts';

void test('SSE & Cheer HTTP Integration: Continuous downlink and HTTP cheer dispatch', async (t) => {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || '', 'http://localhost');
    if (url.pathname === '/api/session/stream') {
      const token = (url.searchParams.get('token') || '').trim().toLowerCase();
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });
      const backlog = relay.getSpectatorBacklogMessages(token);
      for (const msg of backlog) {
        res.write(`data: ${msg}\n\n`);
      }
      const unsubscribe = relay.subscribeSseSpectator(token, (payload) => {
        res.write(`data: ${payload}\n\n`);
      });
      req.on('close', () => unsubscribe());
      return;
    }

    if (url.pathname === '/api/session/cheer' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        const payload = JSON.parse(body);
        const result = relay.dispatchCheerHttp(payload);
        res.writeHead(result.status || 200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      });
      return;
    }
  });

  const wss = new WebSocketServer({ server });
  const relay = createRelayServer(wss, { silent: true });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as { port: number }).port;

  t.after(() => {
    relay.close();
    server.close();
  });

  await t.test('Gateway registers and SSE spectator receives initial backlog and live 1Hz telemetry', async () => {
    const sessionToken = 'sse_test_room';

    // 1. Connect Android Gateway via WS
    const gw = new WebSocket(`ws://localhost:${port}/api/ws/session?token=${sessionToken}&role=gateway`);
    await new Promise((r) => gw.on('open', r));

    gw.send(
      JSON.stringify({
        type: 'GATEWAY_REGISTER',
        sessionId: sessionToken,
        spectatorPin: '4321',
        athleteName: 'Víctor',
      }),
    );

    // Send initial telemetry from gateway
    gw.send(
      JSON.stringify({
        type: 'TELEMETRY_SNAPSHOT',
        sessionId: sessionToken,
        seq: 1,
        timestamp: Date.now(),
        metrics: { heartRateBpm: 155, speedMps: 3.5 },
        coordinates: { lat: 40.4168, lng: -3.7038 },
      }),
    );

    await new Promise((r) => setTimeout(r, 50));

    // 2. Connect Spectator via SSE (HTTP GET stream)
    const sseChunks: string[] = [];
    const sseReq = http.get(`http://localhost:${port}/api/session/stream?token=${sessionToken}`, (res) => {
      assert.equal(res.statusCode, 200);
      assert.equal(res.headers['content-type'], 'text/event-stream');

      res.on('data', (chunk) => {
        sseChunks.push(chunk.toString());
      });
    });

    await new Promise((r) => setTimeout(r, 50));

    // Verify initial backlog arrived via SSE
    assert.ok(sseChunks.length > 0);
    assert.ok(sseChunks.some((c) => c.includes('TELEMETRY_SNAPSHOT')));

    // 3. Gateway broadcasts live update #2
    gw.send(
      JSON.stringify({
        type: 'TELEMETRY_SNAPSHOT',
        sessionId: sessionToken,
        seq: 2,
        timestamp: Date.now(),
        metrics: { heartRateBpm: 160, speedMps: 3.8 },
      }),
    );

    await new Promise((r) => setTimeout(r, 50));

    // Verify live update #2 arrived via SSE
    assert.ok(sseChunks.some((c) => c.includes('"seq":2')));

    // 4. Spectator sends cheer via HTTP POST
    const cheerPostRes = await fetch(`http://localhost:${port}/api/session/cheer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: sessionToken,
        pin: '4321',
        senderName: 'Laura',
        presetId: 'FIRE',
        body: '¡Fuego en las piernas!',
      }),
    });

    assert.equal(cheerPostRes.status, 200);
    const cheerResult = await cheerPostRes.json();
    assert.equal(cheerResult.success, true);
    assert.ok(cheerResult.notificationId);

    await new Promise((r) => setTimeout(r, 50));

    // Verify cheer was broadcasted to SSE stream
    assert.ok(sseChunks.some((c) => c.includes('CHEER_STATUS_UPDATE') && c.includes('Laura')));

    sseReq.destroy();
    gw.close();
  });

  await t.test('HTTP Cheer rejects invalid PIN with 401', async () => {
    const sessionToken = 'sse_pin_room';

    const gw = new WebSocket(`ws://localhost:${port}/api/ws/session?token=${sessionToken}&role=gateway`);
    await new Promise((r) => gw.on('open', r));

    gw.send(
      JSON.stringify({
        type: 'GATEWAY_REGISTER',
        sessionId: sessionToken,
        spectatorPin: '9999',
      }),
    );

    await new Promise((r) => setTimeout(r, 50));

    const badCheerRes = await fetch(`http://localhost:${port}/api/session/cheer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: sessionToken,
        pin: '1234', // Incorrect
        senderName: 'Test',
        presetId: 'CLAP',
        body: 'Bravo',
      }),
    });

    assert.equal(badCheerRes.status, 401);
    const badResult = await badCheerRes.json();
    assert.equal(badResult.success, false);

    gw.close();
  });
});
