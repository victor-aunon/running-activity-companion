import test from 'node:test';
import assert from 'node:assert/strict';
import { isTelemetrySnapshotPacket } from '@running-support/shared-contracts';

void test('Telemetry Contract Test: 1 Hz telemetry packet serialization & validation', async (t) => {
  await t.test('Valid telemetry snapshot satisfies schema contract', () => {
    const validPacket = {
      type: 'TELEMETRY_SNAPSHOT',
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      seq: 42,
      timestamp: Date.now(),
      coordinates: {
        lat: 40.4168,
        lng: -3.7038,
        elevationM: 650.5,
        gpsQuality: 4,
      },
      metrics: {
        heartRateBpm: 156,
        speedMps: 3.65,
        paceSecPerKm: 274.0,
        cadenceSpm: 178,
        stepCount: 2450,
        totalDistanceM: 1250.0,
        elapsedSeconds: 342,
      },
      deviceHealth: {
        watchBatteryPct: 85,
        phoneBatteryPct: 70,
        bleRssi: -60,
      },
    };

    assert.equal(isTelemetrySnapshotPacket(validPacket), true);
  });

  await t.test('Rejects invalid or incomplete telemetry packet', () => {
    const invalidPacket = {
      type: 'TELEMETRY_SNAPSHOT',
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      seq: 42,
      // Missing coordinates and metrics!
    };

    assert.equal(isTelemetrySnapshotPacket(invalidPacket), false);
  });
});
