'use client';

import React, { Suspense, use, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useLiveTelemetry } from '../../../hooks/useLiveTelemetry';
import { useEffortZones } from '../../../hooks/useEffortZones';
import { useGpsLocality } from '../../../hooks/useGpsLocality';
import { HeaderTile } from '../../../components/bento/HeaderTile';
import { MetricTile, formatPace, formatDistanceKm } from '../../../components/bento/MetricTile';
import {
  resolveCadenceZone,
  calculateDynamicEta,
  formatElevationProfile,
} from '../../../utils/formatters';
import { MapTile } from '../../../components/bento/MapTile';
import { CheerWallTile } from '../../../components/bento/CheerWallTile';
import { SpotifyPlayerTile } from '../../../components/bento/SpotifyPlayerTile';
import { SessionSummaryModal } from '../../../components/bento/SessionSummaryModal';
import { useSpectatorCheer } from '../../../hooks/useSpectatorCheer';
import { useNowPlaying } from '../../../hooks/useNowPlaying';
import type { HeartRateZoneResult } from '../../../types/telemetry';
import type { RunningMetrics, TelemetrySnapshotPacket } from '@running-support/shared-contracts';
import { Heart, Gauge, Flag, Footprints, KeyRound } from 'lucide-react';
import {
  MOCK_STITCH_FIXTURE,
  MOCK_STITCH_NOW_PLAYING_IDLE,
} from '../../../fixtures/stitchVisualMock';

interface PageProps {
  params: Promise<{ token: string }>;
}

function PaceMetricFooter({
  metrics,
  targetPaceSecPerKm,
}: {
  metrics?: RunningMetrics;
  targetPaceSecPerKm?: number;
}) {
  if (!metrics || metrics.paceSecPerKm <= 0) {
    return <span className="text-slate-400 font-normal">Sin datos de ritmo</span>;
  }
  if (targetPaceSecPerKm) {
    const diff = Math.round(metrics.paceSecPerKm - targetPaceSecPerKm);
    const sign = diff <= 0 ? '-' : '+';
    const absDiff = Math.abs(diff);
    return (
      <span className="font-bold text-teal-600">
        ↗ {sign}0:{absDiff.toString().padStart(2, '0')}s vs objetivo
      </span>
    );
  }
  return <span className="font-bold text-teal-600">Ritmo activo</span>;
}

function HeartRateMetricFooter({
  zoneInfo,
  maxHeartRateBpm,
}: {
  zoneInfo: HeartRateZoneResult | null;
  maxHeartRateBpm?: number;
}) {
  if (!zoneInfo) {
    return <span className="text-slate-400 font-normal">Esperando pulsómetro</span>;
  }
  return (
    <>
      <span className="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
        {zoneInfo.name}
      </span>
      <span className="text-slate-500 font-semibold">
        {maxHeartRateBpm ? `Máx ${maxHeartRateBpm}` : `Zona ${zoneInfo.zone}`}
      </span>
    </>
  );
}

function PaceAndHeartRateTiles({
  metrics,
  resolveZone,
  targetPaceSecPerKm,
  maxHeartRateBpm,
}: {
  metrics: RunningMetrics | undefined;
  resolveZone: (bpm: number) => HeartRateZoneResult;
  targetPaceSecPerKm?: number;
  maxHeartRateBpm?: number;
}) {
  const heartRate = metrics?.heartRateBpm ?? 0;
  const pace = metrics?.paceSecPerKm ?? 0;
  const zoneInfo = heartRate > 0 ? resolveZone(heartRate) : null;

  return (
    <>
      <MetricTile
        intent="pace"
        title="RITMO MEDIO"
        value={formatPace(pace)}
        unit="min/km"
        icon={<Gauge className="w-5 h-5 text-orange-600" />}
        iconBgClass="bg-orange-50 text-orange-600"
        footer={<PaceMetricFooter metrics={metrics} targetPaceSecPerKm={targetPaceSecPerKm} />}
      />
      <MetricTile
        intent="heartRate"
        title="FRECUENCIA CARDÍACA"
        value={heartRate > 0 ? heartRate : '--'}
        unit="bpm"
        icon={<Heart className="w-5 h-5 text-rose-500 fill-rose-500" />}
        iconBgClass="bg-rose-50 text-rose-500"
        footer={<HeartRateMetricFooter zoneInfo={zoneInfo} maxHeartRateBpm={maxHeartRateBpm} />}
      />
    </>
  );
}

function DistanceMetricFooter({
  distance,
  targetDistanceKm,
}: {
  distance: number;
  targetDistanceKm?: number;
}) {
  if (distance <= 0) {
    return <span className="text-slate-400 font-normal">Esperando inicio de carrera</span>;
  }
  if (targetDistanceKm && targetDistanceKm > 0) {
    const pct = Math.min(100, (distance / (targetDistanceKm * 1000)) * 100).toFixed(1);
    return (
      <div className="w-full space-y-1.5">
        <div className="flex justify-between text-xs font-semibold text-slate-600">
          <span>Progreso Media Maratón</span>
          <span className="text-orange-600 font-bold">{pct}%</span>
        </div>
        <div className="w-full bg-slate-100 h-2 rounded-lg overflow-hidden">
          <div
            className="bg-gradient-to-r from-teal-400 to-orange-600 h-full rounded-lg"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  }
  return (
    <span className="text-slate-600 font-medium">
      Total acumulado: {formatDistanceKm(distance)} km
    </span>
  );
}

function CadenceMetricFooter({ cadence }: { cadence: number }) {
  if (cadence <= 0) {
    return <span className="text-slate-400 font-normal">Sin datos de cadencia</span>;
  }
  const zone = resolveCadenceZone(cadence);
  return (
    <>
      <span className={`${zone.colorClass} font-bold flex items-center gap-1`}>● {zone.badge}</span>
      <span className="text-slate-500 font-semibold">{zone.label}</span>
    </>
  );
}

function DistanceAndCadenceTiles({
  metrics,
  targetDistanceKm,
}: {
  metrics: RunningMetrics | undefined;
  targetDistanceKm?: number;
}) {
  const distance = metrics?.totalDistanceM ?? 0;
  const cadence = metrics?.cadenceSpm ?? 0;

  return (
    <>
      <MetricTile
        intent="cadence"
        title="CADENCIA PASOS"
        value={cadence > 0 ? cadence : '--'}
        unit="spm"
        icon={<Footprints className="w-5 h-5 text-teal-600" />}
        iconBgClass="bg-teal-50 text-teal-600"
        footer={<CadenceMetricFooter cadence={cadence} />}
      />
      <MetricTile
        intent="distance"
        title="DISTANCIA RECORRIDA"
        value={formatDistanceKm(distance)}
        unit={targetDistanceKm ? `/ ${targetDistanceKm} km` : 'km'}
        icon={<Flag className="w-5 h-5 text-indigo-600" />}
        iconBgClass="bg-indigo-50 text-indigo-600"
        footer={<DistanceMetricFooter distance={distance} targetDistanceKm={targetDistanceKm} />}
      />
    </>
  );
}

function extractViewMetrics(telemetry: TelemetrySnapshotPacket | null, sessionStatus: string) {
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

function AuroraGlowOrbs() {
  return (
    <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
      <div className="absolute -top-32 -left-20 w-[600px] h-[600px] bg-indigo-200/40 rounded-full blur-[110px]" />
      <div className="absolute top-1/4 right-0 w-[500px] h-[500px] bg-teal-100/50 rounded-full blur-[100px]" />
      <div className="absolute bottom-10 left-1/3 w-[550px] h-[550px] bg-rose-100/40 rounded-full blur-[120px]" />
    </div>
  );
}

interface MainDashboardProps {
  vm: ReturnType<typeof extractViewMetrics>;
  resolveZone: (b: number) => HeartRateZoneResult;
  pathCoordinates: [number, number][];
  spectator: ReturnType<typeof useSpectatorCheer>;
  nowPlaying: ReturnType<typeof useNowPlaying>;
  targetDistanceKm?: number;
  targetPaceSecPerKm?: number;
  maxHeartRateBpm?: number;
  routeName?: string;
  elevationText?: string;
  eta?: string;
  spectatorCount?: number;
  athleteName?: string;
}

interface MapAndCheerProps {
  vm: ReturnType<typeof extractViewMetrics>;
  pathCoordinates: [number, number][];
  spectator: ReturnType<typeof useSpectatorCheer>;
  nowPlaying: ReturnType<typeof useNowPlaying>;
  routeName?: string;
  elevationText?: string;
  eta?: string;
  spectatorCount?: number;
  athleteName?: string;
}

function MapAndCheerColumns({
  vm,
  pathCoordinates,
  spectator,
  nowPlaying,
  routeName,
  elevationText,
  eta,
  spectatorCount,
  athleteName,
}: MapAndCheerProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
      <div className="lg:col-span-7 xl:col-span-8 flex flex-col h-full">
        <MapTile
          currentLat={vm.lat}
          currentLng={vm.lng}
          gpsQuality={vm.gpsQuality}
          pathCoordinates={pathCoordinates}
          elapsedSeconds={vm.elapsedSeconds}
          elevationM={vm.elevationM}
          eta={eta}
          routeName={routeName}
          elevationProfileText={elevationText}
        />
      </div>
      <div className="lg:col-span-5 xl:col-span-4 flex flex-col h-full gap-4">
        <SpotifyPlayerTile
          track={nowPlaying.track}
          playbackStatus={nowPlaying.playbackStatus}
          currentPositionMs={nowPlaying.currentPositionMs}
          athleteName={athleteName}
        />
        <CheerWallTile
          cheers={spectator.cheers}
          onSendCheer={spectator.sendCheer}
          pin={spectator.pin}
          onPinChange={spectator.setPin}
          senderName={spectator.senderName}
          onSenderNameChange={spectator.setSenderName}
          isSubmitting={spectator.isSubmitting}
          errorMsg={spectator.errorMsg}
          rateLimitSeconds={spectator.rateLimitSeconds}
          spectatorCount={spectatorCount}
          athleteName={athleteName}
        />
      </div>
    </div>
  );
}

function MainDashboardContent({
  vm,
  resolveZone,
  pathCoordinates,
  spectator,
  nowPlaying,
  targetDistanceKm,
  targetPaceSecPerKm,
  maxHeartRateBpm,
  routeName,
  elevationText,
  eta,
  spectatorCount,
  athleteName,
}: MainDashboardProps) {
  return (
    <>
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <PaceAndHeartRateTiles
          metrics={vm.metrics}
          resolveZone={resolveZone}
          targetPaceSecPerKm={targetPaceSecPerKm}
          maxHeartRateBpm={maxHeartRateBpm}
        />
        <DistanceAndCadenceTiles metrics={vm.metrics} targetDistanceKm={targetDistanceKm} />
      </section>
      <MapAndCheerColumns
        vm={vm}
        pathCoordinates={pathCoordinates}
        spectator={spectator}
        nowPlaying={nowPlaying}
        routeName={routeName}
        elevationText={elevationText}
        eta={eta}
        spectatorCount={spectatorCount}
        athleteName={athleteName}
      />
    </>
  );
}

function getInitialFixture(searchParams: { get: (k: string) => string | null }) {
  const key = searchParams.get('fixture') || searchParams.get('mock');
  if (key === 'stitch') {
    return MOCK_STITCH_FIXTURE;
  }
  return undefined;
}

type FixtureConfig = (typeof MOCK_STITCH_FIXTURE)['config'];

interface DashboardLayoutProps {
  vm: ReturnType<typeof extractViewMetrics>;
  resolveZone: (b: number) => HeartRateZoneResult;
  pathCoordinates: [number, number][];
  spectator: ReturnType<typeof useSpectatorCheer>;
  nowPlaying: ReturnType<typeof useNowPlaying>;
  gpsLocality?: string;
  config?: FixtureConfig;
  elevationText?: string;
  eta?: string;
  isCompleted: boolean;
  isDismissed: boolean;
  onDismiss: () => void;
  onRefresh?: () => void;
  displayPin?: string;
}

function DashboardHeader({
  cfg,
  vm,
  gpsLocality,
  displayPin,
  onRefresh,
}: {
  cfg: Partial<FixtureConfig>;
  vm: ReturnType<typeof extractViewMetrics>;
  gpsLocality?: string;
  displayPin?: string;
  onRefresh?: () => void;
}) {
  const resolvedLocality =
    cfg.locality || gpsLocality || process.env.NEXT_PUBLIC_DEFAULT_LOCALITY || 'Madrid, España';

  return (
    <HeaderTile
      athleteName={cfg.athleteName}
      locality={resolvedLocality}
      elapsedSeconds={vm.elapsedSeconds}
      watchBatteryPct={vm.watchBatteryPct}
      phoneBatteryPct={vm.phoneBatteryPct}
      isLive={vm.isLive}
      sessionStatus={vm.sessionStatus}
      pin={displayPin || cfg.pin || '----'}
      onRefresh={onRefresh}
    />
  );
}

function DashboardBody(props: DashboardLayoutProps) {
  const { vm, resolveZone, pathCoordinates, spectator, nowPlaying, config, elevationText, eta } =
    props;
  const cfg: Partial<FixtureConfig> = config || {};
  return (
    <MainDashboardContent
      vm={vm}
      resolveZone={resolveZone}
      pathCoordinates={pathCoordinates}
      spectator={spectator}
      nowPlaying={nowPlaying}
      targetDistanceKm={21.1}
      targetPaceSecPerKm={267}
      maxHeartRateBpm={174}
      routeName={cfg.routeName}
      elevationText={elevationText || cfg.elevationProfileText}
      eta={eta || cfg.eta}
      spectatorCount={cfg.spectatorCount}
      athleteName={cfg.athleteName}
    />
  );
}

function DashboardLayout(props: DashboardLayoutProps) {
  const { vm, isCompleted, isDismissed, onDismiss, onRefresh, displayPin, gpsLocality, config } =
    props;
  const cfg: Partial<FixtureConfig> = config || {};
  return (
    <main className="min-h-screen bg-slate-50/70 text-slate-800 relative selection:bg-indigo-100 selection:text-indigo-900 py-6">
      <AuroraGlowOrbs />
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <DashboardHeader
          cfg={cfg}
          vm={vm}
          gpsLocality={gpsLocality}
          displayPin={displayPin}
          onRefresh={onRefresh}
        />
        <DashboardBody {...props} />
        <SessionSummaryModal
          isOpen={isCompleted && !isDismissed}
          onClose={onDismiss}
          metrics={vm.metrics}
          totalCheersReceived={props.spectator.cheers.length}
        />
      </div>
    </main>
  );
}

function resolveInnerDashboardParams(
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

function resolveLiveMetrics(
  mockFixture: typeof MOCK_STITCH_FIXTURE | undefined,
  vm: ReturnType<typeof extractViewMetrics>,
  elevationHistory: number[],
) {
  const cfg = mockFixture?.config;
  const liveEta = calculateDynamicEta(vm.metrics?.totalDistanceM, vm.metrics?.speedMps, 21097);
  const liveElevation = formatElevationProfile(elevationHistory, vm.elevationM);
  return {
    eta: cfg?.eta || liveEta,
    elevationText: cfg?.elevationProfileText || liveElevation,
  };
}

function resolveInitialNowPlaying(
  searchParams: { get: (k: string) => string | null },
  mockFixture: typeof MOCK_STITCH_FIXTURE | undefined,
) {
  if (searchParams.get('nowPlaying') === 'idle') {
    return MOCK_STITCH_NOW_PLAYING_IDLE;
  }
  return mockFixture?.nowPlaying ?? null;
}

function useDashboardSession(token: string) {
  const searchParams = useSearchParams();
  const mockFixture = getInitialFixture(searchParams);
  const init = resolveInnerDashboardParams(mockFixture, searchParams.get('pin'));

  const telemetry = useLiveTelemetry({
    token,
    pin: init.initialPin,
    initialTelemetry: init.initialTelemetry,
    initialPathCoordinates: init.initialPath,
  });
  const { resolveZone } = useEffortZones();
  const [isDismissed, setIsDismissed] = useState(false);

  const spectator = useSpectatorCheer({
    client: telemetry.client,
    sessionId: telemetry.telemetry ? telemetry.telemetry.sessionId : token,
    initialCheers: init.initialCheers,
    initialPin: init.initialPin,
  });

  const vm = extractViewMetrics(telemetry.telemetry, telemetry.sessionStatus);
  const live = resolveLiveMetrics(mockFixture, vm, telemetry.elevationHistory);
  const gpsLocality = useGpsLocality(vm.lat, vm.lng);
  const nowPlaying = useNowPlaying({
    client: telemetry.client,
    initialNowPlaying: resolveInitialNowPlaying(searchParams, mockFixture),
  });

  return {
    vm,
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
  };
}

function UnauthorizedAccessCard({ token }: { token: string }) {
  const router = useRouter();
  return (
    <main className="min-h-screen bg-slate-50/70 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white/90 backdrop-blur-md rounded-2xl border border-red-200 shadow-xl p-6 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
          <KeyRound className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-800">Acceso no autorizado</h2>
        <p className="text-sm text-slate-600">
          El PIN de 4 dígitos proporcionado para la sesión &ldquo;{token}&rdquo; es incorrecto.
        </p>
        <button
          onClick={() => router.push('/')}
          className="w-full py-2.5 px-4 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-xl transition-colors shadow-sm cursor-pointer"
        >
          Volver a Introducir PIN
        </button>
      </div>
    </main>
  );
}

function SessionDashboardInner({ token }: { token: string }) {
  const session = useDashboardSession(token);
  const onRefresh = session.client
    ? () => {
        session.client?.disconnect();
        session.client?.connect();
      }
    : undefined;

  if (session.isUnauthorized) {
    return <UnauthorizedAccessCard token={token} />;
  }

  return (
    <DashboardLayout
      vm={session.vm}
      resolveZone={session.resolveZone}
      pathCoordinates={session.pathCoordinates}
      spectator={session.spectator}
      nowPlaying={session.nowPlaying}
      gpsLocality={session.gpsLocality}
      config={session.mockFixture ? session.mockFixture.config : undefined}
      elevationText={session.live.elevationText}
      eta={session.live.eta}
      isCompleted={session.vm.isCompleted}
      isDismissed={session.isDismissed}
      onDismiss={() => session.setIsDismissed(true)}
      onRefresh={onRefresh}
      displayPin={session.activePin}
    />
  );
}

export default function SessionLivePage({ params }: PageProps) {
  const { token } = use(params);

  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50/70" />}>
      <SessionDashboardInner token={token} />
    </Suspense>
  );
}
