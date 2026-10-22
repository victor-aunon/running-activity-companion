export * from '@running-support/shared-contracts';

export interface EffortZoneConfig {
  zone1Max: number;
  zone2Max: number;
  zone3Max: number;
  zone4Max: number;
  zone5Max: number;
}

export interface HeartRateZoneResult {
  zone: 1 | 2 | 3 | 4 | 5;
  name: string;
  colorClass: string;
  badgeClass: string;
}
