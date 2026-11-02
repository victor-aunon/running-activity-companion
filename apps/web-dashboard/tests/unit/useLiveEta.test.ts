import test from 'node:test';
import assert from 'node:assert/strict';
import { useLiveEta, computeLiveEta } from '../../src/hooks/useLiveEta.ts';

void test('useLiveEta & computeLiveEta: Minute refresh and logic tests', async (t) => {
  await t.test('Exports useLiveEta and computeLiveEta as functions', () => {
    assert.equal(typeof useLiveEta, 'function');
    assert.equal(typeof computeLiveEta, 'function');
  });

  await t.test('computeLiveEta returns --:-- when isCompleted is true', () => {
    const eta = computeLiveEta({
      totalDistanceM: 5000,
      targetDistanceM: 10000,
      paceSecPerKm: 300,
      isCompleted: true,
    });
    assert.equal(eta, '--:--');
  });

  await t.test('computeLiveEta computes exact projected ETA when session is active', () => {
    const fixedNow = new Date(2026, 10, 2, 8, 30, 0).getTime();
    // 6 km de 10 km objetivo -> 4 km restantes
    // Ritmo: 270 s/km (4:30 min/km) -> 4 km * 270 s = 1080 s = 18 minutos
    // ETA esperada: 08:30 + 18m = 08:48
    const eta = computeLiveEta(
      {
        totalDistanceM: 6000,
        targetDistanceM: 10000,
        paceSecPerKm: 270,
        isCompleted: false,
      },
      fixedNow,
    );
    assert.equal(eta, '08:48');
  });

  await t.test('computeLiveEta updates ETA dynamically as current minute advances', () => {
    const t0 = new Date(2026, 10, 2, 8, 30, 0).getTime();
    const t1 = new Date(2026, 10, 2, 8, 31, 0).getTime();

    // Misma distancia y ritmo, pero 1 minuto después en hora_actual
    const etaT0 = computeLiveEta(
      { totalDistanceM: 6000, targetDistanceM: 10000, paceSecPerKm: 270 },
      t0,
    );
    const etaT1 = computeLiveEta(
      { totalDistanceM: 6000, targetDistanceM: 10000, paceSecPerKm: 270 },
      t1,
    );

    assert.equal(etaT0, '08:48');
    assert.equal(etaT1, '08:49');
  });
});
