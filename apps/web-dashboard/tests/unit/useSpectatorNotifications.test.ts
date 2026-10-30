import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveTotalRaceDistance,
  evaluateDistanceMilestones,
  evaluateExertionState,
  evaluateSprintState,
  evaluateAllNotifications,
  parseNotificationThresholds,
  DEFAULT_NOTIFICATION_THRESHOLDS,
  INITIAL_NOTIFICATION_ENGINE_STATE,
  type ExertionTrackerState,
  type SprintTrackerState,
  type ExertionThresholdConfig,
  type SprintThresholdConfig,
} from '../../src/hooks/useSpectatorNotificationsLogic.ts';

void test('useSpectatorNotifications: Notification thresholds environment parsing', async (t) => {
  await t.test('Returns DEFAULT_NOTIFICATION_THRESHOLDS when env is empty or undefined', () => {
    const config = parseNotificationThresholds({});
    assert.deepEqual(config, DEFAULT_NOTIFICATION_THRESHOLDS);
  });

  await t.test('Parses custom environment variables accurately', () => {
    const customEnv: Record<string, string> = {
      NEXT_PUBLIC_NOTIF_EXERTION_HR_BPM: '168',
      NEXT_PUBLIC_NOTIF_EXERTION_COOLDOWN_SEC: '20',
      NEXT_PUBLIC_NOTIF_EXERTION_MAX_CONSECUTIVE: '2',
      NEXT_PUBLIC_NOTIF_SPRINT_HR_BPM: '170',
      NEXT_PUBLIC_NOTIF_SPRINT_CADENCE_SPM: '190',
      NEXT_PUBLIC_NOTIF_SPRINT_FINAL_DISTANCE_M: '1500',
      NEXT_PUBLIC_NOTIF_SPRINT_COOLDOWN_SEC: '25',
      NEXT_PUBLIC_NOTIF_SPRINT_MAX_CONSECUTIVE: '4',
    };

    const config = parseNotificationThresholds(customEnv);
    assert.equal(config.exertion.hrThresholdBpm, 168);
    assert.equal(config.exertion.cooldownMs, 20000);
    assert.equal(config.exertion.maxConsecutive, 2);
    assert.equal(config.sprint.hrThresholdBpm, 170);
    assert.equal(config.sprint.cadenceThresholdSpm, 190);
    assert.equal(config.sprint.finalPhaseDistanceM, 1500);
    assert.equal(config.sprint.cooldownMs, 25000);
    assert.equal(config.sprint.maxConsecutive, 4);
  });

  await t.test('Falls back gracefully on invalid, negative, or NaN values', () => {
    const badEnv: Record<string, string> = {
      NEXT_PUBLIC_NOTIF_EXERTION_HR_BPM: '-10',
      NEXT_PUBLIC_NOTIF_EXERTION_COOLDOWN_SEC: 'invalid',
      NEXT_PUBLIC_NOTIF_SPRINT_CADENCE_SPM: '0',
    };

    const config = parseNotificationThresholds(badEnv);
    assert.equal(config.exertion.hrThresholdBpm, 175);
    assert.equal(config.exertion.cooldownMs, 30000);
    assert.equal(config.sprint.cadenceThresholdSpm, 180);
  });

  await t.test(
    'Falls back to NEXT_PUBLIC_ZONE_4_MAX for exertion HR when set and exertion HR is missing',
    () => {
      const zoneEnv: Record<string, string> = {
        NEXT_PUBLIC_ZONE_4_MAX: '172',
      };
      const config = parseNotificationThresholds(zoneEnv);
      assert.equal(config.exertion.hrThresholdBpm, 172);
    },
  );
});

void test('useSpectatorNotifications: Effective distance resolution', async (t) => {
  await t.test('Prefers metrics.totalRaceDistanceM when provided', () => {
    assert.equal(resolveTotalRaceDistance(21097, '10000'), 21097);
  });

  await t.test('Falls back to environment variable or 10000m default', () => {
    assert.equal(resolveTotalRaceDistance(undefined, '42195'), 42195);
    assert.equal(resolveTotalRaceDistance(undefined, undefined), 10000);
    assert.equal(resolveTotalRaceDistance(0, 'invalid'), 10000);
  });
});

void test('useSpectatorNotifications: Distance milestones evaluation', async (t) => {
  const totalM = 10000;
  const athlete = 'Víctor';

  await t.test('Triggers 25%, 50%, and 75% milestones sequentially as distance progresses', () => {
    let reported = new Set<string>();

    const r1 = evaluateDistanceMilestones(2600, totalM, reported, {
      athleteName: athlete,
      isInitialSnapshot: false,
    });
    assert.equal(r1.newMilestones.length, 1);
    assert.equal(r1.newMilestones[0].type, 'MILESTONE_25');
    reported = r1.updatedReported;

    const r2 = evaluateDistanceMilestones(5100, totalM, reported, {
      athleteName: athlete,
      isInitialSnapshot: false,
    });
    assert.equal(r2.newMilestones.length, 1);
    assert.equal(r2.newMilestones[0].type, 'MILESTONE_50');
    reported = r2.updatedReported;

    const r3 = evaluateDistanceMilestones(7600, totalM, reported, {
      athleteName: athlete,
      isInitialSnapshot: false,
    });
    assert.equal(r3.newMilestones.length, 1);
    assert.equal(r3.newMilestones[0].type, 'MILESTONE_75');
  });

  await t.test('Late joiner suppression: suppresses prior milestones on initial snapshot', () => {
    const reported = new Set<string>();
    const res = evaluateDistanceMilestones(6000, totalM, reported, {
      athleteName: athlete,
      isInitialSnapshot: true,
    });
    assert.equal(res.newMilestones.length, 0, 'No snackbars for surpassed milestones on load');
    assert.equal(res.updatedReported.has('MILESTONE_25'), true);
    assert.equal(res.updatedReported.has('MILESTONE_50'), true);
    assert.equal(res.updatedReported.has('MILESTONE_75'), false);
  });
});

void test('useSpectatorNotifications: Exertion alert cadence and caps', () => {
  const athlete = 'Víctor';
  const threshold = 185;
  let state: ExertionTrackerState = { consecutiveCount: 0, lastAlertTime: 0 };
  const baseTime = 100000;

  // 1st alert
  let result = evaluateExertionState(188, threshold, state, {
    now: baseTime,
    athleteName: athlete,
  });
  assert.notEqual(result.notification, null);
  assert.equal(result.notification?.type, 'EXERTION');
  assert.equal(result.nextState.consecutiveCount, 1);
  state = result.nextState;

  // 15 seconds later (cooldown active) -> no notification
  result = evaluateExertionState(189, threshold, state, {
    now: baseTime + 15000,
    athleteName: athlete,
  });
  assert.equal(result.notification, null);
  assert.equal(result.nextState.consecutiveCount, 1);

  // 31 seconds later (cooldown expired) -> 2nd alert
  result = evaluateExertionState(189, threshold, state, {
    now: baseTime + 31000,
    athleteName: athlete,
  });
  assert.notEqual(result.notification, null);
  assert.equal(result.nextState.consecutiveCount, 2);
  state = result.nextState;

  // 62 seconds later -> 3rd alert
  result = evaluateExertionState(190, threshold, state, {
    now: baseTime + 62000,
    athleteName: athlete,
  });
  assert.notEqual(result.notification, null);
  assert.equal(result.nextState.consecutiveCount, 3);
  state = result.nextState;

  // 95 seconds later (3-consecutive cap reached) -> suppressed
  result = evaluateExertionState(191, threshold, state, {
    now: baseTime + 95000,
    athleteName: athlete,
  });
  assert.equal(result.notification, null);
  assert.equal(result.nextState.consecutiveCount, 3);
});

void test('useSpectatorNotifications: Exertion normalization and custom threshold', () => {
  const athlete = 'Víctor';
  const threshold = 185;
  const state: ExertionTrackerState = { consecutiveCount: 2, lastAlertTime: 100000 };

  // Heart rate drops to 160 bpm
  const result = evaluateExertionState(160, threshold, state, {
    now: 220000,
    athleteName: athlete,
  });
  assert.equal(result.notification, null);
  assert.equal(result.nextState.consecutiveCount, 0, 'Consecutive counter must reset to 0');

  const customConfig: ExertionThresholdConfig = {
    hrThresholdBpm: 165,
    cooldownMs: 15000,
    maxConsecutive: 2,
  };
  let localState: ExertionTrackerState = { consecutiveCount: 0, lastAlertTime: 0 };
  const customBaseTime = 500000;

  let res = evaluateExertionState(168, customConfig, localState, {
    now: customBaseTime,
    athleteName: athlete,
  });
  assert.notEqual(res.notification, null);
  assert.equal(res.nextState.consecutiveCount, 1);
  localState = res.nextState;

  res = evaluateExertionState(169, customConfig, localState, {
    now: customBaseTime + 16000,
    athleteName: athlete,
  });
  assert.notEqual(res.notification, null);
  assert.equal(res.nextState.consecutiveCount, 2);
  localState = res.nextState;

  res = evaluateExertionState(170, customConfig, localState, {
    now: customBaseTime + 35000,
    athleteName: athlete,
  });
  assert.equal(res.notification, null);
});

void test('useSpectatorNotifications: Sprint alert triggers and final phase', () => {
  const athlete = 'Víctor';
  const baseTime = 200000;
  const state: SprintTrackerState = {
    consecutiveCount: 0,
    lastAlertTime: 0,
    finalPhaseTriggered: false,
  };

  // Standard phase (remaining = 5000m >= 2000m)
  const result = evaluateSprintState(
    { heartRateBpm: 182, cadenceSpm: 185, remainingDistanceM: 5000 },
    state,
    { now: baseTime, athleteName: athlete },
  );
  assert.notEqual(result.notification, null);
  assert.equal(result.notification?.type, 'SPRINT');
  assert.equal(result.notification?.cta?.action, 'SCROLL_CHEER_WALL');
  assert.equal(result.notification?.cta?.presetId, 'MUCHO_ANIMO');
  assert.equal(result.nextState.consecutiveCount, 1);

  let finalState: SprintTrackerState = {
    consecutiveCount: 0,
    lastAlertTime: 0,
    finalPhaseTriggered: false,
  };

  // Remaining 1500m (< 2000m)
  let rFinal = evaluateSprintState(
    { heartRateBpm: 186, cadenceSpm: 192, remainingDistanceM: 1500 },
    finalState,
    { now: baseTime + 60000, athleteName: athlete },
  );
  assert.notEqual(rFinal.notification, null);
  assert.equal(rFinal.notification?.type, 'SPRINT');
  assert.equal(rFinal.nextState.finalPhaseTriggered, true);
  finalState = rFinal.nextState;

  // 40 seconds later, still sprinting in final phase -> suppressed by finalPhaseTriggered
  rFinal = evaluateSprintState(
    { heartRateBpm: 188, cadenceSpm: 195, remainingDistanceM: 1200 },
    finalState,
    { now: baseTime + 100000, athleteName: athlete },
  );
  assert.equal(rFinal.notification, null, 'Must only trigger one sprint alert in final phase');
});

void test('useSpectatorNotifications: Sprint custom config and mutual exclusion', () => {
  const athlete = 'Víctor';
  const customSprintConfig: SprintThresholdConfig = {
    hrThresholdBpm: 160,
    cadenceThresholdSpm: 170,
    finalPhaseDistanceM: 3000,
    cooldownMs: 10000,
    maxConsecutive: 2,
  };
  const localSprintState: SprintTrackerState = {
    consecutiveCount: 0,
    lastAlertTime: 0,
    finalPhaseTriggered: false,
  };

  const res = evaluateSprintState(
    { heartRateBpm: 165, cadenceSpm: 175, remainingDistanceM: 2500 },
    localSprintState,
    { now: 200000, athleteName: athlete },
    customSprintConfig,
  );
  assert.notEqual(res.notification, null, 'Should trigger with custom sprint thresholds');
  assert.equal(res.nextState.finalPhaseTriggered, true);
});

void test('useSpectatorNotifications: Mutual exclusion suppresses exertion during sprint', () => {
  const athlete = 'Víctor';
  const now = 300000;
  const engine = {
    ...INITIAL_NOTIFICATION_ENGINE_STATE,
    hasProcessedInitialSnapshot: true,
    reportedMilestones: new Set<string>(['MILESTONE_25', 'MILESTONE_50', 'MILESTONE_75']),
  };

  const telemetry = {
    type: 'TELEMETRY_SNAPSHOT' as const,
    sessionId: 'sess-test',
    seq: 100,
    timestamp: now,
    coordinates: { lat: 38.345, lng: -0.481, elevationM: 10, gpsQuality: 4 },
    metrics: {
      heartRateBpm: 188,
      cadenceSpm: 195,
      totalDistanceM: 8000,
      totalRaceDistanceM: 10000,
      speedMps: 4.2,
      paceSecPerKm: 238,
      elapsedSeconds: 1900,
    },
  };

  const { newAlerts } = evaluateAllNotifications(
    telemetry,
    engine,
    DEFAULT_NOTIFICATION_THRESHOLDS,
    { athleteName: athlete, now },
  );

  const hasSprint = newAlerts.some((a) => a.type === 'SPRINT');
  const hasExertion = newAlerts.some((a) => a.type === 'EXERTION');

  assert.equal(hasSprint, true, 'Sprint notification must be emitted');
  assert.equal(hasExertion, false, 'Exertion notification must be suppressed during sprint');
  assert.equal(newAlerts.length, 1, 'Only one alert (SPRINT) should be emitted');
});

void test('useSpectatorNotifications: Mutual exclusion allows exertion when not sprinting', () => {
  const athlete = 'Víctor';
  const now = 300000;
  const engine = {
    ...INITIAL_NOTIFICATION_ENGINE_STATE,
    hasProcessedInitialSnapshot: true,
    reportedMilestones: new Set<string>(['MILESTONE_25', 'MILESTONE_50', 'MILESTONE_75']),
  };

  const telemetry = {
    type: 'TELEMETRY_SNAPSHOT' as const,
    sessionId: 'sess-test',
    seq: 101,
    timestamp: now,
    coordinates: { lat: 38.345, lng: -0.481, elevationM: 10, gpsQuality: 4 },
    metrics: {
      heartRateBpm: 186,
      cadenceSpm: 165,
      totalDistanceM: 8000,
      totalRaceDistanceM: 10000,
      speedMps: 3.5,
      paceSecPerKm: 285,
      elapsedSeconds: 1950,
    },
  };

  const { newAlerts } = evaluateAllNotifications(
    telemetry,
    engine,
    DEFAULT_NOTIFICATION_THRESHOLDS,
    { athleteName: athlete, now },
  );

  const hasSprint = newAlerts.some((a) => a.type === 'SPRINT');
  const hasExertion = newAlerts.some((a) => a.type === 'EXERTION');

  assert.equal(hasSprint, false, 'Sprint notification must not be emitted when cadence is normal');
  assert.equal(hasExertion, true, 'Exertion notification must be emitted when cadence is normal');
  assert.equal(newAlerts.length, 1, 'Only EXERTION alert should be emitted');
});
