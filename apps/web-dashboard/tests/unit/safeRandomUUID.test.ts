import test from 'node:test';
import assert from 'node:assert/strict';
import { safeRandomUUID } from '../../src/utils/crypto.ts';

void test('safeRandomUUID Unit Tests: Insecure Context and Mobile Compatibility', async (t) => {
  const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  await t.test('Generates valid UUID in standard environment with native crypto.randomUUID', () => {
    const id = safeRandomUUID();
    assert.match(id, UUID_V4_REGEX);
  });

  await t.test('Generates valid RFC 4122 v4 UUID when crypto.randomUUID is undefined (e.g. mobile LAN HTTP)', () => {
    const originalDesc = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    try {
      const originalCrypto = (globalThis as any).crypto;
      Object.defineProperty(globalThis, 'crypto', {
        value: {
          getRandomValues: (arr: Uint8Array) => originalCrypto.getRandomValues(arr),
        },
        configurable: true,
        writable: true,
      });

      const id = safeRandomUUID();
      assert.match(id, UUID_V4_REGEX);
    } finally {
      if (originalDesc) {
        Object.defineProperty(globalThis, 'crypto', originalDesc);
      }
    }
  });

  await t.test('Generates valid UUID when crypto API is completely absent', () => {
    const originalDesc = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    try {
      Object.defineProperty(globalThis, 'crypto', {
        value: undefined,
        configurable: true,
        writable: true,
      });

      const id = safeRandomUUID();
      assert.match(id, UUID_V4_REGEX);
    } finally {
      if (originalDesc) {
        Object.defineProperty(globalThis, 'crypto', originalDesc);
      }
    }
  });

  await t.test('Generates unique IDs across consecutive invocations', () => {
    const id1 = safeRandomUUID();
    const id2 = safeRandomUUID();
    assert.notEqual(id1, id2);
  });
});
