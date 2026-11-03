import {
  parseEffortZones,
  type EffortZoneConfig,
} from '../hooks/useEffortZones.ts';
import {
  parseCadenceZones,
  parseTargetPace,
  type CadenceZoneConfig,
} from './formatters.ts';
import {
  parseNotificationThresholds,
  resolveTotalRaceDistance,
  type NotificationThresholdsConfig,
} from '../hooks/useSpectatorNotificationsLogic.ts';
import { getRequiredAthleteName } from './athlete.ts';

export interface DashboardRuntimeConfig {
  athleteName: string;
  effortZones: EffortZoneConfig;
  cadenceZones: CadenceZoneConfig;
  notificationThresholds: NotificationThresholdsConfig;
  defaultLocality: string;
  defaultRaceDistanceM: number;
  targetPaceSecPerKm: number;
}

export function resolveDashboardRuntimeConfig(
  env: Record<string, string | undefined> = typeof process !== 'undefined' ? process.env : {},
): DashboardRuntimeConfig {
  const athleteName = getRequiredAthleteName(env.NEXT_PUBLIC_ATHLETE_NAME);
  const effortZones = parseEffortZones(env);
  const cadenceZones = parseCadenceZones(env);
  const notificationThresholds = parseNotificationThresholds(env);
  const defaultLocality = env.NEXT_PUBLIC_DEFAULT_LOCALITY?.trim() || 'Madrid, España';
  const targetPaceSecPerKm = parseTargetPace(env.NEXT_PUBLIC_TARGET_PACE) ?? 270;
  const defaultRaceDistanceM = resolveTotalRaceDistance(
    undefined,
    env.NEXT_PUBLIC_DEFAULT_RACE_DISTANCE_M,
  );

  return {
    athleteName,
    effortZones,
    cadenceZones,
    notificationThresholds,
    defaultLocality,
    defaultRaceDistanceM,
    targetPaceSecPerKm,
  };
}
