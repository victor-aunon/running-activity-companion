import test from 'node:test';
import assert from 'node:assert/strict';
import { isDispatchCheerCommand, isCheerStatusEvent } from '@running-support/shared-contracts';

void test('Notification Contract Test: Spectator cheer dispatch and gratitude reply schema validation', async (t) => {
  await t.test('Valid DISPATCH_CHEER command satisfies contract', () => {
    const validCommand = {
      type: 'DISPATCH_CHEER',
      notificationId: '550e8400-e29b-41d4-a716-446655440000',
      sessionId: '660e8400-e29b-41d4-a716-446655440000',
      spectatorPin: '4829',
      senderName: 'Amigo Runner',
      presetId: 'MUCHO_ANIMO',
      body: '¡Mucho ánimo!',
      ttlSeconds: 60,
    };

    assert.equal(isDispatchCheerCommand(validCommand), true);
  });

  await t.test('Valid CHEER_STATUS_UPDATE satisfies contract', () => {
    const validStatus = {
      type: 'CHEER_STATUS_UPDATE',
      notificationId: '550e8400-e29b-41d4-a716-446655440000',
      sessionId: '660e8400-e29b-41d4-a716-446655440000',
      status: 'AGRADECIDO',
      runnerReplyText: 'Víctor te lo agradece',
      timestamp: Date.now(),
    };

    assert.equal(isCheerStatusEvent(validStatus), true);
  });
});
