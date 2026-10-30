'use client';

import React, { useEffect } from 'react';
import type { SpectatorNotification, NotificationCta } from '@running-support/shared-contracts';
import { X, Trophy, Heart, Zap, ArrowRight } from 'lucide-react';
import { resolveNotificationVisualConfig } from './NotificationSnackbarLogic';

interface SnackbarItemProps {
  notification: SpectatorNotification;
  onDismiss: (id: string) => void;
  onCtaClick?: (cta: NotificationCta) => void;
}

function resolveIcon(type: SpectatorNotification['type']) {
  switch (type) {
    case 'MILESTONE_25':
    case 'MILESTONE_50':
    case 'MILESTONE_75':
      return <Trophy className="w-4 h-4 text-emerald-600 shrink-0" />;
    case 'EXERTION':
      return <Heart className="w-4 h-4 text-rose-500 fill-rose-500 shrink-0" />;
    case 'SPRINT':
      return <Zap className="w-4 h-4 text-amber-500 fill-amber-500 shrink-0" />;
    default:
      return null;
  }
}

function SnackbarItem({ notification, onDismiss, onCtaClick }: SnackbarItemProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(notification.id);
    }, notification.durationMs || 6000);
    return () => clearTimeout(timer);
  }, [notification.id, notification.durationMs, onDismiss]);

  const cfg = resolveNotificationVisualConfig(notification.type);
  const icon = resolveIcon(notification.type);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-auto w-full max-w-sm bg-white/95 backdrop-blur-md rounded-2xl border ${cfg.borderClass} shadow-xl shadow-slate-900/5 p-3.5 flex flex-col gap-2 transition-all transform animate-in fade-in slide-in-from-top-2 duration-200`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {icon}
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.badgeClass}`}
          >
            {cfg.badgeLabel}
          </span>
          <h4 className="text-xs font-bold text-slate-800 truncate">{notification.title}</h4>
        </div>
        <button
          type="button"
          onClick={() => onDismiss(notification.id)}
          aria-label="Cerrar notificación"
          className="text-slate-400 hover:text-slate-600 rounded-lg p-1 hover:bg-slate-100 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <p className="text-xs text-slate-600 leading-relaxed">{notification.message}</p>

      {notification.cta && (
        <button
          type="button"
          onClick={() => onCtaClick?.(notification.cta!)}
          className="mt-1 w-full py-1.5 px-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition-all"
        >
          <span>{notification.cta.label}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

export interface NotificationSnackbarContainerProps {
  snackbars: SpectatorNotification[];
  onDismiss: (id: string) => void;
  onCtaClick?: (cta: NotificationCta) => void;
}

export function NotificationSnackbarContainer({
  snackbars,
  onDismiss,
  onCtaClick,
}: NotificationSnackbarContainerProps) {
  if (!snackbars || snackbars.length === 0) {
    return null;
  }

  return (
    <aside
      aria-label="Notificaciones de carrera"
      className="fixed top-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none pr-4 md:pr-0"
    >
      {snackbars.slice(-3).map((item) => (
        <SnackbarItem
          key={item.id}
          notification={item}
          onDismiss={onDismiss}
          onCtaClick={onCtaClick}
        />
      ))}
    </aside>
  );
}
