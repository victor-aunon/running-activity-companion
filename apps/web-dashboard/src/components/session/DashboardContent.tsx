import React from 'react';
import { MapTile } from '../bento/MapTile';
import { SpotifyPlayerTile } from '../bento/SpotifyPlayerTile';
import { CheerWallTile } from '../bento/CheerWallTile';
import { PaceAndHeartRateTiles, DistanceAndCadenceTiles } from './SessionMetricTiles';
import type { extractViewMetrics } from '../../hooks/useDashboardSession';
import type { useSpectatorCheer } from '../../hooks/useSpectatorCheer';
import type { useNowPlaying } from '../../hooks/useNowPlaying';
import type { HeartRateZoneResult } from '../../types/telemetry';
import type { CheerPreset } from '@running-support/shared-contracts';
import type { KilometerMarker } from '../../utils/mapMarkers';

export interface MainDashboardProps {
  vm: ReturnType<typeof extractViewMetrics>;
  resolveZone: (b: number) => HeartRateZoneResult;
  pathCoordinates: [number, number][];
  kmMarkers?: KilometerMarker[];
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
  selectedPresetId?: CheerPreset | null;
}

export interface MapAndCheerProps {
  vm: ReturnType<typeof extractViewMetrics>;
  pathCoordinates: [number, number][];
  kmMarkers?: KilometerMarker[];
  spectator: ReturnType<typeof useSpectatorCheer>;
  nowPlaying: ReturnType<typeof useNowPlaying>;
  routeName?: string;
  elevationText?: string;
  eta?: string;
  spectatorCount?: number;
  athleteName?: string;
  selectedPresetId?: CheerPreset | null;
}

export function MapColumn({
  vm,
  pathCoordinates,
  kmMarkers,
  routeName,
  elevationText,
  eta,
}: {
  vm: ReturnType<typeof extractViewMetrics>;
  pathCoordinates: [number, number][];
  kmMarkers?: KilometerMarker[];
  routeName?: string;
  elevationText?: string;
  eta?: string;
}) {
  return (
    <div className="lg:col-span-7 xl:col-span-8 flex flex-col h-full">
      <MapTile
        currentLat={vm.lat}
        currentLng={vm.lng}
        gpsQuality={vm.gpsQuality}
        pathCoordinates={pathCoordinates}
        kmMarkers={kmMarkers}
        elapsedSeconds={vm.elapsedSeconds}
        elevationM={vm.elevationM}
        eta={eta}
        routeName={routeName}
        elevationProfileText={elevationText}
      />
    </div>
  );
}

export function MapAndCheerColumns(props: MapAndCheerProps) {
  const { spectator, nowPlaying, spectatorCount, athleteName, selectedPresetId } = props;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
      <MapColumn {...props} />
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
          activePin={spectator.pin}
          senderName={spectator.senderName}
          onSenderNameChange={spectator.setSenderName}
          isSubmitting={spectator.isSubmitting}
          errorMsg={spectator.errorMsg}
          rateLimitSeconds={spectator.rateLimitSeconds}
          spectatorCount={spectatorCount}
          athleteName={athleteName}
          selectedPresetId={selectedPresetId}
        />
      </div>
    </div>
  );
}

export function MainDashboardContent({
  vm,
  resolveZone,
  pathCoordinates,
  kmMarkers,
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
  selectedPresetId,
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
        kmMarkers={kmMarkers}
        spectator={spectator}
        nowPlaying={nowPlaying}
        routeName={routeName}
        elevationText={elevationText}
        eta={eta}
        spectatorCount={spectatorCount}
        athleteName={athleteName}
        selectedPresetId={selectedPresetId}
      />
    </>
  );
}
