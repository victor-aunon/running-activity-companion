import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatchBrowserNotification } from '../../src/utils/browserNotificationDispatcher.ts';

void test('dispatchBrowserNotification Unit Tests: System notification dispatch with Service Worker', async (t) => {
  await t.test('Returns false in Node.js / SSR environment where window is undefined', async () => {
    const result = await dispatchBrowserNotification({
      title: '¡25% Completado!',
      message: 'Víctor ha completado 2.5 km',
      type: 'MILESTONE_25',
    });
    assert.equal(result, false);
  });

  await t.test('Returns false when Notification.permission is not granted', async () => {
    const mockWindow = {
      Notification: {
        permission: 'denied',
      },
      location: { href: 'http://localhost:3000/session/abc' },
    };

    (globalThis as any).window = mockWindow;
    try {
      const result = await dispatchBrowserNotification({
        title: '¡25% Completado!',
        message: 'Víctor ha completado 2.5 km',
      });
      assert.equal(result, false);
    } finally {
      delete (globalThis as any).window;
    }
  });

  await t.test('Dispatches via serviceWorker.showNotification when SW is ready and permission is granted', async () => {
    let showNotificationCalled = false;
    let passedTitle = '';
    let passedOptions: any = null;

    const mockRegistration = {
      showNotification: async (title: string, options: any) => {
        showNotificationCalled = true;
        passedTitle = title;
        passedOptions = options;
      },
    };

    const mockWindow = {
      Notification: {
        permission: 'granted',
      },
      navigator: {
        serviceWorker: {
          ready: Promise.resolve(mockRegistration),
        },
      },
      location: { href: 'http://localhost:3000/session/abc' },
    };

    (globalThis as any).window = mockWindow;

    try {
      const result = await dispatchBrowserNotification(
        {
          title: 'Alto Esfuerzo',
          message: 'Víctor está a 180 bpm',
          type: 'EXERTION',
        },
        { url: 'http://localhost:3000/session/test' },
      );

      assert.equal(result, true);
      assert.equal(showNotificationCalled, true);
      assert.equal(passedTitle, 'Alto Esfuerzo');
      assert.equal(passedOptions.body, 'Víctor está a 180 bpm');
      assert.equal(passedOptions.icon, '/icon.svg');
      assert.equal(passedOptions.tag, 'running-support-EXERTION');
      assert.equal(passedOptions.data.url, 'http://localhost:3000/session/test');
    } finally {
      delete (globalThis as any).window;
    }
  });

  await t.test('Falls back to new Notification constructor when serviceWorker is not supported or fails', async () => {
    let constructorCalled = false;
    let constructorTitle = '';
    let constructorOptions: any = null;

    class MockNotification {
      static permission = 'granted';
      constructor(title: string, options: any) {
        constructorCalled = true;
        constructorTitle = title;
        constructorOptions = options;
      }
    }

    const mockWindow = {
      Notification: MockNotification,
      navigator: {}, // no serviceWorker
      location: { href: 'http://localhost:3000/session/abc' },
    };

    (globalThis as any).window = mockWindow;

    try {
      const result = await dispatchBrowserNotification({
        title: '¡Sprint en curso!',
        message: 'Sprint final detectado',
        type: 'SPRINT',
      });

      assert.equal(result, true);
      assert.equal(constructorCalled, true);
      assert.equal(constructorTitle, '¡Sprint en curso!');
      assert.equal(constructorOptions.body, 'Sprint final detectado');
    } finally {
      delete (globalThis as any).window;
    }
  });
});
