import { useMemo } from 'react';
import type { EffortZoneConfig, HeartRateZoneResult } from '../types/telemetry';

export const DEFAULT_EFFORT_ZONES: EffortZoneConfig = {
  zone1Max: 130,
  zone2Max: 145,
  zone3Max: 160,
  zone4Max: 175,
  zone5Max: 195,
};

function isMonotonicSequence(values: number[]): boolean {
  if (values.some((v) => isNaN(v) || v <= 0)) return false;
  for (let i = 1; i < values.length; i++) {
    if (values[i] <= values[i - 1]) return false;
  }
  return true;
}

export function parseEffortZones(env: Record<string, string | undefined>): EffortZoneConfig {
  const zones = [
    Number(env.NEXT_PUBLIC_ZONE_1_MAX),
    Number(env.NEXT_PUBLIC_ZONE_2_MAX),
    Number(env.NEXT_PUBLIC_ZONE_3_MAX),
    Number(env.NEXT_PUBLIC_ZONE_4_MAX),
    Number(env.NEXT_PUBLIC_ZONE_5_MAX),
  ];

  if (!isMonotonicSequence(zones)) {
    return DEFAULT_EFFORT_ZONES;
  }

  const [zone1Max, zone2Max, zone3Max, zone4Max, zone5Max] = zones;
  return { zone1Max, zone2Max, zone3Max, zone4Max, zone5Max };
}

export function resolveHeartRateZone(
  bpm: number,
  config: EffortZoneConfig = DEFAULT_EFFORT_ZONES,
): HeartRateZoneResult {
  if (bpm <= config.zone1Max) {
    return {
      zone: 1,
      name: 'Zona 1 (Recuperación)',
      colorClass: 'text-sky-600',
      badgeClass: 'bg-sky-50 text-sky-700 border-sky-300',
    };
  }
  if (bpm <= config.zone2Max) {
    return {
      zone: 2,
      name: 'Zona 2 (Aeróbico)',
      colorClass: 'text-emerald-600',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-300',
    };
  }
  if (bpm <= config.zone3Max) {
    return {
      zone: 3,
      name: 'Zona 3 (Tempo)',
      colorClass: 'text-amber-600',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-300',
    };
  }
  if (bpm <= config.zone4Max) {
    return {
      zone: 4,
      name: 'Zona 4 (Umbral)',
      colorClass: 'text-orange-600',
      badgeClass: 'bg-orange-50 text-orange-700 border-orange-300',
    };
  }
  return {
    zone: 5,
    name: 'Zona 5 (Anaeróbico)',
    colorClass: 'text-rose-600',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-300 animate-pulse',
  };
}

export function useEffortZones() {
  const config = useMemo(() => {
    return parseEffortZones(process.env as Record<string, string | undefined>);
  }, []);

  return {
    config,
    resolveZone: (bpm: number) => resolveHeartRateZone(bpm, config),
  };
}
