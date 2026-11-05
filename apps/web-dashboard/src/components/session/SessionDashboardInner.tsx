'use client';

import React, { useEffect } from 'react';
import { useDashboardSession } from '../../hooks/useDashboardSession';
import { UnauthorizedAccessCard } from './UnauthorizedAccessCard';
import { DashboardLayout } from './DashboardLayout';
import { registerDashboardServiceWorker } from '../../utils/serviceWorkerRegistration';
import type { DashboardRuntimeConfig } from '../../utils/runtimeConfig';

export function SessionDashboardInner({
  token,
  athleteName,
  runtimeConfig,
}: {
  token: string;
  athleteName?: string;
  runtimeConfig?: DashboardRuntimeConfig;
}) {
  useEffect(() => {
    void registerDashboardServiceWorker();
  }, []);

  const session = useDashboardSession(token, athleteName, runtimeConfig);
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
      maxHeartRateBpm={session.maxHeartRateBpm}
      athleteName={session.athlete}
      pathCoordinates={session.pathCoordinates}
      kmMarkers={session.kmMarkers}
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
      notifications={session.notifications}
      selectedPresetId={session.selectedPresetId}
      runtimeConfig={runtimeConfig}
    />
  );
}
