import type {
  NotificationType,
  NotificationCta,
  CheerPreset,
} from '@running-support/shared-contracts';

export interface NotificationVisualConfig {
  badgeLabel: string;
  badgeClass: string;
  borderClass: string;
}

export function resolveNotificationVisualConfig(type: NotificationType): NotificationVisualConfig {
  switch (type) {
    case 'MILESTONE_25':
    case 'MILESTONE_50':
    case 'MILESTONE_75':
      return {
        badgeLabel: 'Hito',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        borderClass: 'border-emerald-200/80',
      };
    case 'EXERTION':
      return {
        badgeLabel: 'Esfuerzo',
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
        borderClass: 'border-rose-200/80',
      };
    case 'SPRINT':
      return {
        badgeLabel: 'Sprint',
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
        borderClass: 'border-amber-200/80',
      };
    default:
      return {
        badgeLabel: 'Aviso',
        badgeClass: 'bg-slate-50 text-slate-700 border-slate-200',
        borderClass: 'border-slate-200/80',
      };
  }
}

export function executeCtaScrollAndPreset(
  cta: NotificationCta,
  callbacks?: {
    scrollToElement?: (id: string) => void;
    selectPreset?: (preset: CheerPreset) => void;
  },
) {
  if (cta.action === 'SCROLL_CHEER_WALL') {
    if (callbacks?.scrollToElement) {
      callbacks.scrollToElement('cheer-wall');
    } else if (typeof document !== 'undefined') {
      const el = document.getElementById('cheer-wall');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    if (cta.presetId && callbacks?.selectPreset) {
      callbacks.selectPreset(cta.presetId);
    }
  }
}
