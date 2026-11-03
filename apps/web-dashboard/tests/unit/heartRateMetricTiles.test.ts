import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveHeartRateBadgeClasses } from '../../src/utils/formatters.ts';
import type { HeartRateZoneResult } from '../../src/types/telemetry.ts';

void test('resolveHeartRateBadgeClasses Unit Tests: Dynamic Effort Zone Badges', async (t) => {
  await t.test('Applies zone 4 orange styling when zoneInfo is Zone 4 (Umbral)', () => {
    const zone4: HeartRateZoneResult = {
      zone: 4,
      name: 'Zona 4 (Umbral)',
      colorClass: 'text-orange-600',
      badgeClass: 'bg-orange-50 text-orange-700 border-orange-300',
    };

    const classes = resolveHeartRateBadgeClasses(zone4);

    assert.match(classes, /bg-orange-50/);
    assert.match(classes, /text-orange-700/);
    assert.match(classes, /border-orange-300/);
    assert.doesNotMatch(classes, /bg-amber-50/);
  });

  await t.test('Applies zone 1 sky blue styling when zoneInfo is Zone 1 (Recuperación)', () => {
    const zone1: HeartRateZoneResult = {
      zone: 1,
      name: 'Zona 1 (Recuperación)',
      colorClass: 'text-sky-600',
      badgeClass: 'bg-sky-50 text-sky-700 border-sky-300',
    };

    const classes = resolveHeartRateBadgeClasses(zone1);

    assert.match(classes, /bg-sky-50/);
    assert.match(classes, /text-sky-700/);
    assert.match(classes, /border-sky-300/);
  });

  await t.test('Applies zone 5 rose red styling when zoneInfo is Zone 5 (Anaeróbico)', () => {
    const zone5: HeartRateZoneResult = {
      zone: 5,
      name: 'Zona 5 (Anaeróbico)',
      colorClass: 'text-rose-600',
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-300 animate-pulse',
    };

    const classes = resolveHeartRateBadgeClasses(zone5);

    assert.match(classes, /bg-rose-50/);
    assert.match(classes, /text-rose-700/);
    assert.match(classes, /border-rose-300/);
    assert.match(classes, /animate-pulse/);
  });

  await t.test('Returns empty string when zoneInfo is null', () => {
    const classes = resolveHeartRateBadgeClasses(null);
    assert.equal(classes, '');
  });
});
