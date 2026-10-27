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

  await t.test('Relay persists track metadata across NOW_PLAYING_UPDATE playback packets', async () => {
    const { ws: wsGateway } = await registerGateway(port, 'token-spotify', '4829');

    // 1. Send track metadata with PLAYING state
    wsGateway.send(
      JSON.stringify({
        type: 'NOW_PLAYING_UPDATE',
        sessionId: 'token-spotify',
        timestamp: Date.now(),
        playback: { state: 'PLAYING', positionMs: 10000, capturedAt: Date.now(), isLiveSync: true },
        track: {
          trackId: '4cOdK2wGLETKBW3PvgPWqT',
          title: 'The Pretender',
          artist: 'Foo Fighters',
          durationMs: 269000,
          spotifyUrl: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
        },
      }),
    );

    // 2. Gateway sends a state-only packet with track: null (e.g. Android playbackstatechanged)
    await new Promise((resolve) => setTimeout(resolve, 50));
    wsGateway.send(
      JSON.stringify({
        type: 'NOW_PLAYING_UPDATE',
        sessionId: 'token-spotify',
        timestamp: Date.now(),
        playback: { state: 'PLAYING', positionMs: 15000, capturedAt: Date.now(), isLiveSync: true },
        track: null,
      }),
    );

    // 3. New spectator connects and receives replayed lastNowPlaying
    await new Promise((resolve) => setTimeout(resolve, 50));
    const wsSpectator = new WebSocket(
      `ws://localhost:${port}/api/ws/session?token=token-spotify&role=spectator&pin=4829`,
    );

    const receivedNowPlaying = await new Promise<any>((resolve) => {
      wsSpectator.on('message', (data) => {
        const text = Buffer.isBuffer(data) ? data.toString('utf-8') : String(data);
        const msg = JSON.parse(text);
        if (msg.type === 'NOW_PLAYING_UPDATE') {
          resolve(msg);
        }
      });
    });

    assert.equal(receivedNowPlaying.playback.state, 'PLAYING');
    assert.ok(receivedNowPlaying.track, 'Track should be preserved in relay');
    assert.equal(receivedNowPlaying.track.title, 'The Pretender');
    assert.equal(receivedNowPlaying.track.artist, 'Foo Fighters');

    wsGateway.close();
    wsSpectator.close();
  });

  await t.test('Relay rejects spectator connection if incorrect PIN is supplied in query params', async () => {
    const { ws: wsGateway } = await registerGateway(port, 'token-auth', '4829');

    const wsSpectator = new WebSocket(
      `ws://localhost:${port}/api/ws/session?token=token-auth&role=spectator&pin=9999`,
    );

    const errorPromise = new Promise<{ type: string; code: string }>((resolve) => {
      wsSpectator.on('message', (data) => {
        const text = Buffer.isBuffer(data) ? data.toString('utf-8') : String(data);
        resolve(JSON.parse(text));
      });
    });

    const closeCodePromise = new Promise<number>((resolve) => {
      wsSpectator.on('close', (code) => resolve(code));
    });

    const errorMsg = await errorPromise;
    assert.equal(errorMsg.type, 'ERROR');
    assert.equal(errorMsg.code, 'UNAUTHORIZED_PIN');

    const closeCode = await closeCodePromise;
    assert.equal(closeCode, 4001);

    wsGateway.close();
  });

  await t.test('verifySession validates token and pin accurately', async () => {
    const { ws: wsGateway } = await registerGateway(port, 'token-verify', '1234');

    const wrongPinResult = relay.verifySession('token-verify', '9999');
    assert.equal(wrongPinResult.valid, false);

    const correctPinResult = relay.verifySession('token-verify', '1234');
    assert.equal(correctPinResult.valid, true);

    const nonExistentResult = relay.verifySession('unknown-session', '1234');
    assert.equal(nonExistentResult.valid, false);

    wsGateway.close();
  });

  await t.test('Relay persists SESSION_STATE_CHANGED COMPLETED state and replays to late spectators', async () => {
    const { ws: wsGateway } = await registerGateway(port, 'token-completed', '1234');

    wsGateway.send(
      JSON.stringify({
        type: 'SESSION_STATE_CHANGED',
        sessionId: 'token-completed',
        status: 'COMPLETED',
        timestamp: Date.now(),
      }),
    );

    await new Promise((resolve) => setTimeout(resolve, 50));

    const wsSpectator = new WebSocket(
      `ws://localhost:${port}/api/ws/session?token=token-completed&role=spectator&pin=1234`,
    );

    const receivedState = await new Promise<any>((resolve) => {
      wsSpectator.on('message', (data) => {
        const text = Buffer.isBuffer(data) ? data.toString('utf-8') : String(data);
        const msg = JSON.parse(text);
        if (msg.type === 'SESSION_STATE_CHANGED') {
          resolve(msg);
        }
      });
    });

    assert.equal(receivedState.status, 'COMPLETED');

    wsGateway.close();
    wsSpectator.close();
  });
});
