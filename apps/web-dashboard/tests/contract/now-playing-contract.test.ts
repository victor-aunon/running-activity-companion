import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isNowPlayingUpdatePacket,
  type NowPlayingUpdatePacket,
} from '@running-support/shared-contracts';

void test('Now Playing Contract Test: Valid packet schemas', async (t) => {
  await t.test('Valid active track NowPlayingUpdatePacket satisfies schema contract', () => {
    const validPacket: NowPlayingUpdatePacket = {
      type: 'NOW_PLAYING_UPDATE',
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      timestamp: Date.now(),
      playback: {
        state: 'PLAYING',
        positionMs: 45000,
        capturedAt: Date.now(),
        isLiveSync: true,
      },
      track: {
        trackId: '4cOdK2wGLETKBW3PvgPWqT',
        title: 'The Pretender',
        artist: 'Foo Fighters',
        album: 'Echoes, Silence, Patience & Grace',
        artworkUrl: 'https://i.scdn.co/image/ab67616d0000b273b5e434e7978280f1ef726cf9',
        durationMs: 269000,
        spotifyUrl: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
      },
    };

    assert.equal(isNowPlayingUpdatePacket(validPacket), true);
  });

  await t.test('Valid idle NowPlayingUpdatePacket with null track satisfies contract', () => {
    const idlePacket: NowPlayingUpdatePacket = {
      type: 'NOW_PLAYING_UPDATE',
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      timestamp: Date.now(),
      playback: {
        state: 'NONE',
        positionMs: 0,
        capturedAt: Date.now(),
      },
      track: null,
    };

    assert.equal(isNowPlayingUpdatePacket(idlePacket), true);
  });
});

void test('Now Playing Contract Test: Invalid packet schemas', async (t) => {
  await t.test('Rejects invalid packet missing playback details', () => {
    const invalidPacket = {
      type: 'NOW_PLAYING_UPDATE',
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      timestamp: Date.now(),
    };

    assert.equal(isNowPlayingUpdatePacket(invalidPacket), false);
  });

  await t.test('Rejects invalid packet with malformed track', () => {
    const malformedTrackPacket = {
      type: 'NOW_PLAYING_UPDATE',
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      timestamp: Date.now(),
      playback: {
        state: 'PLAYING',
        positionMs: 12000,
        capturedAt: Date.now(),
      },
      track: {
        trackId: '123',
      },
    };

    assert.equal(isNowPlayingUpdatePacket(malformedTrackPacket), false);
  });
});
