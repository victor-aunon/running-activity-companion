import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveDashboardRuntimeConfig,
  type DashboardRuntimeConfig,
} from '../../src/utils/runtimeConfig.ts';
import { DEFAULT_EFFORT_ZONES } from '../../src/hooks/useEffortZones.ts';
import { DEFAULT_CADENCE_ZONES } from '../../src/utils/formatters.ts';
import { DEFAULT_NOTIFICATION_THRESHOLDS } from '../../src/hooks/useSpectatorNotificationsLogic.ts';

void test('resolveDashboardRuntimeConfig Unit Tests: Dokploy runtime environment extraction', async (t) => {
  await t.test('Extracts custom Dokploy environment variables into a cohesive runtime config', () => {
    const customEnv: Record<string, string | undefined> = {
      NEXT_PUBLIC_ATHLETE_NAME: 'Víctor Auñón',
      NEXT_PUBLIC_ZONE_1_MAX: '113',
      NEXT_PUBLIC_ZONE_2_MAX: '132',
      NEXT_PUBLIC_ZONE_3_MAX: '152',
      NEXT_PUBLIC_ZONE_4_MAX: '173',
      NEXT_PUBLIC_ZONE_5_MAX: '193',
      NEXT_PUBLIC_CADENCE_LOW_MAX: '148',
      NEXT_PUBLIC_CADENCE_MODERATE_MAX: '162',
      NEXT_PUBLIC_CADENCE_OPTIMAL_MAX: '179',
      NEXT_PUBLIC_NOTIF_EXERTION_HR_BPM: '170',
      NEXT_PUBLIC_NOTIF_EXERTION_COOLDOWN_SEC: '45',
      NEXT_PUBLIC_NOTIF_EXERTION_MAX_CONSECUTIVE: '2',
      NEXT_PUBLIC_NOTIF_SPRINT_HR_BPM: '172',
      NEXT_PUBLIC_NOTIF_SPRINT_CADENCE_SPM: '182',
      NEXT_PUBLIC_NOTIF_SPRINT_FINAL_DISTANCE_M: '1500',
      NEXT_PUBLIC_NOTIF_SPRINT_COOLDOWN_SEC: '20',
      NEXT_PUBLIC_NOTIF_SPRINT_MAX_CONSECUTIVE: '4',
      NEXT_PUBLIC_DEFAULT_LOCALITY: 'Alicante, España',
      NEXT_PUBLIC_TARGET_PACE: '4:15',
      NEXT_PUBLIC_DEFAULT_RACE_DISTANCE_M: '21097',
    };

    const config: DashboardRuntimeConfig = resolveDashboardRuntimeConfig(customEnv);

    assert.equal(config.athleteName, 'Víctor Auñón');
    assert.deepEqual(config.effortZones, {
      zone1Max: 113,
      zone2Max: 132,
      zone3Max: 152,
      zone4Max: 173,
      zone5Max: 193,
    });
    assert.deepEqual(config.cadenceZones, {
      lowMax: 148,
      moderateMax: 162,
      optimalMax: 179,
    });
    assert.deepEqual(config.notificationThresholds, {
      exertion: {
        hrThresholdBpm: 170,
        cooldownMs: 45000,
        maxConsecutive: 2,
      },
      sprint: {
        hrThresholdBpm: 172,
        cadenceThresholdSpm: 182,
        finalPhaseDistanceM: 1500,
        cooldownMs: 20000,
        maxConsecutive: 4,
      },
    });
    assert.equal(config.defaultLocality, 'Alicante, España');
    assert.equal(config.targetPaceSecPerKm, 255);
    assert.equal(config.defaultRaceDistanceM, 21097);
  });

  await t.test('Falls back cleanly to spec defaults when environment is empty or undefined', () => {
    const emptyConfig = resolveDashboardRuntimeConfig({});

    assert.equal(emptyConfig.athleteName, 'Víctor');
    assert.deepEqual(emptyConfig.effortZones, DEFAULT_EFFORT_ZONES);
    assert.deepEqual(emptyConfig.cadenceZones, DEFAULT_CADENCE_ZONES);
    assert.deepEqual(emptyConfig.notificationThresholds, DEFAULT_NOTIFICATION_THRESHOLDS);
    assert.equal(emptyConfig.defaultLocality, 'Madrid, España');
    assert.equal(emptyConfig.targetPaceSecPerKm, 270);
    assert.equal(emptyConfig.defaultRaceDistanceM, 10000);
  });

  await t.test('Reads live process.env when no env argument is provided', () => {
    const originalEnv = { ...process.env };
    try {
      process.env.NEXT_PUBLIC_ATHLETE_NAME = 'Marcos Runner';
      process.env.NEXT_PUBLIC_ZONE_1_MAX = '120';
      process.env.NEXT_PUBLIC_ZONE_2_MAX = '140';
      process.env.NEXT_PUBLIC_ZONE_3_MAX = '160';
      process.env.NEXT_PUBLIC_ZONE_4_MAX = '180';
      process.env.NEXT_PUBLIC_ZONE_5_MAX = '200';

      const config = resolveDashboardRuntimeConfig();
      assert.equal(config.athleteName, 'Marcos Runner');
      assert.equal(config.effortZones.zone1Max, 120);
      assert.equal(config.effortZones.zone5Max, 200);
    } finally {
      process.env = originalEnv;
    }
  });
});
