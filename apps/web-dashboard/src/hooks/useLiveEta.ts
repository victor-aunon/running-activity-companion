import { useState, useEffect } from 'react';
import { calculateDynamicEta } from '../utils/formatters.ts';

export interface UseLiveEtaOptions {
  totalDistanceM?: number | null;
  targetDistanceM?: number | null;
  paceSecPerKm?: number | null;
  speedMps?: number | null;
  isCompleted?: boolean;
  intervalMs?: number;
}

/**
 * Función pura que calcula el ETA proyectado en base al estado actual de la sesión.
 */
export function computeLiveEta(options: UseLiveEtaOptions, nowMs: number = Date.now()): string {
  if (options.isCompleted) {
    return '--:--';
  }
  return calculateDynamicEta({
    totalDistanceM: options.totalDistanceM,
    targetDistanceM: options.targetDistanceM,
    paceSecPerKm: options.paceSecPerKm,
    speedMps: options.speedMps,
    nowMs,
  });
}

/**
 * Hook de React para recalcular y refrescar automáticamente el ETA
 * cada minuto (o el intervalo configurado) y en cada nueva muestra de telemetría.
 */
export function useLiveEta(options: UseLiveEtaOptions): string {
  const { isCompleted, intervalMs = 60_000 } = options;
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (isCompleted) return;

    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isCompleted, intervalMs]);

  return computeLiveEta(options, nowMs);
}
