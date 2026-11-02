import React from 'react';
import { HeaderTile } from '../bento/HeaderTile';
import { getRequiredAthleteName } from '../../utils/athlete';
import type { extractViewMetrics, FixtureConfig } from '../../hooks/useDashboardSession';

export function DashboardHeader({
  cfg,
  vm,
  gpsLocality,
  displayPin,
  onRefresh,
  athleteName,
}: {
  cfg: Partial<FixtureConfig>;
  vm: ReturnType<typeof extractViewMetrics>;
  gpsLocality?: string;
  displayPin?: string;
  onRefresh?: () => void;
  athleteName?: string;
}) {
  const resolvedLocality =
    cfg.locality || gpsLocality || process.env.NEXT_PUBLIC_DEFAULT_LOCALITY || 'Madrid, España';

  return (
    <HeaderTile
      athleteName={getRequiredAthleteName(cfg.athleteName || athleteName)}
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
