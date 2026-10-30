import test from 'node:test';
import assert from 'node:assert/strict';
import { requestNotificationPermissionUpfront } from '../../src/utils/notificationPermissions.ts';

void test('Landing Access Page: Requests permission when default', async () => {
  let requestPermissionCalled = false;
  const originalNotification = (globalThis as any).Notification;

  (globalThis as any).Notification = {
    permission: 'default',
    requestPermission: async () => {
      requestPermissionCalled = true;
      return 'granted';
    },
  };

  try {
    const result = await requestNotificationPermissionUpfront();
    assert.equal(requestPermissionCalled, true, 'Must invoke Notification.requestPermission()');
    assert.equal(result, 'granted');
  } finally {
    (globalThis as any).Notification = originalNotification;
  }
});

void test('Landing Access Page: Handles granted permission and unsupported platforms', async (t) => {
  await t.test('Does not re-request when permission is already granted', async () => {
    let requestPermissionCalled = false;
    const originalNotification = (globalThis as any).Notification;

    (globalThis as any).Notification = {
      permission: 'granted',
      requestPermission: async () => {
        requestPermissionCalled = true;
        return 'granted';
      },
    };

    try {
      const result = await requestNotificationPermissionUpfront();
      assert.equal(requestPermissionCalled, false, 'Should not request when already granted');
      assert.equal(result, 'granted');
    } finally {
      (globalThis as any).Notification = originalNotification;
    }
  });

  await t.test('Gracefully returns null when Notification API is not available', async () => {
    const originalNotification = (globalThis as any).Notification;
    delete (globalThis as any).Notification;

    try {
      const result = await requestNotificationPermissionUpfront();
      assert.equal(
        result,
        null,
        'Must safely return null without throwing on unsupported platform',
      );
    } finally {
      (globalThis as any).Notification = originalNotification;
    }
  });
});
