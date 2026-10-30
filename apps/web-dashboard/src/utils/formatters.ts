/**
 * Pure domain & presentation formatters for telemetry metrics
 * Provides clean, truthful fallbacks when live streaming data is absent
 */

export function formatPace(paceSecPerKm?: number | null): string {
  if (
    paceSecPerKm === undefined ||
    paceSecPerKm === null ||
    paceSecPerKm <= 0 ||
    !isFinite(paceSecPerKm)
  ) {
    return '--:--';
  }
  const mins = Math.floor(paceSecPerKm / 60);
  const secs = Math.floor(paceSecPerKm % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export interface PaceDifferenceResult {
  text: string;
  colorClass: string;
  icon: string;
  diffSeconds: number;
}

export function parseTargetPace(raw?: string | number | null): number | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw === 'number') {
    return raw > 0 && isFinite(raw) ? Math.round(raw) : undefined;
  }
  const str = raw.trim();
  if (!str) return undefined;

  // Format mm:ss (e.g. "4:30", "04:30")
  const mmSsMatch = str.match(/^(\d{1,2}):([0-5]\d)$/);
  if (mmSsMatch) {
    const mins = parseInt(mmSsMatch[1], 10);
    const secs = parseInt(mmSsMatch[2], 10);
    const total = mins * 60 + secs;
    return total > 0 ? total : undefined;
  }

  // Format seconds number string (e.g. "270")
  const num = Number(str);
  if (!isNaN(num) && num > 0 && isFinite(num)) {
    return Math.round(num);
  }

  return undefined;
}

export function formatPaceDifference(
  currentPaceSecPerKm?: number | null,
  targetPaceSecPerKm?: number | null,
): PaceDifferenceResult | null {
  if (
    currentPaceSecPerKm === undefined ||
    currentPaceSecPerKm === null ||
    currentPaceSecPerKm <= 0 ||
    !isFinite(currentPaceSecPerKm) ||
    targetPaceSecPerKm === undefined ||
    targetPaceSecPerKm === null ||
    targetPaceSecPerKm <= 0 ||
    !isFinite(targetPaceSecPerKm)
  ) {
    return null;
  }

  const diff = Math.round(currentPaceSecPerKm - targetPaceSecPerKm);
  const absDiff = Math.abs(diff);
  const mins = Math.floor(absDiff / 60);
  const secs = absDiff % 60;
  const sign = diff > 0 ? '+' : diff < 0 ? '-' : '';
  const text = `${sign}${mins}:${secs.toString().padStart(2, '0')}`;

  const isFaster = diff < 0;
  const isSlower = diff > 0;
  const colorClass = isFaster ? 'text-emerald-600' : isSlower ? 'text-amber-600' : 'text-teal-600';
  const icon = isFaster ? '↘' : isSlower ? '↗' : '✓';

  return { text, colorClass, icon, diffSeconds: diff };
}

export function formatDistanceKm(totalDistanceM?: number | null): string {
  if (
    totalDistanceM === undefined ||
    totalDistanceM === null ||
    totalDistanceM <= 0 ||
    !isFinite(totalDistanceM)
  ) {
    return '0.00';
  }
  const km = totalDistanceM / 1000;
  return km.toFixed(2);
}

export function formatElapsedTime(totalSeconds?: number | null): string {
  if (
    totalSeconds === undefined ||
    totalSeconds === null ||
    totalSeconds < 0 ||
    !isFinite(totalSeconds)
  ) {
    return '--:--';
  }
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

export interface CadenceZoneResult {
  badge: string;
  label: string;
  colorClass: string;
}

export interface CadenceZoneConfig {
  lowMax: number;
  moderateMax: number;
  optimalMax: number;
}

export const DEFAULT_CADENCE_ZONES: CadenceZoneConfig = {
  lowMax: 155,
  moderateMax: 169,
  optimalMax: 185,
};

export function parseCadenceZones(
  env: Record<string, string | undefined> = typeof process !== 'undefined' ? process.env : {},
): CadenceZoneConfig {
  const low = Number(env.NEXT_PUBLIC_CADENCE_LOW_MAX);
  const mod = Number(env.NEXT_PUBLIC_CADENCE_MODERATE_MAX);
  const opt = Number(env.NEXT_PUBLIC_CADENCE_OPTIMAL_MAX);

  if (isNaN(low) || isNaN(mod) || isNaN(opt) || low <= 0 || mod <= low || opt <= mod) {
    return DEFAULT_CADENCE_ZONES;
  }
  return { lowMax: low, moderateMax: mod, optimalMax: opt };
}

export function resolveCadenceZone(
  cadenceSpm?: number | null,
  config?: CadenceZoneConfig,
): CadenceZoneResult {
  const cfg = config || parseCadenceZones();
  if (!cadenceSpm || cadenceSpm <= 0) {
    return {
      badge: 'Sin cadencia',
      label: 'Esperando pasos',
      colorClass: 'text-slate-400',
    };
  }
  if (cadenceSpm < cfg.lowMax) {
    return {
      badge: 'Cadencia Baja',
      label: 'Ritmo suave / Calentamiento',
      colorClass: 'text-amber-600',
    };
  }
  if (cadenceSpm <= cfg.moderateMax) {
    return {
      badge: 'Cadencia Moderada',
      label: 'Ritmo aeróbico estándar',
      colorClass: 'text-indigo-600',
    };
  }
  if (cadenceSpm <= cfg.optimalMax) {
    return {
      badge: 'Rango Óptimo',
      label: 'Cadencia eficiente ideal',
      colorClass: 'text-teal-600',
    };
  }
  return {
    badge: 'Cadencia Alta',
    label: 'Ritmo rápido / Sprint',
    colorClass: 'text-orange-600',
  };
}

export function calculateDynamicEta(
  totalDistanceM?: number | null,
  speedMps?: number | null,
  targetDistanceM = 21097,
): string {
  if (!totalDistanceM || !speedMps || speedMps <= 0.5 || totalDistanceM >= targetDistanceM) {
    return '--:--';
  }
  const remainingM = targetDistanceM - totalDistanceM;
  const remainingSecs = remainingM / speedMps;
  const targetTimeMs = Date.now() + remainingSecs * 1000;
  const date = new Date(targetTimeMs);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function formatElevationProfile(
  pathElevations: number[],
  currentElevation?: number | null,
): string {
  const curEle = currentElevation ?? pathElevations[pathElevations.length - 1];
  if (pathElevations.length < 2) {
    if (curEle !== undefined && curEle !== null && isFinite(curEle)) {
      return `Altimetría: ${Math.round(curEle)} m sobre el nivel del mar`;
    }
    return 'Perfil de Elevación: Esperando datos de altimetría';
  }
  let gain = 0;
  let loss = 0;
  for (let i = 1; i < pathElevations.length; i++) {
    const diff = pathElevations[i] - pathElevations[i - 1];
    if (diff > 0) gain += diff;
    else loss += Math.abs(diff);
  }
  const cur = curEle ? ` (Actual: ${Math.round(curEle)}m)` : '';
  return `Perfil de Elevación: +${Math.round(gain)}m / -${Math.round(loss)}m${cur}`;
}
