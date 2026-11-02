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
import { getRequiredAthleteName } from '../utils/athlete';

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
  const parsedEnv = useMemo(
    () =>
      parseNotificationThresholds({
        NEXT_PUBLIC_ZONE_4_MAX: process.env.NEXT_PUBLIC_ZONE_4_MAX,
        NEXT_PUBLIC_NOTIF_EXERTION_HR_BPM: process.env.NEXT_PUBLIC_NOTIF_EXERTION_HR_BPM,
        NEXT_PUBLIC_NOTIF_EXERTION_COOLDOWN_SEC: process.env.NEXT_PUBLIC_NOTIF_EXERTION_COOLDOWN_SEC,
        NEXT_PUBLIC_NOTIF_EXERTION_MAX_CONSECUTIVE:
          process.env.NEXT_PUBLIC_NOTIF_EXERTION_MAX_CONSECUTIVE,
        NEXT_PUBLIC_NOTIF_SPRINT_HR_BPM: process.env.NEXT_PUBLIC_NOTIF_SPRINT_HR_BPM,
        NEXT_PUBLIC_NOTIF_SPRINT_CADENCE_SPM: process.env.NEXT_PUBLIC_NOTIF_SPRINT_CADENCE_SPM,
        NEXT_PUBLIC_NOTIF_SPRINT_FINAL_DISTANCE_M:
          process.env.NEXT_PUBLIC_NOTIF_SPRINT_FINAL_DISTANCE_M,
        NEXT_PUBLIC_NOTIF_SPRINT_COOLDOWN_SEC: process.env.NEXT_PUBLIC_NOTIF_SPRINT_COOLDOWN_SEC,
        NEXT_PUBLIC_NOTIF_SPRINT_MAX_CONSECUTIVE: process.env.NEXT_PUBLIC_NOTIF_SPRINT_MAX_CONSECUTIVE,
      }),
    [],
  );

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
  athleteName,
  thresholds,
  hrExertionThreshold,
  onSelectPreset,
}: UseSpectatorNotificationsOptions) {
  const resolvedAthlete = getRequiredAthleteName(athleteName);
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
        athleteName: resolvedAthlete,
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
  }, [telemetry, resolvedAthlete, activeThresholds]);

  return { snackbars, dismissSnackbar, handleCtaClick };
}
