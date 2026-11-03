import test from 'node:test';
import assert from 'node:assert/strict';
import {
  renderKilometerMarkers,
} from '../../src/utils/mapMarkers.ts';

void test('renderKilometerMarkers: MapTile Leaflet integration', async (t) => {
  await t.test('Clears existing markers and does not add any markers for sub-kilometer path', () => {
    let cleared = false;
    const addedMarkers: any[] = [];

    const mockLayerGroup = {
      clearLayers: () => {
        cleared = true;
      },
    };

    const mockL = {
      divIcon: (opts: any) => opts,
      marker: (coords: any, opts: any) => ({
        addTo: (layer: any) => {
          addedMarkers.push({ coords, opts, layer });
        },
      }),
    };

    // Sub-kilometer path (< 1000m)
    const shortPath: [number, number][] = [
      [40.41, -3.7038],
      [40.412, -3.7035],
    ];

    const result = renderKilometerMarkers(mockL, mockLayerGroup, shortPath);

    assert.equal(cleared, true);
    assert.equal(addedMarkers.length, 0);
    assert.deepEqual(result, []);
  });

  await t.test('Adds markers for each completed kilometer on multi-kilometer path', () => {
    let cleared = false;
    const addedMarkers: any[] = [];

    const mockLayerGroup = {
      clearLayers: () => {
        cleared = true;
      },
    };

    const mockL = {
      divIcon: (opts: any) => opts,
      marker: (coords: any, opts: any) => ({
        addTo: (layer: any) => {
          addedMarkers.push({ coords, opts, layer });
        },
      }),
    };

    // Straight ~2500m path (deltaLat ~ 0.0225 deg)
    const longPath: [number, number][] = [
      [40.0, 0.0],
      [40.0225, 0.0],
    ];

    const result = renderKilometerMarkers(mockL, mockLayerGroup, longPath);

    assert.equal(cleared, true);
    assert.equal(addedMarkers.length, 2);
    assert.equal(result.length, 2);

    // Verify km 1
    assert.ok(addedMarkers[0].opts.icon.html.includes('>1<'));
    assert.ok(addedMarkers[0].opts.icon.html.includes('#ea580c'));
    assert.ok(addedMarkers[0].opts.icon.html.includes('#ffffff'));
    assert.ok(addedMarkers[0].opts.icon.html.includes('#000000'));
    assert.equal(addedMarkers[0].opts.zIndexOffset, 100);
    assert.equal(addedMarkers[0].opts.title, 'Kilómetro 1');
    assert.equal(addedMarkers[0].opts.alt, 'Punto kilométrico 1');

    // Verify km 2
    assert.ok(addedMarkers[1].opts.icon.html.includes('>2<'));
    assert.ok(addedMarkers[1].opts.icon.html.includes('#ea580c'));
    assert.ok(addedMarkers[1].opts.icon.html.includes('#ffffff'));
    assert.ok(addedMarkers[1].opts.icon.html.includes('#000000'));
    assert.equal(addedMarkers[1].opts.zIndexOffset, 100);
    assert.equal(addedMarkers[1].opts.title, 'Kilómetro 2');
    assert.equal(addedMarkers[1].opts.alt, 'Punto kilométrico 2');
  });

  await t.test('Incremental update avoids DOM thrashing when milestone count does not change', () => {
    let clearCount = 0;
    const layerMarkers: any[] = [];

    const mockLayerGroup = {
      clearLayers: () => {
        clearCount++;
        layerMarkers.length = 0;
      },
      getLayers: () => layerMarkers,
      addLayer: (marker: any) => {
        layerMarkers.push(marker);
      },
    };

    const mockL = {
      divIcon: (opts: any) => opts,
      marker: (coords: any, opts: any) => {
        const m = { coords, opts, addTo: (layer: any) => layer.addLayer(m) };
        return m;
      },
    };

    const path2km: [number, number][] = [
      [40.0, 0.0],
      [40.0225, 0.0], // ~2500m -> 2 markers
    ];

    // First call: renders 2 markers incrementally
    renderKilometerMarkers(mockL, mockLayerGroup, path2km);
    assert.equal(layerMarkers.length, 2);
    assert.equal(clearCount, 0, 'No clearLayers needed on clean initialization');

    // Second call at 1Hz with a tiny GPS advance still within 2km:
    const path2kmPlus10m: [number, number][] = [
      [40.0, 0.0],
      [40.0226, 0.0], // ~2511m -> still 2 markers
    ];
    renderKilometerMarkers(mockL, mockLayerGroup, path2kmPlus10m);

    // Should NOT clear layers or re-create markers
    assert.equal(layerMarkers.length, 2);
    assert.equal(clearCount, 0, 'clearLayers must not be called when milestone count is unchanged');

    // Third call crossing km 3:
    const path3km: [number, number][] = [
      [40.0, 0.0],
      [40.0315, 0.0], // ~3500m -> 3 markers
    ];
    renderKilometerMarkers(mockL, mockLayerGroup, path3km);

    // Only appends the 3rd marker incrementally without wiping previous 2
    assert.equal(layerMarkers.length, 3);
    assert.equal(clearCount, 0, 'clearLayers must not be called when adding an incremental marker');
    assert.equal(layerMarkers[2].opts.title, 'Kilómetro 3');
  });

  await t.test('Rebuilds layer when path shrinks or resets', () => {
    let clearCount = 0;
    const layerMarkers: any[] = [{ km: 1 }, { km: 2 }, { km: 3 }];

    const mockLayerGroup = {
      clearLayers: () => {
        clearCount++;
        layerMarkers.length = 0;
      },
      getLayers: () => layerMarkers,
      addLayer: (m: any) => layerMarkers.push(m),
    };

    const mockL = {
      divIcon: (opts: any) => opts,
      marker: (coords: any, opts: any) => {
        const m = { coords, opts, addTo: (layer: any) => layer.addLayer(m) };
        return m;
      },
    };

    // Path reset to just 1km
    const path1km: [number, number][] = [
      [40.0, 0.0],
      [40.012, 0.0], // ~1300m -> 1 marker
    ];

    renderKilometerMarkers(mockL, mockLayerGroup, path1km);
    assert.equal(clearCount, 1, 'Must clear layers when route resets or shrinks');
    assert.equal(layerMarkers.length, 1);
  });


  await t.test('Safely handles null or undefined L / layerGroup without throwing', () => {
    assert.doesNotThrow(() => {
      const res = renderKilometerMarkers(null, null, [[40.0, 0.0], [40.0225, 0.0]]);
      assert.deepEqual(res, []);
    });
  });
});
