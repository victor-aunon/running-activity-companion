import test from 'node:test';
import assert from 'node:assert/strict';
import { extractLocalityFromAddress } from '../../src/hooks/useGpsLocality.ts';

void test('useGpsLocality: Address extraction and formatting unit tests', async (t) => {
  await t.test('extracts city and country when both are present', () => {
    const address = {
      city: 'Madrid',
      country: 'España',
    };
    assert.equal(extractLocalityFromAddress(address), 'Madrid, España');
  });

  await t.test('extracts town when city is not available', () => {
    const address = {
      town: 'Alcalá de Henares',
      country: 'España',
    };
    assert.equal(extractLocalityFromAddress(address), 'Alcalá de Henares, España');
  });

  await t.test('extracts village when city and town are not available', () => {
    const address = {
      village: 'Rascafría',
      country: 'España',
    };
    assert.equal(extractLocalityFromAddress(address), 'Rascafría, España');
  });

  await t.test('extracts municipality or state as fallback', () => {
    const address = {
      municipality: 'Las Rozas de Madrid',
      country: 'España',
    };
    assert.equal(extractLocalityFromAddress(address), 'Las Rozas de Madrid, España');
  });

  await t.test('returns null when address object has no locality components', () => {
    assert.equal(extractLocalityFromAddress({}), null);
  });
});
