import type { TelemetrySnapshotPacket } from '@running-support/shared-contracts';

/**
 * Pure domain & geometry helpers for calculating and rendering route kilometer milestones
 */

export interface KilometerMarker {
  km: number;
  lat: number;
  lng: number;
}

export interface KilometerMarkerStyle {
  size?: number;
  borderColor?: string;
  borderWidth?: string;
  backgroundColor?: string;
  textColor?: string;
}

/**
 * Updates the official list of reached kilometer markers according to the watch's official odometry
 * (metrics.totalDistanceM) and timer state (isTimerRunning !== false && elapsedSeconds > 0).
 *
 * Pre-start movements (where isTimerRunning === false or totalDistanceM === 0) never trigger kilometer markers.
 */
export function updateOfficialKilometerMarkers(
  existingMarkers: KilometerMarker[],
  currentTelemetry: TelemetrySnapshotPacket,
  previousTelemetry?: TelemetrySnapshotPacket | null,
): KilometerMarker[] {
  if (!currentTelemetry || !currentTelemetry.metrics || !currentTelemetry.coordinates) {
    return existingMarkers;
  }

  const { totalDistanceM, isTimerRunning, elapsedSeconds } = currentTelemetry.metrics;
  // If timer is explicitly stopped or distance is 0 or elapsed seconds is 0, no kilometer milestone can be credited
  if (isTimerRunning === false || !totalDistanceM || totalDistanceM < 1000 || elapsedSeconds === 0) {
    return existingMarkers;
  }

  const markers = [...existingMarkers];
  let nextKmTarget = (markers.length + 1) * 1000;

  while (totalDistanceM >= nextKmTarget) {
    const kmIndex = markers.length + 1;
    let lat = currentTelemetry.coordinates.lat;
    let lng = currentTelemetry.coordinates.lng;

    // If we have previous telemetry that was below this target, interpolate exact cross point
    if (
      previousTelemetry &&
      previousTelemetry.metrics &&
      previousTelemetry.coordinates &&
      previousTelemetry.metrics.totalDistanceM < nextKmTarget
    ) {
      const d1 = previousTelemetry.metrics.totalDistanceM;
      const d2 = totalDistanceM;
      if (d2 > d1) {
        const ratio = Math.max(0, Math.min(1, (nextKmTarget - d1) / (d2 - d1)));
        lat = previousTelemetry.coordinates.lat + ratio * (lat - previousTelemetry.coordinates.lat);
        lng = previousTelemetry.coordinates.lng + ratio * (lng - previousTelemetry.coordinates.lng);
      }
    }

    markers.push({
      km: kmIndex,
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6)),
    });

    nextKmTarget = (markers.length + 1) * 1000;
  }

  return markers;
}

/**
 * Calculates geodesic distance between two [lat, lng] coordinates in meters using the Haversine formula.
 */
export function haversineDistanceMeters(
  coord1: [number, number],
  coord2: [number, number],
): number {
  const [lat1, lng1] = coord1;
  const [lat2, lng2] = coord2;
  if (lat1 === lat2 && lng1 === lng2) return 0;

  const R = 6371000; // Earth mean radius in meters (WGS-84 standard for sports GPS)
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Given an array of [lat, lng] path coordinates, determines the exact interpolated
 * positions along the route for each completed kilometer (1 km, 2 km, etc.).
 */
export function calculateKilometerMarkers(
  path: [number, number][],
  intervalMeters: number = 1000,
): KilometerMarker[] {
  if (!path || path.length < 2 || intervalMeters <= 0) {
    return [];
  }

  const markers: KilometerMarker[] = [];
  let accumulatedDistance = 0;
  let nextTargetDistance = intervalMeters;
  let kmIndex = 1;

  for (let i = 0; i < path.length - 1; i++) {
    const p1 = path[i];
    const p2 = path[i + 1];
    const segmentDistance = haversineDistanceMeters(p1, p2);

    if (segmentDistance <= 0) {
      continue;
    }

    while (accumulatedDistance + segmentDistance >= nextTargetDistance) {
      const neededFromSegment = nextTargetDistance - accumulatedDistance;
      const ratio = neededFromSegment / segmentDistance;

      const lat = p1[0] + ratio * (p2[0] - p1[0]);
      const lng = p1[1] + ratio * (p2[1] - p1[1]);

      markers.push({
        km: kmIndex,
        lat,
        lng,
      });

      kmIndex++;
      nextTargetDistance += intervalMeters;
    }

    accumulatedDistance += segmentDistance;
  }

  return markers;
}

/**
 * Builds the HTML content for a Leaflet divIcon representing a kilometer circle:
 * Circle over the route, orange border matching route track (#ea580c), white background (#ffffff), black digit (#000000).
 */
export function buildKilometerMarkerHtml(
  km: number,
  style?: KilometerMarkerStyle,
): string {
  const size = style?.size ?? 22;
  const borderColor = style?.borderColor ?? '#ea580c';
  const borderWidth = style?.borderWidth ?? '2.5px';
  const backgroundColor = style?.backgroundColor ?? '#ffffff';
  const textColor = style?.textColor ?? '#000000';
  const fontSize = km >= 100 ? '9px' : '11px';
  const letterSpacing = km >= 100 ? '-0.5px' : 'normal';

  return `<div role="img" aria-label="Kilómetro ${km}" style="box-sizing: border-box; width: ${size}px; height: ${size}px; background: ${backgroundColor}; border: ${borderWidth} solid ${borderColor}; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: ${fontSize}; letter-spacing: ${letterSpacing}; font-weight: 800; font-variant-numeric: tabular-nums; color: ${textColor}; box-shadow: 0 1px 4px rgba(0,0,0,0.25); line-height: 1; user-select: none;">${km}</div>`;
}

/**
 * Creates a Leaflet divIcon configured for a kilometer marker.
 */
export function createKilometerDivIcon(
  L: any,
  km: number,
  style?: KilometerMarkerStyle,
) {
  const size = style?.size ?? 22;
  const anchor = Math.round(size / 2);
  return L.divIcon({
    className: 'custom-km-marker',
    html: buildKilometerMarkerHtml(km, style),
    iconSize: [size, size],
    iconAnchor: [anchor, anchor],
  });
}

/**
 * Renders or updates kilometer markers inside a Leaflet layer group.
 * Performs incremental additions to prevent 1 Hz DOM thrashing, and includes accessible titles and tooltips.
 */
export function renderKilometerMarkers(
  L: any,
  kmMarkersLayer: any,
  pathOrMarkers: [number, number][] | KilometerMarker[],
  style?: KilometerMarkerStyle,
): KilometerMarker[] {
  if (!L || !kmMarkersLayer || typeof kmMarkersLayer.clearLayers !== 'function') {
    return [];
  }

  let markers: KilometerMarker[];
  if (
    Array.isArray(pathOrMarkers) &&
    pathOrMarkers.length > 0 &&
    typeof pathOrMarkers[0] === 'object' &&
    !Array.isArray(pathOrMarkers[0]) &&
    'km' in (pathOrMarkers[0] as any)
  ) {
    markers = pathOrMarkers as KilometerMarker[];
  } else {
    markers = calculateKilometerMarkers(pathOrMarkers as [number, number][]);
  }
  const existingLayers: any[] | null =
    typeof kmMarkersLayer.getLayers === 'function' ? kmMarkersLayer.getLayers() : null;

  if (existingLayers) {
    if (existingLayers.length === markers.length) {
      return markers;
    }

    if (existingLayers.length > markers.length) {
      kmMarkersLayer.clearLayers();
      for (const m of markers) {
        const icon = createKilometerDivIcon(L, m.km, style);
        L.marker([m.lat, m.lng], {
          icon,
          zIndexOffset: 100,
          title: `Kilómetro ${m.km}`,
          alt: `Punto kilométrico ${m.km}`,
        }).addTo(kmMarkersLayer);
      }
      return markers;
    }

    // Incremental: only append newly reached milestones
    const newMarkers = markers.slice(existingLayers.length);
    for (const m of newMarkers) {
      const icon = createKilometerDivIcon(L, m.km, style);
      L.marker([m.lat, m.lng], {
        icon,
        zIndexOffset: 100,
        title: `Kilómetro ${m.km}`,
        alt: `Punto kilométrico ${m.km}`,
      }).addTo(kmMarkersLayer);
    }
    return markers;
  }

  // Fallback when layer group does not expose getLayers()
  kmMarkersLayer.clearLayers();
  for (const m of markers) {
    const icon = createKilometerDivIcon(L, m.km, style);
    L.marker([m.lat, m.lng], {
      icon,
      zIndexOffset: 100,
      title: `Kilómetro ${m.km}`,
      alt: `Punto kilométrico ${m.km}`,
    }).addTo(kmMarkersLayer);
  }

  return markers;
}


