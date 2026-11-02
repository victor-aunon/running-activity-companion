import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseEffortZones,
  resolveHeartRateZone,
  resolveMaxHeartRate,
} from '../../src/hooks/useEffortZones.ts';

void test('useEffortZones Unit Tests: Environment parsing and zone resolution', async (t) => {
  await t.test(
    'resolveMaxHeartRate resolves NEXT_PUBLIC_ZONE_5_MAX or falls back to zone 5 max',
    () => {
      assert.equal(resolveMaxHeartRate({ NEXT_PUBLIC_ZONE_5_MAX: '202' }), 202);
      assert.equal(resolveMaxHeartRate({ NEXT_PUBLIC_ZONE_5_MAX: '190' }), 190);
      assert.equal(resolveMaxHeartRate({ NEXT_PUBLIC_ZONE_5_MAX: '' }), 195);
      assert.equal(resolveMaxHeartRate({ NEXT_PUBLIC_ZONE_5_MAX: 'invalid' }), 195);
      assert.equal(
        resolveMaxHeartRate(
          {},
          { zone1Max: 120, zone2Max: 140, zone3Max: 160, zone4Max: 180, zone5Max: 198 },
        ),
        198,
      );
    },
  );
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

  await t.test(
    'Resolves user custom zones correctly (113, 132, 152, 173, 193) where 155 bpm is Zone 4',
    () => {
      const userEnv = {
        NEXT_PUBLIC_ZONE_1_MAX: '113',
        NEXT_PUBLIC_ZONE_2_MAX: '132',
        NEXT_PUBLIC_ZONE_3_MAX: '152',
        NEXT_PUBLIC_ZONE_4_MAX: '173',
        NEXT_PUBLIC_ZONE_5_MAX: '193',
      };
      const config = parseEffortZones(userEnv);
      assert.deepEqual(config, {
        zone1Max: 113,
        zone2Max: 132,
        zone3Max: 152,
        zone4Max: 173,
        zone5Max: 193,
      });

      const zoneInfo = resolveHeartRateZone(155, config);
      assert.equal(zoneInfo.zone, 4);
      assert.equal(zoneInfo.name, 'Zona 4 (Umbral)');

      const maxHr = resolveMaxHeartRate(userEnv, config);
      assert.equal(maxHr, 193);
    },
  );

  await t.test(
    'parseEffortZones and resolveMaxHeartRate default parameters read process.env without arguments',
    () => {
      const originalEnv = { ...process.env };
      try {
        process.env.NEXT_PUBLIC_ZONE_1_MAX = '113';
        process.env.NEXT_PUBLIC_ZONE_2_MAX = '132';
        process.env.NEXT_PUBLIC_ZONE_3_MAX = '152';
        process.env.NEXT_PUBLIC_ZONE_4_MAX = '173';
        process.env.NEXT_PUBLIC_ZONE_5_MAX = '193';

        const config = parseEffortZones();
        assert.deepEqual(config, {
          zone1Max: 113,
          zone2Max: 132,
          zone3Max: 152,
          zone4Max: 173,
          zone5Max: 193,
        });

        const maxHr = resolveMaxHeartRate();
        assert.equal(maxHr, 193);
      } finally {
        process.env = originalEnv;
      }
    },
  );
});
