import React from 'react';
import { MetricTile, formatPace, formatDistanceKm } from '../bento/MetricTile';
import {
  formatPaceDifference,
  resolveCadenceZone,
  resolveHeartRateBadgeClasses,
} from '../../utils/formatters';
import type { RunningMetrics } from '@running-support/shared-contracts';
import type { HeartRateZoneResult } from '../../types/telemetry';
import { Gauge, Heart, Flag, Footprints } from 'lucide-react';

export function PaceMetricFooter({
  metrics,
  targetPaceSecPerKm,
}: {
  metrics?: RunningMetrics;
  targetPaceSecPerKm?: number;
}) {
  if (!metrics || metrics.paceSecPerKm <= 0) {
    return <span className="text-slate-400 font-normal">Sin datos de ritmo</span>;
  }
  if (targetPaceSecPerKm) {
    const diffResult = formatPaceDifference(metrics.paceSecPerKm, targetPaceSecPerKm);
    if (diffResult) {
      return (
        <span className={`font-bold ${diffResult.colorClass}`}>
          {diffResult.icon} {diffResult.text} vs objetivo
        </span>
      );
    }
  }
  return <span className="font-bold text-teal-600">Ritmo activo</span>;
}

export function HeartRateMetricFooter({
  zoneInfo,
  maxHeartRateBpm,
}: {
  zoneInfo: HeartRateZoneResult | null;
  maxHeartRateBpm?: number;
}) {
  if (!zoneInfo) {
    return <span className="text-slate-400 font-normal">Esperando pulsómetro</span>;
  }
  return (
    <>
      <span className={resolveHeartRateBadgeClasses(zoneInfo)}>{zoneInfo.name}</span>
      <span className="text-slate-500 font-semibold">
        {maxHeartRateBpm ? `Máx ${maxHeartRateBpm}` : `Zona ${zoneInfo.zone}`}
      </span>
    </>
  );
}

export function PaceAndHeartRateTiles({
  metrics,
  resolveZone,
  targetPaceSecPerKm,
  maxHeartRateBpm,
}: {
  metrics: RunningMetrics | undefined;
  resolveZone: (bpm: number) => HeartRateZoneResult;
  targetPaceSecPerKm?: number;
  maxHeartRateBpm?: number;
}) {
  const heartRate = metrics?.heartRateBpm ?? 0;
  const pace = metrics?.paceSecPerKm ?? 0;
  const zoneInfo = heartRate > 0 ? resolveZone(heartRate) : null;

  return (
    <>
      <MetricTile
        intent="pace"
        title="RITMO MEDIO"
        value={formatPace(pace)}
        unit="min/km"
        icon={<Gauge className="w-5 h-5 text-orange-600" />}
        iconBgClass="bg-orange-50 text-orange-600"
        footer={<PaceMetricFooter metrics={metrics} targetPaceSecPerKm={targetPaceSecPerKm} />}
      />
      <MetricTile
        intent="heartRate"
        title="FRECUENCIA CARDÍACA"
        value={heartRate > 0 ? heartRate : '--'}
        unit="bpm"
        icon={<Heart className="w-5 h-5 text-rose-500 fill-rose-500" />}
        iconBgClass="bg-rose-50 text-rose-500"
        footer={<HeartRateMetricFooter zoneInfo={zoneInfo} maxHeartRateBpm={maxHeartRateBpm} />}
      />
    </>
  );
}

export function DistanceMetricFooter({
  distance,
  targetDistanceKm,
}: {
  distance: number;
  targetDistanceKm?: number;
}) {
  if (distance <= 0) {
    return <span className="text-slate-400 font-normal">Esperando inicio de carrera</span>;
  }
  if (targetDistanceKm && targetDistanceKm > 0) {
    const pct = Math.min(100, (distance / (targetDistanceKm * 1000)) * 100).toFixed(1);
    return (
      <div className="w-full space-y-1.5">
        <div className="flex justify-between text-xs font-semibold text-slate-600">
          <span>Progreso de Carrera</span>
          <span className="text-orange-600 font-bold">{pct}%</span>
        </div>
        <div className="w-full bg-slate-100 h-2 rounded-lg overflow-hidden">
          <div
            className="bg-gradient-to-r from-teal-400 to-orange-600 h-full rounded-lg"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  }
  return (
    <span className="text-slate-600 font-medium">
      Total acumulado: {formatDistanceKm(distance)} km
    </span>
  );
}

export function CadenceMetricFooter({ cadence }: { cadence: number }) {
  if (cadence <= 0) {
    return <span className="text-slate-400 font-normal">Sin datos de cadencia</span>;
  }
  const zone = resolveCadenceZone(cadence);
  return (
    <>
      <span className={`${zone.colorClass} font-bold flex items-center gap-1`}>● {zone.badge}</span>
      <span className="text-slate-500 font-semibold">{zone.label}</span>
    </>
  );
}

export function DistanceAndCadenceTiles({
  metrics,
  targetDistanceKm,
}: {
  metrics: RunningMetrics | undefined;
  targetDistanceKm?: number;
}) {
  const distance = metrics?.totalDistanceM ?? 0;
  const cadence = metrics?.cadenceSpm ?? 0;

  return (
    <>
      <MetricTile
        intent="cadence"
        title="CADENCIA PASOS"
        value={cadence > 0 ? cadence : '--'}
        unit="spm"
        icon={<Footprints className="w-5 h-5 text-teal-600" />}
        iconBgClass="bg-teal-50 text-teal-600"
        footer={<CadenceMetricFooter cadence={cadence} />}
      />
      <MetricTile
        intent="distance"
        title="DISTANCIA RECORRIDA"
        value={formatDistanceKm(distance)}
        unit={targetDistanceKm ? `/ ${targetDistanceKm} km` : 'km'}
        icon={<Flag className="w-5 h-5 text-indigo-600" />}
        iconBgClass="bg-indigo-50 text-indigo-600"
        footer={<DistanceMetricFooter distance={distance} targetDistanceKm={targetDistanceKm} />}
      />
    </>
  );
}
