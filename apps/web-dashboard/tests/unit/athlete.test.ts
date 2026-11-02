import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getRequiredAthleteName,
  getAthleteSlug,
  getDefaultSessionToken,
} from '../../src/utils/athlete.ts';

void test('Athlete utilities: Environment validation with default fallback', async (t) => {
  await t.test('Returns explicit name when provided and valid', () => {
    assert.equal(getRequiredAthleteName('Laura', {}), 'Laura');
    assert.equal(getRequiredAthleteName('  Carlos  ', {}), 'Carlos');
  });

  await t.test('Returns NEXT_PUBLIC_ATHLETE_NAME from env when explicit name is omitted', () => {
    const env = { NEXT_PUBLIC_ATHLETE_NAME: 'Elena' };
    assert.equal(getRequiredAthleteName(undefined, env), 'Elena');
  });

  await t.test('Falls back to DEFAULT_ATHLETE_NAME (Víctor) when env is undefined or empty', () => {
    assert.equal(getRequiredAthleteName(undefined, {}), 'Víctor');
    assert.equal(getRequiredAthleteName(undefined, { NEXT_PUBLIC_ATHLETE_NAME: '' }), 'Víctor');
    assert.equal(getRequiredAthleteName(undefined, { NEXT_PUBLIC_ATHLETE_NAME: '   ' }), 'Víctor');
  });

  await t.test('Falls back to DEFAULT_ATHLETE_NAME when explicit name is empty and env is missing', () => {
    assert.equal(getRequiredAthleteName('', {}), 'Víctor');
    assert.equal(getRequiredAthleteName('   ', {}), 'Víctor');
  });

  await t.test('getAthleteSlug sanitizes accents and special characters properly', () => {
    assert.equal(getAthleteSlug('Víctor'), 'victor');
    assert.equal(getAthleteSlug('María José'), 'maria-jose');
    assert.equal(getAthleteSlug("Álvaro O'Donnell"), 'alvaro-o-donnell');
  });

  await t.test('getDefaultSessionToken constructs slugged token with fallback', () => {
    assert.equal(
      getDefaultSessionToken(undefined, { NEXT_PUBLIC_ATHLETE_NAME: 'Ana García' }),
      'carrera-ana-garcia',
    );
    assert.equal(getDefaultSessionToken(undefined, {}), 'carrera-victor');
  });
});
