import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getRequiredAthleteName,
  getAthleteSlug,
  getDefaultSessionToken,
} from '../../src/utils/athlete.ts';

void test('Athlete utilities: Strict environment validation without fallbacks', async (t) => {
  await t.test('Returns explicit name when provided and valid', () => {
    assert.equal(getRequiredAthleteName('Laura', {}), 'Laura');
    assert.equal(getRequiredAthleteName('  Carlos  ', {}), 'Carlos');
  });

  await t.test('Returns NEXT_PUBLIC_ATHLETE_NAME from env when explicit name is omitted', () => {
    const env = { NEXT_PUBLIC_ATHLETE_NAME: 'Elena' };
    assert.equal(getRequiredAthleteName(undefined, env), 'Elena');
  });

  await t.test('Throws an error when NEXT_PUBLIC_ATHLETE_NAME is undefined or empty', () => {
    assert.throws(() => getRequiredAthleteName(undefined, {}), /NEXT_PUBLIC_ATHLETE_NAME/);
    assert.throws(
      () => getRequiredAthleteName(undefined, { NEXT_PUBLIC_ATHLETE_NAME: '' }),
      /NEXT_PUBLIC_ATHLETE_NAME/,
    );
    assert.throws(
      () => getRequiredAthleteName(undefined, { NEXT_PUBLIC_ATHLETE_NAME: '   ' }),
      /NEXT_PUBLIC_ATHLETE_NAME/,
    );
  });

  await t.test('Throws an error when explicit name is empty and env is also missing', () => {
    assert.throws(() => getRequiredAthleteName('', {}), /NEXT_PUBLIC_ATHLETE_NAME/);
    assert.throws(() => getRequiredAthleteName('   ', {}), /NEXT_PUBLIC_ATHLETE_NAME/);
  });

  await t.test('getAthleteSlug sanitizes accents and special characters properly', () => {
    assert.equal(getAthleteSlug('Víctor'), 'victor');
    assert.equal(getAthleteSlug('María José'), 'maria-jose');
    assert.equal(getAthleteSlug("Álvaro O'Donnell"), 'alvaro-o-donnell');
  });

  await t.test(
    'getDefaultSessionToken constructs slugged token or throws if env is missing',
    () => {
      assert.equal(
        getDefaultSessionToken(undefined, { NEXT_PUBLIC_ATHLETE_NAME: 'Ana García' }),
        'carrera-ana-garcia',
      );
      assert.throws(() => getDefaultSessionToken(undefined, {}), /NEXT_PUBLIC_ATHLETE_NAME/);
    },
  );
});
