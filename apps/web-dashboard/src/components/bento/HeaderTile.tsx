'use client';

import React, { useState } from 'react';
import { StatusBadge } from '../ui/badge';
import { MapPin, Share2, RefreshCw, Timer, Check } from 'lucide-react';
import { formatElapsedTime } from '../../utils/formatters';

export { formatElapsedTime };

export interface HeaderTileProps {
  athleteName?: string;
  locality?: string;
  elapsedSeconds?: number;
  watchBatteryPct?: number;
  phoneBatteryPct?: number;
  isLive?: boolean;
  sessionStatus?: string;
  pin?: string;
  onRefresh?: () => void;
  onShare?: () => void;
}

async function copyOrShareLink(athleteName: string) {
  if (typeof window === 'undefined') return false;
  const url = window.location.href;
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        title: `${athleteName} en Carrera`,
        text: `Sigue en directo la carrera de ${athleteName}:`,
        url,
      });
      return true;
    } catch {
      // Fallback
    }
  }
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch {
      // Fallback to execCommand
    }
  }
  try {
    const input = document.createElement('input');
    input.value = url;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
    return true;
  } catch {
    return false;
  }
}

function RunningManIcon({ className = 'w-6 h-6 text-white' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M13.49 5.48c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-3.6 13.9 1-4.4 2.1 2v6h2v-7.5l-2.1-2 .6-3c1.3 1.5 3.3 2.5 5.5 2.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1l-5.2 2.2v4.7h2v-3.4l1.8-.8-1.6 8.1-4.9-.9-.4 2 6.5 1.2z" />
    </svg>
  );
}

function AthleteInfo({
  athleteName,
  locality,
  isLive,
  sessionStatus,
}: {
  athleteName: string;
  locality: string;
  isLive: boolean;
  sessionStatus?: string;
}) {
  const isPaused = sessionStatus === 'PAUSED';
  const badgeVariant = isPaused ? 'en_reloj' : isLive ? 'live' : 'expirado';
  const badgeText = isPaused ? 'EN PAUSA' : isLive ? 'EN VIVO' : 'FINALIZADO';

  return (
    <div className="flex items-center gap-4">
      <div className="h-11 w-11 rounded-xl bg-gradient-to-tr from-orange-500 to-orange-600 flex items-center justify-center text-white shadow-md shadow-orange-200">
        <RunningManIcon className="w-6 h-6 text-white" />
      </div>
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-slate-900">
            {athleteName} en Carrera
          </h1>
          <StatusBadge
            variant={badgeVariant}
            className="px-2.5 py-0.5 text-xs font-semibold"
          >
            {badgeText}
          </StatusBadge>
        </div>
        <p className="text-xs text-slate-500 font-medium flex items-center gap-1 mt-0.5">
          <MapPin className="w-3.5 h-3.5 text-slate-400" />
          <span>{locality}</span>
        </p>
      </div>
    </div>
  );
}

interface ActionButtonsProps {
  elapsedSeconds?: number;
  pin?: string;
  athleteName: string;
  onRefresh?: () => void;
  onShare?: () => void;
}

function ShareAndRefreshButtons({
  isCopied,
  isRefreshing,
  onShare,
  onRefresh,
}: {
  isCopied: boolean;
  isRefreshing: boolean;
  onShare: () => void;
  onRefresh: () => void;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onRefresh}
        className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200/70 text-slate-700 border border-slate-200/60 transition-colors active:scale-95"
        title="Actualizar datos"
      >
        <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-orange-600' : ''}`} />
      </button>
      <button
        type="button"
        onClick={onShare}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-white text-xs font-bold shadow-md transition-all active:scale-95 ${
          isCopied
            ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'
            : 'bg-orange-600 hover:bg-orange-700 shadow-orange-200'
        }`}
      >
        {isCopied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
        <span>{isCopied ? '¡Enlace Copiado!' : 'Compartir Enlace'}</span>
      </button>
    </>
  );
}

function HeaderActionButtons({
  elapsedSeconds,
  pin,
  athleteName,
  onRefresh,
  onShare,
}: ActionButtonsProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleShareClick = async () => {
    if (onShare) {
      onShare();
      return;
    }
    const success = await copyOrShareLink(athleteName);
    if (success) {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    }
  };

  const handleRefreshClick = () => {
    setIsRefreshing(true);
    if (onRefresh) {
      onRefresh();
    } else if (typeof window !== 'undefined') {
      window.location.reload();
    }
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  return (
    <div className="flex items-center gap-2.5 flex-wrap">
      <div className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-orange-50 text-orange-700 text-xs font-semibold border border-orange-200/60">
        <Timer className="w-4 h-4 text-orange-600" />
        <span>Tiempo Transcurrido: {formatElapsedTime(elapsedSeconds)}</span>
      </div>
      <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200/60">
        PIN: {pin || '----'}
      </div>
      <ShareAndRefreshButtons
        isCopied={isCopied}
        isRefreshing={isRefreshing}
        onShare={() => void handleShareClick()}
        onRefresh={handleRefreshClick}
      />
    </div>
  );
}

export function HeaderTile({
  athleteName = process.env.NEXT_PUBLIC_ATHLETE_NAME || 'Víctor',
  locality = process.env.NEXT_PUBLIC_DEFAULT_LOCALITY || '--',
  elapsedSeconds,
  watchBatteryPct: _watchBatteryPct,
  phoneBatteryPct: _phoneBatteryPct,
  isLive = false,
  sessionStatus,
  pin = '----',
  onRefresh,
  onShare,
}: HeaderTileProps) {
  return (
    <header className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-sm px-6 py-4 flex flex-wrap items-center justify-between gap-4">
      <AthleteInfo
        athleteName={athleteName}
        locality={locality}
        isLive={isLive}
        sessionStatus={sessionStatus}
      />
      <HeaderActionButtons
        elapsedSeconds={elapsedSeconds}
        pin={pin}
        athleteName={athleteName}
        onRefresh={onRefresh}
        onShare={onShare}
      />
    </header>
  );
}
