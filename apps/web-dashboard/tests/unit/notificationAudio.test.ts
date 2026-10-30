import test from 'node:test';
import assert from 'node:assert/strict';
import { playNotificationSound } from '../../src/utils/notificationAudio.ts';

void test('notificationAudio: Safely no-ops in Node.js / SSR environment', () => {
  assert.doesNotThrow(() => {
    playNotificationSound('MILESTONE_25');
    playNotificationSound('EXERTION');
    playNotificationSound('SPRINT');
  });
});

function createMockAudioContext(onStart: () => void, onStop: () => void) {
  return {
    state: 'running',
    currentTime: 10,
    createOscillator: () => ({
      type: '',
      frequency: { setValueAtTime: () => {} },
      connect: () => {},
      start: onStart,
      stop: onStop,
    }),
    createGain: () => ({
      gain: {
        setValueAtTime: () => {},
        exponentialRampToValueAtTime: () => {},
      },
      connect: () => {},
    }),
    destination: {},
    resume: async () => {},
  };
}

void test('notificationAudio: Interacts correctly with Web Audio API mock', () => {
  let startCalls = 0;
  let stopCalls = 0;
  const mockCtx = createMockAudioContext(
    () => {
      startCalls++;
    },
    () => {
      stopCalls++;
    },
  );

  (globalThis as any).window = {
    AudioContext: function () {
      return mockCtx;
    },
    addEventListener: () => {},
  };

  try {
    assert.doesNotThrow(() => {
      playNotificationSound('SPRINT');
    });
    assert.equal(startCalls > 0, true, 'Oscillators must be started');
    assert.equal(stopCalls > 0, true, 'Oscillators must be scheduled to stop');
  } finally {
    delete (globalThis as any).window;
  }
});
