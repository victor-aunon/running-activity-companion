import React from 'react';
import { AuroraGlowOrbs } from './AuroraGlowOrbs';
import { DashboardHeader } from './DashboardHeader';
import { MainDashboardContent, type MainDashboardProps } from './DashboardContent';
import { NotificationSnackbarContainer } from '../ui/NotificationSnackbarContainer';
import { SessionSummaryModal } from '../bento/SessionSummaryModal';
import { parseTargetPace } from '../../utils/formatters';
import { resolveTotalRaceDistance } from '../../hooks/useSpectatorNotificationsLogic';
import { getRequiredAthleteName } from '../../utils/athlete';
import type { extractViewMetrics, FixtureConfig } from '../../hooks/useDashboardSession';
import type { useSpectatorCheer } from '../../hooks/useSpectatorCheer';
import type { useNowPlaying } from '../../hooks/useNowPlaying';
import type { useSpectatorNotifications } from '../../hooks/useSpectatorNotifications';
import type { HeartRateZoneResult } from '../../types/telemetry';
import type { CheerPreset } from '@running-support/shared-contracts';
import type { DashboardRuntimeConfig } from '../../utils/runtimeConfig';

export interface DashboardLayoutProps {
  vm: ReturnType<typeof extractViewMetrics>;
  resolveZone: (b: number) => HeartRateZoneResult;
  maxHeartRateBpm?: number;
  athleteName?: string;
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
  notifications?: ReturnType<typeof useSpectatorNotifications>;
  selectedPresetId?: CheerPreset | null;
  runtimeConfig?: DashboardRuntimeConfig;
}

function resolveTargetDistanceKm(
  totalDistanceM?: number,
  fallbackRaceDistanceM?: number,
): number | undefined {
  const totalM = resolveTotalRaceDistance(
    totalDistanceM,
    fallbackRaceDistanceM ?? process.env.NEXT_PUBLIC_DEFAULT_RACE_DISTANCE_M,
  );
  return totalM > 0 ? Number((totalM / 1000).toFixed(1)) : undefined;
}

function resolveMaxHr(explicitMax?: number, fallbackMax?: number): number | undefined {
  if (explicitMax !== undefined) return explicitMax;
  if (fallbackMax !== undefined) return fallbackMax;
  const envMax = process.env.NEXT_PUBLIC_ZONE_5_MAX;
  return envMax ? Number(envMax) : undefined;
}

function resolveMainDashboardProps(props: DashboardLayoutProps): MainDashboardProps {
  const cfg: Partial<FixtureConfig> = props.config || {};
  const fallbackPace =
    props.runtimeConfig?.targetPaceSecPerKm ??
    (parseTargetPace(process.env.NEXT_PUBLIC_TARGET_PACE) ?? 270);
  const targetPace = props.vm.metrics?.targetPaceSecPerKm || fallbackPace;

  return {
    vm: props.vm,
    resolveZone: props.resolveZone,
    pathCoordinates: props.pathCoordinates,
    spectator: props.spectator,
    nowPlaying: props.nowPlaying,
    targetDistanceKm: resolveTargetDistanceKm(
      props.vm.metrics?.totalRaceDistanceM,
      props.runtimeConfig?.defaultRaceDistanceM,
    ),
    targetPaceSecPerKm: targetPace,
    maxHeartRateBpm: resolveMaxHr(
      props.maxHeartRateBpm,
      props.runtimeConfig?.effortZones?.zone5Max,
    ),
    routeName: cfg.routeName,
    elevationText: props.elevationText || cfg.elevationProfileText,
    eta: props.eta || cfg.eta,
    spectatorCount: cfg.spectatorCount,
    athleteName: getRequiredAthleteName(
      cfg.athleteName || props.athleteName || props.runtimeConfig?.athleteName,
    ),
    selectedPresetId: props.selectedPresetId,
  };
}

export function DashboardBody(props: DashboardLayoutProps) {
  const mainProps = resolveMainDashboardProps(props);
  return <MainDashboardContent {...mainProps} />;
}

export function DashboardLayout(props: DashboardLayoutProps) {
  const {
    vm,
    isCompleted,
    isDismissed,
    onDismiss,
    onRefresh,
    displayPin,
    gpsLocality,
    config,
    notifications,
    athleteName,
  } = props;
  const cfg: Partial<FixtureConfig> = config || {};
  const resolvedAthlete = getRequiredAthleteName(cfg.athleteName || athleteName);

  return (
    <main className="min-h-screen bg-slate-50/70 text-slate-800 relative selection:bg-indigo-100 selection:text-indigo-900 py-6">
      <AuroraGlowOrbs />
      {notifications && (
        <NotificationSnackbarContainer
          snackbars={notifications.snackbars}
          onDismiss={notifications.dismissSnackbar}
          onCtaClick={notifications.handleCtaClick}
        />
      )}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <DashboardHeader
          cfg={cfg}
          vm={vm}
          gpsLocality={gpsLocality}
          displayPin={displayPin}
          onRefresh={onRefresh}
          athleteName={resolvedAthlete}
        />
        <DashboardBody {...props} athleteName={resolvedAthlete} />
        <SessionSummaryModal
          isOpen={isCompleted && !isDismissed}
          onClose={onDismiss}
          metrics={vm.metrics}
          totalCheersReceived={props.spectator.cheers.length}
          athleteName={resolvedAthlete}
        />
      </div>
    </main>
  );
}
