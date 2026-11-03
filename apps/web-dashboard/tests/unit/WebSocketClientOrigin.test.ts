import test from 'node:test';
import assert from 'node:assert/strict';
import { WebSocketClient } from '../../src/services/WebSocketClient.ts';

void test('WebSocketClient resolveHttpOrigin Unit Tests', async (t) => {
  await t.test('Resolves http://localhost:3001 when wsUrl is ws://localhost:3001/api/ws/session', () => {
    const mockWindow = {
      location: { origin: 'http://localhost:3000' },
    };
    (globalThis as any).window = mockWindow;

    try {
      const client = new WebSocketClient({
        url: 'ws://localhost:3001/api/ws/session',
        token: 'test-token',
      });

      assert.equal(client.resolveHttpOrigin(), 'http://localhost:3001');
    } finally {
      delete (globalThis as any).window;
    }
  });

  await t.test('Resolves https://relay.domain.com when wsUrl is wss://relay.domain.com/api/ws/session', () => {
    const mockWindow = {
      location: { origin: 'https://app.domain.com' },
    };
    (globalThis as any).window = mockWindow;

    try {
      const client = new WebSocketClient({
        url: 'wss://relay.domain.com/api/ws/session',
        token: 'test-token',
      });

      assert.equal(client.resolveHttpOrigin(), 'https://relay.domain.com');
    } finally {
      delete (globalThis as any).window;
    }
  });

  await t.test('Falls back to window.location.origin when wsUrl is a relative path', () => {
    const mockWindow = {
      location: { origin: 'http://localhost:3000' },
    };
    (globalThis as any).window = mockWindow;

    try {
      const client = new WebSocketClient({
        url: '/api/ws/session',
        token: 'test-token',
      });

      assert.equal(client.resolveHttpOrigin(), 'http://localhost:3000');
    } finally {
      delete (globalThis as any).window;
    }
  });
});
