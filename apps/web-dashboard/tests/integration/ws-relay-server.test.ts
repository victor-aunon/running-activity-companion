import test from 'node:test';
import assert from 'node:assert/strict';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'node:http';
import { createRelayServer } from '../../src/services/RelayServerLogic.ts';

async function registerGateway(port: number, token: string, pin: string) {
  const ws = new WebSocket(`ws://localhost:${port}/api/ws/session?token=${token}&role=gateway`);
  await new Promise((resolve) => ws.on('open', resolve));
  const ackPromise = new Promise<{ type: string; status: string }>((resolve) => {
    ws.on('message', (data) => {
      const text = Buffer.isBuffer(data)
        ? data.toString('utf-8')
        : new TextDecoder().decode(data as ArrayBuffer);
      resolve(JSON.parse(text) as { type: string; status: string });
    });
  });
  ws.send(
    JSON.stringify({
      type: 'GATEWAY_REGISTER',
      sessionId: `sess-${token}`,
      spectatorPin: pin,
      athleteName: 'Víctor',
      startTime: Date.now(),
    }),
  );
  return { ws, ack: await ackPromise };
}

async function sendFailedCheer(ws: WebSocket, notifId: string): Promise<{ code: string }> {
  const errPromise = new Promise<{ code: string }>((resolve) => {
    ws.once('message', (data) => {
      const text = Buffer.isBuffer(data)
        ? data.toString('utf-8')
        : new TextDecoder().decode(data as ArrayBuffer);
      resolve(JSON.parse(text) as { code: string });
    });
  });
  ws.send(
    JSON.stringify({
      type: 'DISPATCH_CHEER',
      notificationId: notifId,
      sessionId: 'sess-pin',
      spectatorPin: '0000',
      senderName: 'Test',
      presetId: 'MUCHO_ANIMO',
      body: '¡Mucho ánimo!',
      ttlSeconds: 60,
    }),
  );
  return errPromise;
}

void test('WebSocket Relay Server: Room management and Spectator PIN rate limiting', async (t) => {
  const server = http.createServer();
  const wss = new WebSocketServer({ server });
  const relay = createRelayServer(wss);

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as { port: number }).port;

  t.after(() => {
    relay.close();
    wss.close();
    server.close();
  });

  await t.test('Gateway registers session with PIN', async () => {
    const { ws, ack } = await registerGateway(port, 'token-123', '4829');
    assert.equal(ack.type, 'GATEWAY_REGISTER_ACK');
    assert.equal(ack.status, 'READY');
    ws.close();
  });

  await t.test('Spectator triggers PIN rate limiting after 5 failed attempts', async () => {
    const { ws: wsGateway } = await registerGateway(port, 'token-pin', '1234');
    const wsSpectator = new WebSocket(
      `ws://localhost:${port}/api/ws/session?token=token-pin&role=spectator`,
    );
    await new Promise((resolve) => wsSpectator.on('open', resolve));

    for (let i = 0; i < 4; i++) {
      const err = await sendFailedCheer(wsSpectator, `notif-${i}`);
      assert.equal(err.code, 'UNAUTHORIZED_PIN');
    }

    const rateLimitErr = await sendFailedCheer(wsSpectator, 'notif-5');
    assert.equal(rateLimitErr.code, 'PIN_RATE_LIMITED');

    wsGateway.close();
    wsSpectator.close();
  });
});
