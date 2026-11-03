import test from 'node:test';
import assert from 'node:assert/strict';
import { registerDashboardServiceWorker } from '../../src/utils/serviceWorkerRegistration.ts';

void test('registerDashboardServiceWorker Unit Tests', async (t) => {
  await t.test('Returns null in Node.js / SSR environment', async () => {
    const result = await registerDashboardServiceWorker();
    assert.equal(result, null);
  });

  await t.test('Registers /sw.js successfully when serviceWorker API is available', async () => {
    let registeredPath = '';
    const mockRegistration = { scope: '/' };

    const mockWindow = {
      navigator: {
        serviceWorker: {
          register: async (path: string) => {
            registeredPath = path;
            return mockRegistration;
          },
        },
      },
    };

    (globalThis as any).window = mockWindow;
    try {
      const reg = await registerDashboardServiceWorker();
      assert.equal(registeredPath, '/sw.js');
      assert.deepEqual(reg, mockRegistration as any);
    } finally {
      delete (globalThis as any).window;
    }
  });

  await t.test('Catches registration errors and returns null gracefully', async () => {
    const mockWindow = {
      navigator: {
        serviceWorker: {
          register: async () => {
            throw new Error('Registration security error');
          },
        },
      },
    };

    (globalThis as any).window = mockWindow;
    try {
      const reg = await registerDashboardServiceWorker();
      assert.equal(reg, null);
    } finally {
      delete (globalThis as any).window;
    }
  });
});
