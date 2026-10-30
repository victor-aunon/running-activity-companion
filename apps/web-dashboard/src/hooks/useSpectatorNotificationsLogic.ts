import type {
  SpectatorNotification,
  NotificationType,
  TelemetrySnapshotPacket,
} from '@running-support/shared-contracts';

export interface ExertionTrackerState {
  consecutiveCount: number;
  lastAlertTime: number;
}

export interface SprintTrackerState {
  consecutiveCount: number;
  lastAlertTime: number;
  finalPhaseTriggered: boolean;
}

export interface NotificationEngineState {
  reportedMilestones: Set<string>;
  exertion: ExertionTrackerState;
  sprint: SprintTrackerState;
  hasProcessedInitialSnapshot: boolean;
}

export const INITIAL_NOTIFICATION_ENGINE_STATE: NotificationEngineState = {
  reportedMilestones: new Set<string>(),
  exertion: { consecutiveCount: 0, lastAlertTime: 0 },
  sprint: { consecutiveCount: 0, lastAlertTime: 0, finalPhaseTriggered: false },
  hasProcessedInitialSnapshot: false,
};

export interface ExertionThresholdConfig {
  hrThresholdBpm: number;
  cooldownMs: number;
  maxConsecutive: number;
}

export interface SprintThresholdConfig {
  hrThresholdBpm: number;
  cadenceThresholdSpm: number;
  finalPhaseDistanceM: number;
  cooldownMs: number;
  maxConsecutive: number;
}

export interface NotificationThresholdsConfig {
  exertion: ExertionThresholdConfig;
  sprint: SprintThresholdConfig;
}

export interface DistanceMilestoneContext {
  athleteName: string;
  isInitialSnapshot?: boolean;
}

export interface ExertionEvaluationContext {
  now: number;
  athleteName: string;
}

export interface SprintInputMetrics {
  heartRateBpm: number;
  cadenceSpm: number;
  remainingDistanceM: number;
}

export interface SprintEvaluationContext {
  now: number;
  athleteName: string;
}

export interface NotificationEvaluationContext {
  athleteName: string;
  now: number;
  envDefaultRaceDistance?: string | number;
}

export const DEFAULT_NOTIFICATION_THRESHOLDS: NotificationThresholdsConfig = {
  exertion: {
    hrThresholdBpm: 175,
    cooldownMs: 30000,
    maxConsecutive: 3,
  },
  sprint: {
    hrThresholdBpm: 175,
    cadenceThresholdSpm: 180,
    finalPhaseDistanceM: 2000,
    cooldownMs: 30000,
    maxConsecutive: 3,
  },
};

export function parsePositiveNumber(val: unknown, fallback: number): number {
  if (typeof val === 'number' && !Number.isNaN(val) && val > 0) return val;
  if (typeof val === 'string') {
    const num = Number(val);
    if (!Number.isNaN(num) && num > 0) return num;
  }
  return fallback;
}

export function parseNotificationThresholds(
  env: Record<string, string | undefined> = {},
): NotificationThresholdsConfig {
  const zone4Max = parsePositiveNumber(env.NEXT_PUBLIC_ZONE_4_MAX, 175);
  const defaultExertionHr = parsePositiveNumber(env.NEXT_PUBLIC_NOTIF_EXERTION_HR_BPM, zone4Max);
  const exertionCooldownSec = parsePositiveNumber(env.NEXT_PUBLIC_NOTIF_EXERTION_COOLDOWN_SEC, 30);
  const exertionMaxConsecutive = parsePositiveNumber(
    env.NEXT_PUBLIC_NOTIF_EXERTION_MAX_CONSECUTIVE,
    3,
  );

  const defaultSprintHr = parsePositiveNumber(env.NEXT_PUBLIC_NOTIF_SPRINT_HR_BPM, 175);
  const defaultSprintCadence = parsePositiveNumber(env.NEXT_PUBLIC_NOTIF_SPRINT_CADENCE_SPM, 180);
  const sprintFinalPhaseDist = parsePositiveNumber(
    env.NEXT_PUBLIC_NOTIF_SPRINT_FINAL_DISTANCE_M,
    2000,
  );
  const sprintCooldownSec = parsePositiveNumber(env.NEXT_PUBLIC_NOTIF_SPRINT_COOLDOWN_SEC, 30);
  const sprintMaxConsecutive = parsePositiveNumber(env.NEXT_PUBLIC_NOTIF_SPRINT_MAX_CONSECUTIVE, 3);

  return {
    exertion: {
      hrThresholdBpm: defaultExertionHr,
      cooldownMs: exertionCooldownSec * 1000,
      maxConsecutive: exertionMaxConsecutive,
    },
    sprint: {
      hrThresholdBpm: defaultSprintHr,
      cadenceThresholdSpm: defaultSprintCadence,
      finalPhaseDistanceM: sprintFinalPhaseDist,
      cooldownMs: sprintCooldownSec * 1000,
      maxConsecutive: sprintMaxConsecutive,
    },
  };
}

export function resolveTotalRaceDistance(
  metricsRaceDist?: number,
  envDefault?: string | number,
): number {
  if (typeof metricsRaceDist === 'number' && metricsRaceDist > 0) {
    return metricsRaceDist;
  }
  const parsedEnv = Number(envDefault);
  if (!Number.isNaN(parsedEnv) && parsedEnv > 0) {
    return parsedEnv;
  }
  return 10000; // 10k default fallback in meters
}

function buildMilestoneNotification(
  type: NotificationType,
  title: string,
  message: string,
): SpectatorNotification {
  return {
    id: `milestone-${type}-${Date.now()}`,
    type,
    title,
    message,
    timestamp: Date.now(),
    durationMs: 6000,
  };
}

export function evaluateDistanceMilestones(
  currentDistanceM: number,
  totalRaceDistanceM: number,
  reportedMilestones: Set<string>,
  ctx: DistanceMilestoneContext,
): { newMilestones: SpectatorNotification[]; updatedReported: Set<string> } {
  const updatedReported = new Set(reportedMilestones);
  const newMilestones: SpectatorNotification[] = [];

  const milestones: {
    type: NotificationType;
    ratio: number;
    title: string;
    getMsg: (km: string) => string;
  }[] = [
    {
      type: 'MILESTONE_25',
      ratio: 0.25,
      title: '¡25% Completado!',
      getMsg: (km) => `${ctx.athleteName} ha completado el primer cuarto del recorrido (${km} km).`,
    },
    {
      type: 'MILESTONE_50',
      ratio: 0.5,
      title: '¡Ecuador de Carrera (50%)!',
      getMsg: () => '¡Mitad de carrera completada! Ritmo medio constante.',
    },
    {
      type: 'MILESTONE_75',
      ratio: 0.75,
      title: '¡Fase Decisiva (75%)!',
      getMsg: () => '¡Entrando en los últimos kilómetros! Es el momento de apretar.',
    },
  ];

  for (const m of milestones) {
    const thresholdM = m.ratio * totalRaceDistanceM;
    if (currentDistanceM < thresholdM || updatedReported.has(m.type)) {
      continue;
    }
    updatedReported.add(m.type);
    if (!ctx.isInitialSnapshot) {
      const kmStr = (thresholdM / 1000).toFixed(1);
      newMilestones.push(buildMilestoneNotification(m.type, m.title, m.getMsg(kmStr)));
    }
  }

  return { newMilestones, updatedReported };
}

function resolveExertionConfig(
  thresholdOrConfig: number | ExertionThresholdConfig,
): ExertionThresholdConfig {
  if (typeof thresholdOrConfig === 'number') {
    return {
      hrThresholdBpm: thresholdOrConfig,
      cooldownMs: DEFAULT_NOTIFICATION_THRESHOLDS.exertion.cooldownMs,
      maxConsecutive: DEFAULT_NOTIFICATION_THRESHOLDS.exertion.maxConsecutive,
    };
  }
  return thresholdOrConfig;
}

export function evaluateExertionState(
  heartRateBpm: number,
  thresholdOrConfig: number | ExertionThresholdConfig,
  state: ExertionTrackerState,
  ctx: ExertionEvaluationContext,
): { notification: SpectatorNotification | null; nextState: ExertionTrackerState } {
  const config = resolveExertionConfig(thresholdOrConfig);

  if (heartRateBpm > config.hrThresholdBpm) {
    const isCooldownActive = ctx.now - state.lastAlertTime < config.cooldownMs;
    const isCapReached = state.consecutiveCount >= config.maxConsecutive;

    if (!isCooldownActive && !isCapReached) {
      const notif: SpectatorNotification = {
        id: `exertion-${ctx.now}`,
        type: 'EXERTION',
        title: 'Alto Esfuerzo',
        message: `${ctx.athleteName} está haciendo un esfuerzo (${heartRateBpm} bpm).`,
        timestamp: ctx.now,
        durationMs: 6000,
      };
      return {
        notification: notif,
        nextState: {
          consecutiveCount: state.consecutiveCount + 1,
          lastAlertTime: ctx.now,
        },
      };
    }
    return { notification: null, nextState: state };
  }

  return {
    notification: null,
    nextState: {
      consecutiveCount: 0,
      lastAlertTime: state.lastAlertTime,
    },
  };
}

function createSprintNotification(athleteName: string, hr: number, spm: number, now: number) {
  return {
    id: `sprint-${now}`,
    type: 'SPRINT' as const,
    title: '¡Sprint en curso!',
    message: `¡${athleteName} está sprintando a ${hr} bpm y ${spm} spm!`,
    timestamp: now,
    durationMs: 8000,
    cta: {
      label: '¡Envíale un ánimo!',
      action: 'SCROLL_CHEER_WALL' as const,
      presetId: 'MUCHO_ANIMO' as const,
      customText: '¡A por el sprint final!',
    },
  };
}

function evaluateStandardSprint(
  metrics: SprintInputMetrics,
  state: SprintTrackerState,
  ctx: SprintEvaluationContext,
  config: SprintThresholdConfig,
): { notification: SpectatorNotification | null; nextState: SprintTrackerState } {
  const isCooldownActive = ctx.now - state.lastAlertTime < config.cooldownMs;
  const isCapReached = state.consecutiveCount >= config.maxConsecutive;
  if (!isCooldownActive && !isCapReached) {
    return {
      notification: createSprintNotification(
        ctx.athleteName,
        metrics.heartRateBpm,
        metrics.cadenceSpm,
        ctx.now,
      ),
      nextState: {
        consecutiveCount: state.consecutiveCount + 1,
        lastAlertTime: ctx.now,
        finalPhaseTriggered: state.finalPhaseTriggered,
      },
    };
  }
  return { notification: null, nextState: state };
}

export function evaluateSprintState(
  metrics: SprintInputMetrics,
  state: SprintTrackerState,
  ctx: SprintEvaluationContext,
  config: SprintThresholdConfig = DEFAULT_NOTIFICATION_THRESHOLDS.sprint,
): { notification: SpectatorNotification | null; nextState: SprintTrackerState } {
  const isSprint =
    metrics.heartRateBpm > config.hrThresholdBpm && metrics.cadenceSpm > config.cadenceThresholdSpm;
  if (!isSprint) {
    return {
      notification: null,
      nextState: {
        consecutiveCount: 0,
        lastAlertTime: state.lastAlertTime,
        finalPhaseTriggered: state.finalPhaseTriggered,
      },
    };
  }

  const isFinalPhase = metrics.remainingDistanceM < config.finalPhaseDistanceM;
  if (isFinalPhase) {
    if (!state.finalPhaseTriggered) {
      return {
        notification: createSprintNotification(
          ctx.athleteName,
          metrics.heartRateBpm,
          metrics.cadenceSpm,
          ctx.now,
        ),
        nextState: {
          consecutiveCount: state.consecutiveCount + 1,
          lastAlertTime: ctx.now,
          finalPhaseTriggered: true,
        },
      };
    }
    return { notification: null, nextState: state };
  }

  return evaluateStandardSprint(metrics, state, ctx, config);
}

function resolveExertionForEngine(
  telemetry: TelemetrySnapshotPacket,
  engine: NotificationEngineState,
  thresholds: NotificationThresholdsConfig,
  ctx: NotificationEvaluationContext,
): { notification: SpectatorNotification | null; nextState: ExertionTrackerState } {
  const { heartRateBpm, cadenceSpm } = telemetry.metrics;
  const isSprint =
    heartRateBpm > thresholds.sprint.hrThresholdBpm &&
    cadenceSpm > thresholds.sprint.cadenceThresholdSpm;

  if (isSprint) {
    return { notification: null, nextState: engine.exertion };
  }
  return evaluateExertionState(heartRateBpm, thresholds.exertion, engine.exertion, {
    now: ctx.now,
    athleteName: ctx.athleteName,
  });
}

export function evaluateAllNotifications(
  telemetry: TelemetrySnapshotPacket,
  engine: NotificationEngineState,
  thresholds: NotificationThresholdsConfig,
  ctx: NotificationEvaluationContext,
): { newAlerts: SpectatorNotification[]; nextEngine: NotificationEngineState } {
  const { totalDistanceM, heartRateBpm, cadenceSpm } = telemetry.metrics;
  const totalRaceM = resolveTotalRaceDistance(
    telemetry.metrics.totalRaceDistanceM,
    ctx.envDefaultRaceDistance,
  );
  const isInitialSnapshot = !engine.hasProcessedInitialSnapshot;
  const newAlerts: SpectatorNotification[] = [];

  const milestoneRes = evaluateDistanceMilestones(
    totalDistanceM,
    totalRaceM,
    engine.reportedMilestones,
    { athleteName: ctx.athleteName, isInitialSnapshot },
  );
  newAlerts.push(...milestoneRes.newMilestones);

  const remainingM = Math.max(0, totalRaceM - totalDistanceM);
  const sprintRes = evaluateSprintState(
    { heartRateBpm, cadenceSpm, remainingDistanceM: remainingM },
    engine.sprint,
    { now: ctx.now, athleteName: ctx.athleteName },
    thresholds.sprint,
  );
  if (sprintRes.notification) newAlerts.push(sprintRes.notification);

  const exertionRes = resolveExertionForEngine(telemetry, engine, thresholds, ctx);
  if (exertionRes.notification) newAlerts.push(exertionRes.notification);

  return {
    newAlerts,
    nextEngine: {
      reportedMilestones: milestoneRes.updatedReported,
      exertion: exertionRes.nextState,
      sprint: sprintRes.nextState,
      hasProcessedInitialSnapshot: true,
    },
  };
}
