'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type {
  TelemetrySnapshotPacket,
  SpectatorNotification,
  NotificationCta,
  CheerPreset,
} from '@running-support/shared-contracts';
import {
  evaluateAllNotifications,
  parseNotificationThresholds,
  INITIAL_NOTIFICATION_ENGINE_STATE,
  type NotificationEngineState,
  type NotificationThresholdsConfig,
} from './useSpectatorNotificationsLogic';
import { executeCtaScrollAndPreset } from '../components/ui/NotificationSnackbarLogic';
import { playNotificationSound } from '../utils/notificationAudio';

export interface UseSpectatorNotificationsOptions {
  telemetry: TelemetrySnapshotPacket | null;
  athleteName?: string;
  thresholds?: Partial<NotificationThresholdsConfig>;
  hrExertionThreshold?: number;
  onSelectPreset?: (preset: CheerPreset) => void;
}

function fireBrowserNotification(notif: SpectatorNotification) {
  if (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    Notification.permission === 'granted'
  ) {
    try {
      new Notification(notif.title, {
        body: notif.message,
        icon: '/icon.svg',
      });
    } catch {
      // Ignore background or blocked notification exceptions
    }
  }
}

function useActiveThresholds(
  thresholds?: Partial<NotificationThresholdsConfig>,
  hrExertionThreshold?: number,
): NotificationThresholdsConfig {
  const parsedEnv = useMemo(() => parseNotificationThresholds(process.env), []);

  return useMemo(() => {
    return {
      exertion: {
        ...parsedEnv.exertion,
        ...(hrExertionThreshold !== undefined ? { hrThresholdBpm: hrExertionThreshold } : {}),
        ...thresholds?.exertion,
      },
      sprint: {
        ...parsedEnv.sprint,
        ...thresholds?.sprint,
      },
    };
  }, [parsedEnv, hrExertionThreshold, thresholds]);
}

export function useSpectatorNotifications({
  telemetry,
  athleteName = 'Víctor',
  thresholds,
  hrExertionThreshold,
  onSelectPreset,
}: UseSpectatorNotificationsOptions) {
  const [snackbars, setSnackbars] = useState<SpectatorNotification[]>([]);
  const engineRef = useRef<NotificationEngineState>({
    ...INITIAL_NOTIFICATION_ENGINE_STATE,
    reportedMilestones: new Set<string>(),
  });

  const activeThresholds = useActiveThresholds(thresholds, hrExertionThreshold);

  const dismissSnackbar = useCallback((id: string) => {
    setSnackbars((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const handleCtaClick = useCallback(
    (cta: NotificationCta) => {
      executeCtaScrollAndPreset(cta, { selectPreset: onSelectPreset });
    },
    [onSelectPreset],
  );

  useEffect(() => {
    if (!telemetry?.metrics) return;
    const { newAlerts, nextEngine } = evaluateAllNotifications(
      telemetry,
      engineRef.current,
      activeThresholds,
      {
        athleteName,
        now: Date.now(),
        envDefaultRaceDistance: process.env.NEXT_PUBLIC_DEFAULT_RACE_DISTANCE_M,
      },
    );
    engineRef.current = nextEngine;
    if (newAlerts.length > 0) {
      setSnackbars((prev) => [...prev, ...newAlerts]);
      newAlerts.forEach((alert) => {
        fireBrowserNotification(alert);
        playNotificationSound(alert.type);
      });
    }
  }, [telemetry, athleteName, activeThresholds]);

  return { snackbars, dismissSnackbar, handleCtaClick };
}
