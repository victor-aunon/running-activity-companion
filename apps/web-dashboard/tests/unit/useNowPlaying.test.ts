import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateInterpolatedPosition,
  shouldAutoTransitionToIdle,
} from '../../src/hooks/useNowPlaying.ts';
import type { RunnerPlaybackStatus } from '@running-support/shared-contracts';

void test('useNowPlaying: Interpolation calculation', async (t) => {
  await t.test('Calculates live position correctly when PLAYING', () => {
    const playback: RunnerPlaybackStatus = {
      state: 'PLAYING',
      positionMs: 30000,
      capturedAt: 100000,
    };
    const durationMs = 180000;
    const now = 105000;

    const interpolated = calculateInterpolatedPosition(playback, durationMs, now);
    assert.equal(interpolated, 35000);
  });

  await t.test('Clamps interpolated position to durationMs', () => {
    const playback: RunnerPlaybackStatus = {
      state: 'PLAYING',
      positionMs: 175000,
      capturedAt: 100000,
    };
    const durationMs = 180000;
    const now = 110000;

    const interpolated = calculateInterpolatedPosition(playback, durationMs, now);
    assert.equal(interpolated, 180000);
  });
});

void test('useNowPlaying: Paused or idle position', async (t) => {
  await t.test('Returns exact position without advancing when PAUSED or NONE', () => {
    const pausedPlayback: RunnerPlaybackStatus = {
      state: 'PAUSED',
      positionMs: 45000,
      capturedAt: 100000,
    };
    const durationMs = 200000;
    const now = 120000;

    assert.equal(calculateInterpolatedPosition(pausedPlayback, durationMs, now), 45000);

    const idlePlayback: RunnerPlaybackStatus = {
      state: 'NONE',
      positionMs: 0,
      capturedAt: 100000,
    };
    assert.equal(calculateInterpolatedPosition(idlePlayback, durationMs, now), 0);
  });

  await t.test('Detects 60s timeout for auto-transitioning paused tracks to idle', () => {
    assert.equal(shouldAutoTransitionToIdle('PAUSED', 100000, 159999), false);
    assert.equal(shouldAutoTransitionToIdle('PAUSED', 100000, 160000), true);
    assert.equal(shouldAutoTransitionToIdle('PAUSED', 100000, 170000), true);
    assert.equal(shouldAutoTransitionToIdle('PLAYING', 100000, 200000), false);
    assert.equal(shouldAutoTransitionToIdle('NONE', 100000, 200000), false);
  });
});
