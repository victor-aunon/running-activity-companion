'use client';

import React from 'react';
import { ActionButton } from '../ui/button';
import { formatElapsedTime } from './HeaderTile';
import { formatPace, formatDistanceKm } from './MetricTile';
import type { RunningMetrics } from '@running-support/shared-contracts';
import { Trophy, X } from 'lucide-react';

export interface SessionSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  metrics?: RunningMetrics;
  totalCheersReceived?: number;
  athleteName?: string;
}

function MetricSummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      <span className="text-sm font-bold font-mono-metric text-slate-800">{value}</span>
    </div>
  );
}

function ModalHeader({ athlete, onClose }: { athlete: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
      <div className="flex items-center gap-2">
        <div className="p-2 bg-orange-100 rounded-lg text-orange-600">
          <Trophy className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">
            Actividad Finalizada
          </h3>
          <p className="text-xs text-slate-500">Resumen oficial de {athlete}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

function SummaryActions({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex items-center justify-end pt-4 border-t border-slate-100">
      <ActionButton variant="primary" onClick={onClose} className="text-xs px-5">
        Cerrar Resumen
      </ActionButton>
    </div>
  );
}

export function SessionSummaryModal({
  isOpen,
  onClose,
  metrics,
  totalCheersReceived = 0,
  athleteName = process.env.NEXT_PUBLIC_ATHLETE_NAME || 'Víctor',
}: SessionSummaryModalProps) {
  if (!isOpen) return null;

  const elapsed = metrics ? formatElapsedTime(metrics.elapsedSeconds) : '00:00';
  const dist = metrics ? formatDistanceKm(metrics.totalDistanceM) : '0.00';
  const pace = metrics ? formatPace(metrics.paceSecPerKm) : '--:--';

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bento-card w-full max-w-md p-6 bg-white shadow-2xl rounded-xl space-y-4">
        <ModalHeader athlete={athleteName} onClose={onClose} />
        <div className="py-2 space-y-1">
          <MetricSummaryRow label="Tiempo Total" value={elapsed} />
          <MetricSummaryRow label="Distancia Recorrida" value={`${dist} km`} />
          <MetricSummaryRow label="Ritmo Medio" value={`${pace} min/km`} />
          <MetricSummaryRow label="Mensajes de Ánimo" value={`${totalCheersReceived} recibidos`} />
        </div>
        <SummaryActions onClose={onClose} />
      </div>
    </div>
  );
}
