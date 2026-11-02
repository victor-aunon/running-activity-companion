'use client';

import React from 'react';
import { useDashboardSession } from '../../hooks/useDashboardSession';
import { UnauthorizedAccessCard } from './UnauthorizedAccessCard';
import { DashboardLayout } from './DashboardLayout';

export function SessionDashboardInner({
  token,
  athleteName,
}: {
  token: string;
  athleteName?: string;
}) {
  const session = useDashboardSession(token, athleteName);
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
    />
  );
}
