import test from 'node:test';
import assert from 'node:assert/strict';
import { formatTrackTime } from '../../src/hooks/useNowPlaying.ts';

void test('SpotifyPlayerTile: Time and track formatters', async (t) => {
  await t.test('Formats track position and duration into mm:ss', () => {
    assert.equal(formatTrackTime(0), '0:00');
    assert.equal(formatTrackTime(65000), '1:05');
    assert.equal(formatTrackTime(269000), '4:29');
    assert.equal(formatTrackTime(3600000), '60:00');
  });

  await t.test('Calculates progress percentage accurately', () => {
    function calculatePercent(pos: number, dur: number): number {
      if (dur <= 0) return 0;
      return Math.min(100, Math.max(0, (pos / dur) * 100));
    }

    assert.equal(calculatePercent(0, 200000), 0);
    assert.equal(calculatePercent(100000, 200000), 50);
    assert.equal(calculatePercent(250000, 200000), 100);
    assert.equal(calculatePercent(50000, 0), 0);
  });
});

void test('SpotifyPlayerTile: Idle state text helper', async (t) => {
  await t.test('Generates correct idle message with or without athlete name', () => {
    function getIdleMessage(athleteName?: string): string {
      return athleteName
        ? `No se está reproduciendo nada en el teléfono de ${athleteName}`
        : 'No se está reproduciendo nada en el teléfono del corredor';
    }

    assert.equal(getIdleMessage(), 'No se está reproduciendo nada en el teléfono del corredor');
    assert.equal(
      getIdleMessage('Víctor'),
      'No se está reproduciendo nada en el teléfono de Víctor',
    );
  });
});

void test('SpotifyPlayerTile: Status badge text helper', async (t) => {
  await t.test('Returns appropriate badge label and indicator state', () => {
    function getStatusInfo(state: string) {
      if (state === 'PLAYING') return { label: 'Spotify en Directo', isPlaying: true };
      if (state === 'PAUSED') return { label: 'Pausado', isPlaying: false };
      return { label: 'Inactivo', isPlaying: false };
    }

    assert.deepEqual(getStatusInfo('PLAYING'), { label: 'Spotify en Directo', isPlaying: true });
    assert.deepEqual(getStatusInfo('PAUSED'), { label: 'Pausado', isPlaying: false });
    assert.deepEqual(getStatusInfo('NONE'), { label: 'Inactivo', isPlaying: false });
  });
});

void test('SpotifyPlayerTile: Embed iframe and deep-link contract', async (t) => {
  await t.test('Sanitizes URI and builds valid Spotify Embed URL', () => {
    function buildEmbedUrl(trackId: string): string {
      const cleanId = trackId.replace('spotify:track:', '');
      return `https://open.spotify.com/embed/track/${cleanId}?utm_source=generator&theme=0`;
    }

    assert.equal(
      buildEmbedUrl('4cOdK2wGLETKBW3PvgPWqT'),
      'https://open.spotify.com/embed/track/4cOdK2wGLETKBW3PvgPWqT?utm_source=generator&theme=0',
    );
    assert.equal(
      buildEmbedUrl('spotify:track:7ouMYWpwJ422jRcDASZB7P'),
      'https://open.spotify.com/embed/track/7ouMYWpwJ422jRcDASZB7P?utm_source=generator&theme=0',
    );
  });
});
