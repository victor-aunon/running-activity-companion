import test from 'node:test';
import assert from 'node:assert/strict';
import {
  haversineDistanceMeters,
  calculateKilometerMarkers,
  buildKilometerMarkerHtml,
  updateOfficialKilometerMarkers,
  renderKilometerMarkers,
  type KilometerMarker,
} from '../../src/utils/mapMarkers.ts';
import type { TelemetrySnapshotPacket } from '@running-support/shared-contracts';

void test('haversineDistanceMeters: Geodesic distance calculation', async (t) => {
  await t.test('Returns 0 for identical coordinates', () => {
    const dist = haversineDistanceMeters([40.4168, -3.7038], [40.4168, -3.7038]);
    assert.equal(dist, 0);
  });

  await t.test('Calculates expected distance along latitude meridian', () => {
    // 1 degree latitude is approx 111.195 km with R=6371000m
    const dist = haversineDistanceMeters([40.0, 0.0], [41.0, 0.0]);
    assert.ok(dist > 111000 && dist < 112000, `Expected ~111km, got ${dist}`);
  });

  await t.test('Calculates expected distance between Puerta del Sol and Plaza de Cibeles in Madrid', () => {
    const sol: [number, number] = [40.4169, -3.7036];
    const cibeles: [number, number] = [40.4196, -3.6931];
    const dist = haversineDistanceMeters(sol, cibeles);
    // Sol to Cibeles is approx 940m - 980m
    assert.ok(dist >= 900 && dist <= 1100, `Expected ~950m, got ${dist}`);
  });
});

void test('calculateKilometerMarkers: Route kilometer milestones determination', async (t) => {
  await t.test('Returns empty array for empty path or single coordinate', () => {
    assert.deepEqual(calculateKilometerMarkers([]), []);
    assert.deepEqual(calculateKilometerMarkers([[40.4168, -3.7038]]), []);
  });

  await t.test('Returns empty array if total route distance is less than 1000m', () => {
    // ~500m path
    const p1: [number, number] = [40.0, 0.0];
    const p2: [number, number] = [40.0045, 0.0]; // ~500m
    const markers = calculateKilometerMarkers([p1, p2]);
    assert.deepEqual(markers, []);
  });

  await t.test('Generates exactly 1 marker for a 1500m path and positions it at 1000m', () => {
    // Segment of ~2000m along North meridian: deltaLat ~ 0.0179955 degrees
    const p1: [number, number] = [40.0, 0.0];
    const p2: [number, number] = [40.0179955, 0.0]; // ~2000m

    const markers = calculateKilometerMarkers([p1, p2]);
    assert.equal(markers.length, 2);
    assert.equal(markers[0].km, 1);
    assert.equal(markers[1].km, 2);

    // Marker 1 should be halfway (1000m of 2000m)
    assert.ok(Math.abs(markers[0].lat - 40.0089977) < 0.0001);
    assert.equal(markers[0].lng, 0.0);
  });

  await t.test('Handles multi-segment path crossing multiple kilometers', () => {
    // 3 segments of 600m each = 1800m total
    // Segment 1: [40.0, 0.0] -> [40.0054, 0.0] (~600m)
    // Segment 2: [40.0054, 0.0] -> [40.0108, 0.0] (~600m, cum = 1200m -> km 1 crossed!)
    // Segment 3: [40.0108, 0.0] -> [40.0162, 0.0] (~600m, cum = 1800m)
    const path: [number, number][] = [
      [40.0, 0.0],
      [40.0054, 0.0],
      [40.0108, 0.0],
      [40.0162, 0.0],
    ];

    const markers = calculateKilometerMarkers(path);
    assert.equal(markers.length, 1);
    assert.equal(markers[0].km, 1);
    // km 1 (1000m) should be on segment 2, between 600m and 1200m
    assert.ok(markers[0].lat > 40.0054 && markers[0].lat < 40.0108);
  });

  await t.test('Safely handles consecutive identical points without infinite loop or NaN', () => {
    const path: [number, number][] = [
      [40.0, 0.0],
      [40.0, 0.0], // duplicate
      [40.0179955, 0.0], // ~2000m
      [40.0179955, 0.0], // duplicate
    ];

    const markers = calculateKilometerMarkers(path);
    assert.equal(markers.length, 2);
    assert.equal(markers[0].km, 1);
    assert.equal(markers[1].km, 2);
    assert.ok(!isNaN(markers[0].lat) && !isNaN(markers[0].lng));
  });

  await t.test('Supports custom interval in meters if needed', () => {
    // Interval of 500m along ~2000m route
    const p1: [number, number] = [40.0, 0.0];
    const p2: [number, number] = [40.0179955, 0.0];
    const markers = calculateKilometerMarkers([p1, p2], 500);
    assert.equal(markers.length, 4);
    assert.equal(markers[0].km, 1); // 500m
    assert.equal(markers[1].km, 2); // 1000m
    assert.equal(markers[2].km, 3); // 1500m
    assert.equal(markers[3].km, 4); // 2000m
  });
});

void test('buildKilometerMarkerHtml: Visual presentation contract', async (t) => {
  await t.test('Renders circular badge with orange border, white background and black digit', () => {
    const html = buildKilometerMarkerHtml(5);

    // Digit 5 present
    assert.ok(html.includes('>5<'), 'HTML must contain the kilometer digit "5"');

    // Orange border matching route polyline (#ea580c)
    assert.ok(
      html.includes('#ea580c') || html.includes('rgb(234, 88, 12)'),
      'HTML must have orange border (#ea580c)',
    );
    assert.ok(html.includes('border'), 'HTML must specify a border');

    // White background
    assert.ok(
      html.includes('#ffffff') || html.includes('white') || html.includes('rgb(255, 255, 255)'),
      'HTML must have white background',
    );

    // Black digit
    assert.ok(
      html.includes('#000000') || html.includes('black') || html.includes('rgb(0, 0, 0)'),
      'HTML must have black text color',
    );

    // Circle shape (border-radius: 50%)
    assert.ok(html.includes('border-radius: 50%'), 'HTML must have circular shape (50%)');

    // Box-sizing border-box to ensure exact 22px boundary
    assert.ok(html.includes('box-sizing: border-box'), 'HTML must specify box-sizing: border-box');

    // Accessibility attributes
    assert.ok(html.includes('aria-label="Kilómetro 5"'), 'HTML must have aria-label');
    assert.ok(html.includes('role="img"'), 'HTML must have role="img"');
  });

  await t.test('Renders multiple digits (e.g. km 10, km 21, km 42, km 100) cleanly', () => {
    const html21 = buildKilometerMarkerHtml(21);
    assert.ok(html21.includes('>21<'));

    // Ultra-marathon: 100 km should adjust font size to avoid border clipping
    const html100 = buildKilometerMarkerHtml(100);
    assert.ok(html100.includes('>100<'));
    assert.ok(html100.includes('font-size: 9px'));
  });

  await t.test('Applies custom style overrides if specified', () => {
    const html = buildKilometerMarkerHtml(3, {
      borderColor: '#f97316',
      backgroundColor: '#f8fafc',
      textColor: '#111827',
      size: 24,
    });

    assert.ok(html.includes('#f97316'));
    assert.ok(html.includes('#f8fafc'));
    assert.ok(html.includes('#111827'));
    assert.ok(html.includes('24px'));
  });
});

void test('updateOfficialKilometerMarkers: Official watch odometry kilometer markers', async (t) => {
  const createSnap = (
    totalDistanceM: number,
    isTimerRunning: boolean,
    lat: number,
    lng: number,
  ): TelemetrySnapshotPacket => ({
    type: 'TELEMETRY_SNAPSHOT',
    sessionId: 'test-session',
    seq: 1,
    timestamp: Date.now(),
    coordinates: { lat, lng, elevationM: 650, gpsQuality: 4 },
    metrics: {
      heartRateBpm: 150,
      speedMps: 3.5,
      paceSecPerKm: 285,
      cadenceSpm: 175,
      totalDistanceM,
      elapsedSeconds: isTimerRunning ? 100 : 0,
      isTimerRunning,
    },
  });

  await t.test('Does NOT add any markers when isTimerRunning is false or totalDistanceM is 0 (pre-start)', () => {
    // Runner is moving 1500m before pressing start
    const snapPreStart = createSnap(0.0, false, 40.42, -3.71);
    const markers = updateOfficialKilometerMarkers([], snapPreStart);
    assert.deepEqual(markers, []);
  });

  await t.test('Does NOT add marker when active distance is under 1000m', () => {
    const snap500m = createSnap(500.0, true, 40.425, -3.715);
    const markers = updateOfficialKilometerMarkers([], snap500m);
    assert.deepEqual(markers, []);
  });

  await t.test('Adds km 1 marker when totalDistanceM reaches or crosses 1000m', () => {
    const prevSnap = createSnap(980.0, true, 40.429, -3.719);
    const currSnap = createSnap(1020.0, true, 40.431, -3.721);

    const markers = updateOfficialKilometerMarkers([], currSnap, prevSnap);
    assert.equal(markers.length, 1);
    assert.equal(markers[0].km, 1);
    // Interpolated lat should be exactly halfway between 40.429 and 40.431 -> 40.430
    assert.ok(Math.abs(markers[0].lat - 40.43) < 0.0001);
    assert.ok(Math.abs(markers[0].lng - -3.72) < 0.0001);
  });

  await t.test('Does not duplicate existing markers on subsequent snapshots', () => {
    const existing: KilometerMarker[] = [{ km: 1, lat: 40.43, lng: -3.72 }];
    const currSnap = createSnap(1200.0, true, 40.435, -3.725);

    const markers = updateOfficialKilometerMarkers(existing, currSnap);
    assert.equal(markers.length, 1);
    assert.equal(markers[0].km, 1);
  });

  await t.test('Adds km 2 marker when totalDistanceM reaches 2000m', () => {
    const existing: KilometerMarker[] = [{ km: 1, lat: 40.43, lng: -3.72 }];
    const currSnap = createSnap(2050.0, true, 40.445, -3.735);

    const markers = updateOfficialKilometerMarkers(existing, currSnap);
    assert.equal(markers.length, 2);
    assert.equal(markers[1].km, 2);
    assert.equal(markers[1].lat, 40.445);
    assert.equal(markers[1].lng, -3.735);
  });
});

