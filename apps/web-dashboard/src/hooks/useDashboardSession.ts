import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLiveTelemetry } from './useLiveTelemetry';
import { useEffortZones } from './useEffortZones';
import { useSpectatorCheer } from './useSpectatorCheer';
import { useLiveEta } from './useLiveEta';
import { useGpsLocality } from './useGpsLocality';
import { useNowPlaying } from './useNowPlaying';
import { useSpectatorNotifications } from './useSpectatorNotifications';
import { resolveTotalRaceDistance } from './useSpectatorNotificationsLogic';
import { getRequiredAthleteName } from '../utils/athlete';
import { formatElevationProfile } from '../utils/formatters';
import { MOCK_STITCH_FIXTURE, MOCK_STITCH_NOW_PLAYING_IDLE } from '../fixtures/stitchVisualMock';
import type { TelemetrySnapshotPacket, CheerPreset } from '@running-support/shared-contracts';

export function extractViewMetrics(
  telemetry: TelemetrySnapshotPacket | null,
  sessionStatus: string,
) {
  if (!telemetry) {
    return {
      metrics: undefined,
      lat: undefined,
      lng: undefined,
      elevationM: undefined,
      gpsQuality: 0,
      elapsedSeconds: undefined,
      watchBatteryPct: undefined,
      phoneBatteryPct: undefined,
      isLive: sessionStatus === 'ACTIVE',
      isCompleted: sessionStatus === 'COMPLETED',
      sessionStatus,
    };
  }
  const { metrics, coordinates, deviceHealth } = telemetry;
  return {
    metrics,
    lat: coordinates.lat,
    lng: coordinates.lng,
    elevationM: coordinates.elevationM,
    gpsQuality: coordinates.gpsQuality,
    elapsedSeconds: metrics.elapsedSeconds,
    watchBatteryPct: deviceHealth ? deviceHealth.watchBatteryPct : undefined,
    phoneBatteryPct: deviceHealth ? deviceHealth.phoneBatteryPct : undefined,
    isLive: sessionStatus === 'ACTIVE',
    isCompleted: sessionStatus === 'COMPLETED',
    sessionStatus,
  };
}

export function getInitialFixture(searchParams: { get: (k: string) => string | null }) {
  const key = searchParams.get('fixture') || searchParams.get('mock');
  if (key === 'stitch') {
    return MOCK_STITCH_FIXTURE;
  }
  return undefined;
}

export type FixtureConfig = (typeof MOCK_STITCH_FIXTURE)['config'];

export function resolveInnerDashboardParams(
  mockFixture: typeof MOCK_STITCH_FIXTURE | undefined,
  queryPin: string | null,
) {
  const cfg = mockFixture?.config;
  return {
    initialTelemetry: mockFixture ? mockFixture.telemetry : null,
    initialPath: mockFixture ? mockFixture.pathCoordinates : [],
    initialCheers: mockFixture ? mockFixture.cheers : [],
    initialPin: queryPin || cfg?.pin || '',
    fallbackPin: cfg?.pin || '',
  };
}

export function resolveLiveMetrics(
  mockFixture: typeof MOCK_STITCH_FIXTURE | undefined,
  vm: ReturnType<typeof extractViewMetrics>,
  elevationHistory: number[],
  calculatedEta?: string,
) {
  const cfg = mockFixture?.config;
  const liveElevation = formatElevationProfile(elevationHistory, vm.elevationM);
  return {
    eta: cfg?.eta || calculatedEta || '--:--',
    elevationText: cfg?.elevationProfileText || liveElevation,
  };
}

export function resolveInitialNowPlaying(
  searchParams: { get: (k: string) => string | null },
  mockFixture: typeof MOCK_STITCH_FIXTURE | undefined,
) {
  if (searchParams.get('nowPlaying') === 'idle') {
    return MOCK_STITCH_NOW_PLAYING_IDLE;
  }
  return mockFixture?.nowPlaying ?? null;
}

export function resolveAthleteName(
  mockFixture: ReturnType<typeof getInitialFixture>,
  explicitAthleteName?: string,
): string {
  return getRequiredAthleteName(mockFixture?.config?.athleteName || explicitAthleteName);
}

function useDashboardEtaAndLocality(
  vm: ReturnType<typeof extractViewMetrics>,
  mockFixture: ReturnType<typeof getInitialFixture>,
  elevationHistory: number[],
) {
  const totalRaceDistanceM = resolveTotalRaceDistance(
    vm.metrics?.totalRaceDistanceM,
    process.env.NEXT_PUBLIC_DEFAULT_RACE_DISTANCE_M,
  );
  const liveEta = useLiveEta({
    totalDistanceM: vm.metrics?.totalDistanceM,
    targetDistanceM: totalRaceDistanceM,
    paceSecPerKm: vm.metrics?.paceSecPerKm,
    speedMps: vm.metrics?.speedMps,
    isCompleted: vm.isCompleted,
  });
  const live = resolveLiveMetrics(mockFixture, vm, elevationHistory, liveEta);
  const gpsLocality = useGpsLocality(vm.lat, vm.lng);
  return { live, gpsLocality };
}

function useSessionClientAndState(
  token: string,
  init: ReturnType<typeof resolveInnerDashboardParams>,
) {
  const telemetry = useLiveTelemetry({
    token,
    pin: init.initialPin,
    initialTelemetry: init.initialTelemetry,
    initialPathCoordinates: init.initialPath,
  });
  const spectator = useSpectatorCheer({
    client: telemetry.client,
    sessionId: telemetry.telemetry ? telemetry.telemetry.sessionId : token,
    initialCheers: init.initialCheers,
    initialPin: init.initialPin,
  });
  const [isDismissed, setIsDismissed] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState<CheerPreset | null>(null);

  return {
    telemetry,
    spectator,
    isDismissed,
    setIsDismissed,
    selectedPresetId,
    setSelectedPresetId,
  };
}

export function useDashboardSession(token: string, explicitAthleteName?: string) {
  const searchParams = useSearchParams();
  const mockFixture = getInitialFixture(searchParams);
  const init = resolveInnerDashboardParams(mockFixture, searchParams.get('pin'));
  const athlete = resolveAthleteName(mockFixture, explicitAthleteName);
  const {
    telemetry,
    spectator,
    isDismissed,
    setIsDismissed,
    selectedPresetId,
    setSelectedPresetId,
  } = useSessionClientAndState(token, init);

  const { maxHeartRateBpm, resolveZone } = useEffortZones();
  const vm = extractViewMetrics(telemetry.telemetry, telemetry.sessionStatus);
  const { live, gpsLocality } = useDashboardEtaAndLocality(
    vm,
    mockFixture,
    telemetry.elevationHistory,
  );
  const nowPlaying = useNowPlaying({
    client: telemetry.client,
    initialNowPlaying: resolveInitialNowPlaying(searchParams, mockFixture),
  });
  const notifications = useSpectatorNotifications({
    telemetry: telemetry.telemetry,
    athleteName: athlete,
    onSelectPreset: setSelectedPresetId,
  });

  return {
    vm,
    athlete,
    maxHeartRateBpm,
    resolveZone,
    pathCoordinates: telemetry.pathCoordinates,
    spectator,
    nowPlaying,
    gpsLocality,
    mockFixture,
    live,
    isDismissed,
    setIsDismissed,
    activePin: spectator.pin || init.initialPin || init.fallbackPin,
    client: telemetry.client,
    isUnauthorized: telemetry.isUnauthorized,
    notifications,
    selectedPresetId,
  };
}
