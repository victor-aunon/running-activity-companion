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
  formatPaceDifference,
  parseTargetPace,
} from '../../src/utils/formatters.ts';

void test('Bento Metric Fallbacks Unit Tests', async (t) => {
  await t.test('formatPaceDifference converts second deltas into minutes and seconds', () => {
    // Slower pace (walking vs running target): 540s (9:00/km) vs 270s (4:30/km) = +270s -> +4:30
    const diff1 = formatPaceDifference(540, 270);
    assert.ok(diff1);
    assert.equal(diff1?.text, '+4:30');
    assert.equal(diff1?.diffSeconds, 270);
    assert.equal(diff1?.colorClass, 'text-amber-600');
    assert.equal(diff1?.icon, '↗');

    // Large walking delta: 730s (12:10/km) vs 270s (4:30/km) = +460s -> +7:40 (Fixes 0:460 bug!)
    const diff460 = formatPaceDifference(730, 270);
    assert.ok(diff460);
    assert.equal(diff460?.text, '+7:40');
    assert.equal(diff460?.diffSeconds, 460);

    // Small positive delta: 275s (4:35/km) vs 270s (4:30/km) = +5s -> +0:05
    const diff2 = formatPaceDifference(275, 270);
    assert.ok(diff2);
    assert.equal(diff2?.text, '+0:05');
    assert.equal(diff2?.colorClass, 'text-amber-600');
    assert.equal(diff2?.icon, '↗');

    // Faster pace (negative delta): 255s (4:15/km) vs 270s (4:30/km) = -15s -> -0:15
    const diff3 = formatPaceDifference(255, 270);
    assert.ok(diff3);
    assert.equal(diff3?.text, '-0:15');
    assert.equal(diff3?.diffSeconds, -15);
    assert.equal(diff3?.colorClass, 'text-emerald-600');
    assert.equal(diff3?.icon, '↘');

    // Significantly faster pace: 140s vs 270s = -130s -> -2:10
    const diff4 = formatPaceDifference(140, 270);
    assert.ok(diff4);
    assert.equal(diff4?.text, '-2:10');
    assert.equal(diff4?.diffSeconds, -130);

    // Exactly on pace: 270s vs 270s = 0s -> 0:00
    const diffExact = formatPaceDifference(270, 270);
    assert.ok(diffExact);
    assert.equal(diffExact?.text, '0:00');
    assert.equal(diffExact?.diffSeconds, 0);
    assert.equal(diffExact?.colorClass, 'text-teal-600');
    assert.equal(diffExact?.icon, '✓');

    // Invalid / zero pace returns null
    assert.equal(formatPaceDifference(0, 270), null);
    assert.equal(formatPaceDifference(270, 0), null);
    assert.equal(formatPaceDifference(-10, 270), null);
    assert.equal(formatPaceDifference(null, 270), null);
    assert.equal(formatPaceDifference(270, null), null);
  });

  await t.test('parseTargetPace parses mm:ss strings and numeric seconds safely', () => {
    assert.equal(parseTargetPace('4:30'), 270);
    assert.equal(parseTargetPace('04:30'), 270);
    assert.equal(parseTargetPace('5:15'), 315);
    assert.equal(parseTargetPace('3:50'), 230);
    assert.equal(parseTargetPace(267), 267);
    assert.equal(parseTargetPace('267'), 267);
    assert.equal(parseTargetPace(undefined), undefined);
    assert.equal(parseTargetPace(''), undefined);
    assert.equal(parseTargetPace('invalid'), undefined);
    assert.equal(parseTargetPace('12:99'), undefined); // invalid seconds > 59
  });
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
