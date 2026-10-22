import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatPace,
  formatDistanceKm,
  formatElapsedTime,
  resolveCadenceZone,
  parseCadenceZones,
  calculateDynamicEta,
  formatElevationProfile,
} from '../../src/utils/formatters.ts';

void test('Bento Metric Fallbacks Unit Tests', async (t) => {
  await t.test('formatPace returns --:-- on zero, negative, or invalid pace', () => {
    assert.equal(formatPace(0), '--:--');
    assert.equal(formatPace(-10), '--:--');
    assert.equal(formatPace(NaN), '--:--');
    assert.equal(formatPace(Infinity), '--:--');
    assert.equal(formatPace(null), '--:--');
    assert.equal(formatPace(undefined), '--:--');
    assert.equal(formatPace(262), '4:22');
    assert.equal(formatPace(300), '5:00');
  });

  await t.test('formatDistanceKm returns 0.00 on zero, negative, or invalid distance', () => {
    assert.equal(formatDistanceKm(0), '0.00');
    assert.equal(formatDistanceKm(-500), '0.00');
    assert.equal(formatDistanceKm(NaN), '0.00');
    assert.equal(formatDistanceKm(Infinity), '0.00');
    assert.equal(formatDistanceKm(null), '0.00');
    assert.equal(formatDistanceKm(undefined), '0.00');
    assert.equal(formatDistanceKm(10420), '10.42');
    assert.equal(formatDistanceKm(500), '0.50');
  });

  await t.test('formatElapsedTime returns --:-- on undefined, negative, or invalid seconds', () => {
    assert.equal(formatElapsedTime(undefined), '--:--');
    assert.equal(formatElapsedTime(null), '--:--');
    assert.equal(formatElapsedTime(-1), '--:--');
    assert.equal(formatElapsedTime(NaN), '--:--');
    assert.equal(formatElapsedTime(0), '00:00');
    assert.equal(formatElapsedTime(2895), '48:15');
    assert.equal(formatElapsedTime(3665), '01:01:05');
  });
});

void test('Bento Cadence and Navigation Helpers Unit Tests', async (t) => {
  await t.test('resolveCadenceZone classifies real SPM ranges accurately', () => {
    assert.equal(resolveCadenceZone(0).badge, 'Sin cadencia');
    assert.equal(resolveCadenceZone(145).badge, 'Cadencia Baja');
    assert.equal(resolveCadenceZone(160).badge, 'Cadencia Moderada');
    assert.equal(resolveCadenceZone(178).badge, 'Rango Óptimo');
    assert.equal(resolveCadenceZone(192).badge, 'Cadencia Alta');
  });

  await t.test(
    'parseCadenceZones parses valid environment variables and falls back on invalid',
    () => {
      const custom = parseCadenceZones({
        NEXT_PUBLIC_CADENCE_LOW_MAX: '150',
        NEXT_PUBLIC_CADENCE_MODERATE_MAX: '165',
        NEXT_PUBLIC_CADENCE_OPTIMAL_MAX: '180',
      });
      assert.deepEqual(custom, { lowMax: 150, moderateMax: 165, optimalMax: 180 });

      const fallback = parseCadenceZones({
        NEXT_PUBLIC_CADENCE_LOW_MAX: '170',
        NEXT_PUBLIC_CADENCE_MODERATE_MAX: '150',
        NEXT_PUBLIC_CADENCE_OPTIMAL_MAX: '180',
      });
      assert.deepEqual(fallback, { lowMax: 155, moderateMax: 169, optimalMax: 185 });
    },
  );

  await t.test('calculateDynamicEta returns realistic arrival time or --:--', () => {
    assert.equal(calculateDynamicEta(0, 0), '--:--');
    assert.equal(calculateDynamicEta(10420, 0), '--:--');
    const eta = calculateDynamicEta(10420, 3.65, 21097);
    assert.match(eta, /^\d{2}:\d{2}$/);
  });

  await t.test('formatElevationProfile accumulates gain and loss correctly', () => {
    assert.match(formatElevationProfile([]), /Esperando/);
    assert.match(formatElevationProfile([650]), /650 m/);
    const profile = formatElevationProfile([650, 655, 653, 660], 660);
    assert.match(profile, /\+12m \/ -2m/);
  });
});
