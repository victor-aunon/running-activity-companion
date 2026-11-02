import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDynamicEta } from '../../src/utils/formatters.ts';

void test('calculateDynamicEta: Formula ETA = hora_actual + (pace * distancia_restante)', async (t) => {
  await t.test('Calculates exact ETA given paceSecPerKm, remaining distance, and fixed nowMs', () => {
    // 2026-11-02 10:00:00 local time
    const fixedNow = new Date(2026, 10, 2, 10, 0, 0).getTime();

    // 5 km recorridos de 10 km objetivo -> 5 km restantes
    // Ritmo: 300 s/km (5:00 min/km) -> 5 km * 300 s = 1500 s = 25 minutos
    // ETA esperada: 10:25
    const eta = calculateDynamicEta({
      totalDistanceM: 5000,
      targetDistanceM: 10000,
      paceSecPerKm: 300,
      nowMs: fixedNow,
    });

    assert.equal(eta, '10:25');
  });

  await t.test('Calculates ETA crossing into the next hour correctly', () => {
    // 2026-11-02 10:45:00 local time
    const fixedNow = new Date(2026, 10, 2, 10, 45, 0).getTime();

    // 10 km recorridos de 21097 m objetivo -> 11097 m restantes (11.097 km)
    // Ritmo: 240 s/km (4:00 min/km) -> 11.097 * 240 = 2663.28 s (~44.38 min)
    // 10:45 + 44m23s -> 11:29
    const eta = calculateDynamicEta({
      totalDistanceM: 10000,
      targetDistanceM: 21097,
      paceSecPerKm: 240,
      nowMs: fixedNow,
    });

    assert.equal(eta, '11:29');
  });

  await t.test('Falls back to speedMps when paceSecPerKm is not provided', () => {
    const fixedNow = new Date(2026, 10, 2, 10, 0, 0).getTime();

    // 5 km restantes a 2.5 m/s (400 s/km) -> 2000 s = 33m 20s
    // ETA: 10:33
    const eta = calculateDynamicEta({
      totalDistanceM: 5000,
      targetDistanceM: 10000,
      speedMps: 2.5,
      nowMs: fixedNow,
    });

    assert.equal(eta, '10:33');
  });

  await t.test('Returns --:-- when totalDistanceM is zero or missing', () => {
    assert.equal(calculateDynamicEta({ totalDistanceM: 0, targetDistanceM: 10000, paceSecPerKm: 300 }), '--:--');
    assert.equal(calculateDynamicEta({ totalDistanceM: null, targetDistanceM: 10000, paceSecPerKm: 300 }), '--:--');
  });

  await t.test('Returns --:-- when runner has reached or exceeded target distance', () => {
    assert.equal(calculateDynamicEta({ totalDistanceM: 10000, targetDistanceM: 10000, paceSecPerKm: 300 }), '--:--');
    assert.equal(calculateDynamicEta({ totalDistanceM: 10500, targetDistanceM: 10000, paceSecPerKm: 300 }), '--:--');
  });

  await t.test('Returns --:-- when runner is stopped (zero pace and zero/low speed)', () => {
    assert.equal(calculateDynamicEta({ totalDistanceM: 5000, targetDistanceM: 10000, paceSecPerKm: 0, speedMps: 0 }), '--:--');
    assert.equal(calculateDynamicEta({ totalDistanceM: 5000, targetDistanceM: 10000, speedMps: 0.3 }), '--:--');
  });

  await t.test('Maintains backwards compatibility with positional arguments', () => {
    const eta = calculateDynamicEta(10420, 3.65, 21097);
    assert.match(eta, /^\d{2}:\d{2}$/);
  });
});
