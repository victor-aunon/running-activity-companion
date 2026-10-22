import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEffortZones, resolveHeartRateZone } from '../../src/hooks/useEffortZones.ts';

void test('useEffortZones Unit Tests: Environment parsing and zone resolution', async (t) => {
  await t.test('Parses valid environment variables monotonically', () => {
    const env = {
      NEXT_PUBLIC_ZONE_1_MAX: '135',
      NEXT_PUBLIC_ZONE_2_MAX: '150',
      NEXT_PUBLIC_ZONE_3_MAX: '165',
      NEXT_PUBLIC_ZONE_4_MAX: '180',
      NEXT_PUBLIC_ZONE_5_MAX: '200',
    };

    const config = parseEffortZones(env);
    assert.deepEqual(config, {
      zone1Max: 135,
      zone2Max: 150,
      zone3Max: 165,
      zone4Max: 180,
      zone5Max: 200,
    });
  });

  await t.test(
    'Falls back to default thresholds when env vars are missing, non-numeric, or non-monotonic',
    () => {
      const brokenEnv = {
        NEXT_PUBLIC_ZONE_1_MAX: '160',
        NEXT_PUBLIC_ZONE_2_MAX: '140', // Non-monotonic: z1 > z2!
        NEXT_PUBLIC_ZONE_3_MAX: 'abc', // Non-numeric
      };

      const config = parseEffortZones(brokenEnv);
      assert.deepEqual(config, {
        zone1Max: 130,
        zone2Max: 145,
        zone3Max: 160,
        zone4Max: 175,
        zone5Max: 195,
      });
    },
  );

  await t.test('Resolves heart rate boundaries accurately', () => {
    const config = { zone1Max: 130, zone2Max: 145, zone3Max: 160, zone4Max: 175, zone5Max: 195 };

    assert.equal(resolveHeartRateZone(120, config).zone, 1);
    assert.equal(resolveHeartRateZone(130, config).zone, 1);
    assert.equal(resolveHeartRateZone(131, config).zone, 2);
    assert.equal(resolveHeartRateZone(145, config).zone, 2);
    assert.equal(resolveHeartRateZone(155, config).zone, 3);
    assert.equal(resolveHeartRateZone(170, config).zone, 4);
    assert.equal(resolveHeartRateZone(185, config).zone, 5);
    assert.equal(resolveHeartRateZone(210, config).zone, 5);
  });
});
